// server/services/steward/stewardService.ts — steward triage (G6 backend, plan 33)
// Session 33 · Wave 4-1 · No enum, no namespace, no default export
//
// Feedback queue, edit conflicts and feedback branches for /api/steward/*.
// Accepting an edit records the decision on app.votes (resolution columns,
// migration 009); the asset itself is changed by the feedback pipeline, never
// here (same rule as AssetRegistry.applyEdits).

import type { Db } from '../../lib/db';
import type { ServiceDeps } from '../../lib/deps';
import type { UserContext } from '../../lib/context';
import { conflict, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { NotificationService } from '../notification';
import { createFeedbackRepoUrlResolver, feedbackBranchHtmlUrl } from './feedbackRepo';
import type { FeedbackRepoUrlResolver } from './feedbackRepo';
import type {
  ConflictGroup,
  ConflictResolutionResult,
  EditProposal,
  FeedbackBranch,
  FeedbackQueueItem,
} from '../../../shared/contracts/entities';
import type {
  ConflictsQuery,
  FeedbackBranchListQuery,
  FeedbackQueueQuery,
  Paged,
  ResolveConflictRequest,
  UpdateFeedbackBranchStatusRequest,
  UpsertFeedbackBranchRequest,
} from '../../../shared/contracts/api';
import type {
  AssetType,
  ConflictResolution,
  EditField,
  FeedbackBatchStatus,
} from '../../../shared/contracts/values';

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function toIsoOrNull(val: unknown): string | null {
  return val === null || val === undefined ? null : toIso(val);
}

// ── Conflict detection (pure) ───────────────────────────────────────────────────

/** One unresolved vote row as read for conflict detection. */
export interface TriageVoteRow {
  id: string;
  assetId: string;
  displayName: string;
  userId: string;
  voteType: 'approve' | 'reject' | 'edit';
  editDescription: string | null;
  editPlainEnglishLogic: string | null;
  editDisplayName: string | null;
  createdAt: string;
}

const EDIT_COLUMNS: readonly [EditField, keyof TriageVoteRow][] = [
  ['description', 'editDescription'],
  ['plain_english_logic', 'editPlainEnglishLogic'],
  ['display_name', 'editDisplayName'],
];

/**
 * Group unresolved votes by asset and keep the conflicting ones: an asset is
 * in conflict when at least two edit proposals for the same field differ
 * (after trimming), or when it has edit proposals and reject votes.
 */
export function detectConflicts(rows: readonly TriageVoteRow[]): ConflictGroup[] {
  const byAsset = new Map<string, TriageVoteRow[]>();
  for (const r of rows) {
    const list = byAsset.get(r.assetId) ?? [];
    list.push(r);
    byAsset.set(r.assetId, list);
  }

  const groups: ConflictGroup[] = [];
  for (const [assetId, votes] of byAsset) {
    const edits: EditProposal[] = [];
    const distinctByField = new Map<EditField, Set<string>>();
    let rejectCount = 0;
    let approveCount = 0;

    for (const v of votes) {
      if (v.voteType === 'reject') rejectCount++;
      else if (v.voteType === 'approve') approveCount++;
      else {
        for (const [field, column] of EDIT_COLUMNS) {
          const raw = v[column];
          if (typeof raw !== 'string' || raw.trim() === '') continue;
          edits.push({ voteId: v.id, userId: v.userId, field, value: raw, createdAt: v.createdAt });
          const set = distinctByField.get(field) ?? new Set<string>();
          set.add(raw.trim());
          distinctByField.set(field, set);
        }
      }
    }

    const differingEdits = [...distinctByField.values()].some((s) => s.size >= 2);
    const editsAndRejects = edits.length > 0 && rejectCount > 0;
    if (differingEdits || editsAndRejects) {
      groups.push({
        assetId,
        displayName: votes[0].displayName,
        edits,
        rejectCount,
        approveCount,
      });
    }
  }
  return groups;
}

/**
 * Resolution written on each vote of a conflict group. The accepted edit gets
 * `accept_edit`; for accept_edit every other vote gets `reject_all` (its
 * proposal was not taken). keep_current / reject_all apply to every vote.
 */
export function resolutionFor(
  req: Pick<ResolveConflictRequest, 'resolution' | 'voteId'>,
  voteId: string,
): ConflictResolution {
  if (req.resolution !== 'accept_edit') return req.resolution;
  return voteId === req.voteId ? 'accept_edit' : 'reject_all';
}

// ── Row mappers ───────────────────────────────────────────────────────────────────

function parseFiles(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Map an app.feedback_batches row; `repoUrl` (feedbackRepo.ts) gives htmlUrl, null when unknown. */
export function rowToFeedbackBranch(r: Record<string, unknown>, repoUrl: string | null = null): FeedbackBranch {
  const branchName = r.branch_name ? String(r.branch_name) : '';
  return {
    batchId: String(r.id),
    branchName,
    status: String(r.status) as FeedbackBatchStatus,
    assetCount: Number(r.asset_count ?? 0),
    files: parseFiles(r.files),
    summary: r.summary === null || r.summary === undefined ? null : String(r.summary),
    createdAt: toIso(r.created_at),
    completedAt: toIsoOrNull(r.completed_at),
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
    htmlUrl: feedbackBranchHtmlUrl(repoUrl, branchName),
  };
}

function rowToTriageVote(r: Record<string, unknown>): TriageVoteRow {
  return {
    id: String(r.id),
    assetId: String(r.asset_id),
    displayName: String(r.display_name ?? r.name ?? ''),
    userId: String(r.user_id),
    voteType: String(r.vote_type) as TriageVoteRow['voteType'],
    editDescription: (r.edit_description as string | null) ?? null,
    editPlainEnglishLogic: (r.edit_plain_english_logic as string | null) ?? null,
    editDisplayName: (r.edit_display_name as string | null) ?? null,
    createdAt: toIso(r.created_at),
  };
}

/** Statuses a steward may move a branch from (pending/failed have no branch to review). */
const REVIEWABLE_FROM: readonly FeedbackBatchStatus[] = ['proposed', 'in_review'];

/** Upsert statuses that tell stewards something happened. */
const NOTIFY_ON_UPSERT: readonly FeedbackBatchStatus[] = ['proposed', 'failed'];

/**
 * Notify once (build 5 follow-up 5): an upsert sends feedback.branch_ready /
 * feedback.failed only when it creates the row (`previous` null) or changes its
 * status. A retry or re-registration with the same status sends nothing.
 */
export function shouldNotifyOnUpsert(
  previous: FeedbackBatchStatus | null,
  next: FeedbackBatchStatus,
): boolean {
  return NOTIFY_ON_UPSERT.includes(next) && previous !== next;
}

export interface StewardServiceOptions {
  /** Web URL of the feedback repo for FeedbackBranch.htmlUrl (default: env / Repos API, read once). */
  feedbackRepoUrl?: FeedbackRepoUrlResolver;
}

// ── Service ──────────────────────────────────────────────────────────────────────

export class StewardService {
  private db: Db;
  private readonly repoUrl: FeedbackRepoUrlResolver;

  constructor(
    deps: ServiceDeps,
    private readonly notifications: NotificationService,
    opts: StewardServiceOptions = {},
  ) {
    this.db = deps.db;
    this.repoUrl = opts.feedbackRepoUrl ?? createFeedbackRepoUrlResolver();
    // Read the repo URL once at startup; the resolver caches it and never rejects.
    void this.repoUrl();
  }

  // ── GET /api/steward/feedback-queue ──

  async feedbackQueue(q: FeedbackQueueQuery): Promise<Paged<FeedbackQueueItem>> {
    const params: unknown[] = [];
    const where: string[] = ['(va.asset_id IS NOT NULL OR sa.asset_id IS NOT NULL)'];
    let campaignExpr = `(SELECT ca.campaign_id FROM app.campaign_assets ca
         JOIN app.campaigns c ON c.id = ca.campaign_id AND c.status = 'active'
         WHERE ca.asset_id = a.id ORDER BY c.created_at LIMIT 1)`;

    if (q.campaignId) {
      params.push(q.campaignId);
      const p = `$${params.length}`;
      where.push(`EXISTS (SELECT 1 FROM app.campaign_assets ca WHERE ca.asset_id = a.id AND ca.campaign_id = ${p})`);
      campaignExpr = `${p}::uuid`;
    }
    if (q.assetType) {
      params.push(q.assetType);
      where.push(`a.asset_type = $${params.length}`);
    }
    if (q.status === 'pending') {
      where.push('COALESCE(va.unprocessed, 0) > 0');
    }
    params.push(q.limit, q.offset);
    const limitP = `$${params.length - 1}`;
    const offsetP = `$${params.length}`;

    const rows = await this.db.query<Record<string, unknown>>(
      `WITH va AS (
         SELECT asset_id,
                COUNT(*) FILTER (WHERE vote_type = 'approve')::int AS approve,
                COUNT(*) FILTER (WHERE vote_type = 'reject')::int AS reject,
                COUNT(*) FILTER (WHERE vote_type = 'edit')::int AS edit,
                COUNT(*) FILTER (WHERE vote_type = 'edit' AND resolution IS NULL AND NOT is_processed)::int AS pending_edits,
                COUNT(*) FILTER (WHERE NOT is_processed)::int AS unprocessed,
                MAX(created_at) AS last_vote_at
         FROM app.votes GROUP BY asset_id
       ), sa AS (
         SELECT asset_id, COUNT(*)::int AS skips, MAX(created_at) AS last_skip_at
         FROM app.review_skips GROUP BY asset_id
       )
       SELECT a.id AS asset_id, a.display_name, a.name, a.asset_type,
              ${campaignExpr} AS campaign_id,
              COALESCE(va.approve, 0) AS approve, COALESCE(va.reject, 0) AS reject,
              COALESCE(va.edit, 0) AS edit, COALESCE(va.pending_edits, 0) AS pending_edits,
              COALESCE(sa.skips, 0) AS skips,
              GREATEST(va.last_vote_at, sa.last_skip_at) AS last_activity_at,
              COUNT(*) OVER ()::int AS total_count
       FROM app.assets a
       LEFT JOIN va ON va.asset_id = a.id
       LEFT JOIN sa ON sa.asset_id = a.id
       WHERE ${where.join(' AND ')}
       ORDER BY last_activity_at DESC NULLS LAST, a.id
       LIMIT ${limitP} OFFSET ${offsetP}`,
      params,
    );

    let total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    if (rows.length === 0 && q.offset > 0) {
      // Page past the end: COUNT(*) OVER () has no row to ride on.
      const countRow = await this.db.one<{ total_count: number | string }>(
        `WITH va AS (
           SELECT asset_id, COUNT(*) FILTER (WHERE NOT is_processed)::int AS unprocessed
           FROM app.votes GROUP BY asset_id
         ), sa AS (SELECT DISTINCT asset_id FROM app.review_skips)
         SELECT COUNT(*)::int AS total_count
         FROM app.assets a
         LEFT JOIN va ON va.asset_id = a.id
         LEFT JOIN sa ON sa.asset_id = a.id
         WHERE ${where.join(' AND ')}`,
        params.slice(0, -2),
      );
      total = Number(countRow?.total_count ?? 0);
    }

    return {
      items: rows.map((r) => ({
        assetId: String(r.asset_id),
        displayName: String(r.display_name || r.name || ''),
        assetType: String(r.asset_type) as AssetType,
        campaignId: r.campaign_id ? String(r.campaign_id) : null,
        votes: {
          approve: Number(r.approve),
          reject: Number(r.reject),
          edit: Number(r.edit),
        },
        skips: Number(r.skips),
        pendingEdits: Number(r.pending_edits),
        lastActivityAt: toIsoOrNull(r.last_activity_at),
      })),
      total,
      limit: q.limit,
      offset: q.offset,
    };
  }

  // ── GET /api/steward/conflicts ──

  async conflicts(q: ConflictsQuery): Promise<ConflictGroup[]> {
    const rows = await this.unresolvedVotes(q);
    return detectConflicts(rows);
  }

  // ── POST /api/steward/conflicts/:assetId/resolve ──

  async resolveConflict(
    user: UserContext,
    assetId: string,
    req: ResolveConflictRequest,
  ): Promise<ConflictResolutionResult> {
    const asset = await this.db.one<{ id: string; display_name: string | null; name: string }>(
      'SELECT id, display_name, name FROM app.assets WHERE id = $1',
      [assetId],
    );
    if (!asset) throw notFound(`Asset not found: ${assetId}`);

    const rows = await this.unresolvedVotes({}, assetId);
    const [group] = detectConflicts(rows);
    if (!group) throw conflict(`Asset ${assetId} has no unresolved conflict`);

    // Every unresolved edit / reject vote on the asset belongs to the group.
    const groupVotes = rows.filter((r) => r.voteType === 'edit' || r.voteType === 'reject');
    if (req.resolution === 'accept_edit' && !groupVotes.some((v) => v.id === req.voteId && v.voteType === 'edit')) {
      throw notFound(`Edit vote ${req.voteId} is not an unresolved edit on asset ${assetId}`);
    }

    const ids = groupVotes.map((v) => v.id);
    const resolutions = groupVotes.map((v) => resolutionFor(req, v.id));
    const updated = await this.db.query<{ id: string; resolved_at: unknown }>(
      `UPDATE app.votes v
       SET resolution = r.resolution, resolved_by = $3, resolved_at = NOW()
       FROM unnest($1::uuid[], $2::text[]) AS r(id, resolution)
       WHERE v.id = r.id AND v.resolution IS NULL
       RETURNING v.id, v.resolved_at`,
      [ids, resolutions, user.userId],
    );
    if (updated.length === 0) {
      throw conflict(`Conflict on asset ${assetId} was resolved by someone else`);
    }
    const resolvedAt = toIso(updated[0].resolved_at ?? new Date());

    logger.info('audit: steward conflict resolved', {
      audit: true,
      action: 'steward.conflict.resolve',
      actor: user.userId,
      assetId,
      resolution: req.resolution,
      acceptedVoteId: req.voteId ?? null,
      resolvedVotes: updated.length,
      note: req.note ?? null,
    });

    // Tell every edit author (except the steward) how their proposal ended.
    const authors = [...new Set(group.edits.map((e) => e.userId))].filter((u) => u !== user.userId);
    const assetName = asset.display_name || asset.name;
    for (const author of authors) {
      await this.notifications.notify({
        // No dedicated event type in NOTIFICATION_EVENT_TYPES yet (request filed).
        eventType: 'feedback.branch_ready',
        recipientType: 'user',
        recipientId: author,
        title: `Edit proposal ${req.resolution === 'accept_edit' ? 'reviewed' : 'resolved'}: ${assetName}`,
        body: req.note ?? '',
        metadata: {
          kind: 'conflict.resolved',
          assetId,
          resolution: req.resolution,
          acceptedVoteId: req.voteId ?? null,
          resolvedBy: user.userId,
        },
      });
    }

    return {
      assetId,
      resolution: req.resolution,
      resolvedVotes: updated.length,
      resolvedBy: user.userId,
      resolvedAt,
    };
  }

  // ── GET /api/steward/feedback-branches ──

  async listFeedbackBranches(q: FeedbackBranchListQuery): Promise<FeedbackBranch[]> {
    const rows = q.status
      ? await this.db.query<Record<string, unknown>>(
          'SELECT * FROM app.feedback_batches WHERE status = $1 ORDER BY created_at DESC LIMIT 200',
          [q.status],
        )
      : await this.db.query<Record<string, unknown>>(
          'SELECT * FROM app.feedback_batches ORDER BY created_at DESC LIMIT 200',
        );
    const repoUrl = await this.repoUrl();
    return rows.map((r) => rowToFeedbackBranch(r, repoUrl));
  }

  // ── POST /api/steward/feedback-branches (admin; feedback job via M2M) ──

  /**
   * Upsert by batchId (when given) or branchName. `created` is true for a new row.
   * For a 'proposed' branch, `voteIds` are marked processed right after the upsert. Db has no
   * parameterised transaction, so this is a second statement; a retry is safe (the upsert is by
   * branch name and only unprocessed votes are updated). Stewards are notified
   * only when the row is created or its status changes (shouldNotifyOnUpsert).
   */
  async upsertFeedbackBranch(
    user: UserContext,
    req: UpsertFeedbackBranchRequest,
  ): Promise<{ branch: FeedbackBranch; created: boolean }> {
    const existing = req.batchId
      ? await this.db.one<Record<string, unknown>>(
          'SELECT id, status FROM app.feedback_batches WHERE id = $1',
          [req.batchId],
        )
      : await this.db.one<Record<string, unknown>>(
          'SELECT id, status FROM app.feedback_batches WHERE branch_name = $1 ORDER BY created_at DESC LIMIT 1',
          [req.branchName],
        );
    if (req.batchId && !existing) throw notFound(`Feedback batch not found: ${req.batchId}`);

    const files = JSON.stringify(req.files);
    const completes = req.status === 'proposed' || req.status === 'failed';
    let row: Record<string, unknown> | null;
    if (existing) {
      row = await this.db.one<Record<string, unknown>>(
        `UPDATE app.feedback_batches
         SET branch_name = $2, files = $3::jsonb, summary = COALESCE($4, summary), status = $5,
             completed_at = CASE WHEN $6 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
         WHERE id = $1
         RETURNING *`,
        [String(existing.id), req.branchName, files, req.summary ?? null, req.status, completes],
      );
    } else {
      row = await this.db.one<Record<string, unknown>>(
        `INSERT INTO app.feedback_batches (triggered_by, branch_name, files, summary, status, completed_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, CASE WHEN $6 THEN NOW() ELSE NULL END)
         RETURNING *`,
        [user.userId, req.branchName, files, req.summary ?? null, req.status, completes],
      );
    }
    if (!row) throw new Error('feedback_batches upsert returned no row');
    const branch = rowToFeedbackBranch(row, await this.repoUrl());
    const previousStatus = existing ? (String(existing.status) as FeedbackBatchStatus) : null;

    if (req.status === 'proposed' && req.voteIds?.length) {
      const marked = await this.db.query<{ id: string }>(
        `UPDATE app.votes SET is_processed = TRUE
         WHERE id = ANY($1::uuid[]) AND NOT is_processed
         RETURNING id`,
        [req.voteIds],
      );
      logger.info('Feedback votes marked processed', {
        branchName: branch.branchName, requested: req.voteIds.length, marked: marked.length,
      });
    }

    if (shouldNotifyOnUpsert(previousStatus, req.status)) {
      await this.notifications.notify({
        eventType: req.status === 'failed' ? 'feedback.failed' : 'feedback.branch_ready',
        recipientType: 'role',
        recipientId: 'steward',
        title: req.status === 'failed'
          ? `Feedback run failed: ${branch.branchName}`
          : `Feedback branch ready for review: ${branch.branchName}`,
        body: branch.summary ?? '',
        metadata: { batchId: branch.batchId, branchName: branch.branchName, files: branch.files.length },
      });
    }

    return { branch, created: !existing };
  }

  // ── POST /api/steward/feedback-branches/:batchId/status ──

  async updateFeedbackBranchStatus(
    user: UserContext,
    batchId: string,
    req: UpdateFeedbackBranchStatusRequest,
  ): Promise<FeedbackBranch> {
    const current = await this.db.one<{ status: string }>(
      'SELECT status FROM app.feedback_batches WHERE id = $1',
      [batchId],
    );
    if (!current) throw notFound(`Feedback batch not found: ${batchId}`);
    if (!REVIEWABLE_FROM.includes(current.status as FeedbackBatchStatus)) {
      throw conflict(`Feedback batch ${batchId} is ${current.status}; only proposed or in_review branches can be reviewed`);
    }

    const row = await this.db.one<Record<string, unknown>>(
      `UPDATE app.feedback_batches
       SET status = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $1 AND status = ANY($4::text[])
       RETURNING *`,
      [batchId, req.status, user.userId, [...REVIEWABLE_FROM]],
    );
    if (!row) throw conflict(`Feedback batch ${batchId} changed while updating`);

    logger.info('audit: feedback branch status', {
      audit: true,
      action: 'steward.feedback_branch.status',
      actor: user.userId,
      batchId,
      from: current.status,
      to: req.status,
      note: req.note ?? null,
    });

    return rowToFeedbackBranch(row, await this.repoUrl());
  }

  // ── helpers ──

  /** Unresolved votes on assets that have at least one unresolved edit. */
  private async unresolvedVotes(q: ConflictsQuery, assetId?: string): Promise<TriageVoteRow[]> {
    const params: unknown[] = [];
    const where: string[] = [
      'v.resolution IS NULL',
      `EXISTS (SELECT 1 FROM app.votes e WHERE e.asset_id = v.asset_id AND e.vote_type = 'edit' AND e.resolution IS NULL)`,
    ];
    if (assetId) {
      params.push(assetId);
      where.push(`v.asset_id = $${params.length}`);
    }
    if (q.campaignId) {
      params.push(q.campaignId);
      where.push(`EXISTS (SELECT 1 FROM app.campaign_assets ca WHERE ca.asset_id = v.asset_id AND ca.campaign_id = $${params.length})`);
    }
    if (q.assetType) {
      params.push(q.assetType);
      where.push(`a.asset_type = $${params.length}`);
    }
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT v.id, v.asset_id, v.user_id, v.vote_type,
              v.edit_description, v.edit_plain_english_logic, v.edit_display_name,
              v.created_at, a.display_name, a.name
       FROM app.votes v
       JOIN app.assets a ON a.id = v.asset_id
       WHERE ${where.join(' AND ')}
       ORDER BY v.asset_id, v.created_at`,
      params,
    );
    return rows.map(rowToTriageVote);
  }
}
