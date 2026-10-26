// server/services/review/reviewEngine.ts — orchestrates reviews, votes, gamification
// Session 06 · Wave 2 · No enum, no namespace, no default export

import type { ServiceDeps } from '../../lib/deps';
import type { Db } from '../../lib/db';
import type { ConfigStore } from '../../lib/config';
import type { EventBus } from '../../lib/events';
import { badRequest, notFound } from '../../lib/errors';

import type { AssetRegistry } from '../asset/assetRegistry';
import type { MetricViewService } from '../metricView/metricViewService';
import type {
  ConfidenceScore,
  UserStats,
  LeaderboardEntry,
  ExecutiveSummary,
  QueryResult,
  ReviewSkip,
} from '../../../shared/contracts/entities';
import type { ReviewCard, SkipResponse, SkipStats } from '../../../shared/contracts/review';
import type {
  GetNextQuery,
  SkipRequest,
  VoteBody,
  VoteResult,
} from '../../../shared/contracts/api';
import type { UserContext } from '../../lib/context';
import type { VoteType, VoteSource, SkipReason } from '../../../shared/contracts/values';
import { computeConfidence, deriveStatus } from './wilsonScore';
import type { Candidate } from './surfacing';
import { surfacingWeight, pickWeighted, reasonFor } from './surfacing';
import { nextStreak, earnedBadges } from './gamification';
import { buildValidationQuery } from './validationQuery';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/** Next card plus whether it came back from the user's skip cooldown. */
export interface NextCardResult {
  card: ReviewCard | null;
  /** True when every eligible asset was in skip cooldown and the oldest-skipped one was returned. */
  resurfacedFromSkip: boolean;
}

export function rowToReviewSkip(r: Record<string, unknown>): ReviewSkip {
  return {
    id: String(r.id),
    assetId: String(r.asset_id),
    campaignId: r.campaign_id ? String(r.campaign_id) : null,
    reason: (r.reason as SkipReason | null) ?? null,
    versionHash: r.version_hash ? String(r.version_hash) : null,
    source: String(r.source) as VoteSource,
    createdAt: toIso(r.created_at),
  };
}

export class ReviewEngine {
  private db: Db;
  private config: ConfigStore;
  private events: EventBus;
  private assets: AssetRegistry;
  private metricViews: MetricViewService;

  constructor(
    deps: ServiceDeps,
    assets: AssetRegistry,
    metricViews: MetricViewService,
  ) {
    this.db = deps.db;
    this.config = deps.config;
    this.events = deps.events;
    this.assets = assets;
    this.metricViews = metricViews;
  }

  // ── getNext ─────────────────────────────────────────────────────────

  async getNext(
    user: UserContext,
    q: GetNextQuery,
  ): Promise<ReviewCard | null> {
    return (await this.getNextWithMeta(user, q)).card;
  }

  /**
   * Pick the next card. Assets the user skipped within `skipCooldownHours`
   * are excluded; when every eligible asset is in cooldown, the asset whose
   * latest skip is oldest comes back (resurfacedFromSkip) instead of an
   * empty queue.
   */
  async getNextWithMeta(
    user: UserContext,
    q: GetNextQuery,
  ): Promise<NextCardResult> {
    const settings = await this.config.get();
    const cooldownHours = Math.max(0, Number(settings.skipCooldownHours) || 0);

    // Build dynamic conditions
    const params: unknown[] = [user.userId];
    let idx = 2;
    const extraWhere: string[] = [];
    let campaignJoin = '';

    if (q.campaignId) {
      // An unknown campaign is a 404, not an empty queue.
      const campaignRow = await this.db.one<{ id: string }>(
        'SELECT id FROM app.campaigns WHERE id = $1',
        [q.campaignId],
      );
      if (!campaignRow) throw notFound(`Campaign not found: ${q.campaignId}`);
      campaignJoin = `JOIN app.campaign_assets ca ON ca.asset_id = a.id
                        AND ca.campaign_id = $${idx} AND ca.status = 'pending'`;
      params.push(q.campaignId);
      idx++;
    }
    if (q.assetType) {
      extraWhere.push(`a.asset_type = $${idx}`);
      params.push(q.assetType);
      idx++;
    }

    const whereSuffix =
      extraWhere.length > 0 ? 'AND ' + extraWhere.join(' AND ') : '';

    // Skip cooldown: hide assets this user skipped in the last N hours.
    const cooldownWhere =
      cooldownHours > 0
        ? `AND NOT EXISTS (
           SELECT 1 FROM app.review_skips rs
           WHERE rs.asset_id = a.id AND rs.user_id = $1
             AND rs.created_at > NOW() - make_interval(hours => $${idx}::int)
         )`
        : '';
    const candidateParams = cooldownHours > 0 ? [...params, cooldownHours] : params;

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT
         a.id AS asset_id,
         COALESCE(cs.confidence, 0) AS confidence,
         COALESCE(cs.total_votes, 0) AS total_votes,
         a.last_reviewed_at,
         EXISTS (
           SELECT 1 FROM app.campaign_assets ca2
           JOIN app.campaigns c2 ON c2.id = ca2.campaign_id
             AND c2.status = 'active'
           WHERE ca2.asset_id = a.id AND ca2.status = 'pending'
         ) AS in_campaign,
         (
           EXISTS (SELECT 1 FROM app.votes v3 WHERE v3.asset_id = a.id)
           AND NOT EXISTS (
             SELECT 1 FROM app.votes v4
             WHERE v4.asset_id = a.id AND v4.version_hash = a.version_hash
           )
         ) AS is_new_version
       FROM app.assets a
       LEFT JOIN app.confidence_scores cs ON cs.asset_id = a.id
       ${campaignJoin}
       WHERE NOT EXISTS (
         SELECT 1 FROM app.votes v2
         WHERE v2.asset_id = a.id
           AND v2.user_id = $1
           AND v2.version_hash = a.version_hash
       )
       ${whereSuffix}
       ${cooldownWhere}
       LIMIT 200`,
      candidateParams,
    );

    if (rows.length === 0) {
      if (cooldownHours === 0) return { card: null, resurfacedFromSkip: false };
      // Everything eligible is in cooldown: resurface the oldest-skipped asset.
      const oldest = await this.db.one<{ asset_id: string }>(
        `SELECT a.id AS asset_id
         FROM app.assets a
         JOIN app.review_skips rs ON rs.asset_id = a.id AND rs.user_id = $1
         ${campaignJoin}
         WHERE NOT EXISTS (
           SELECT 1 FROM app.votes v2
           WHERE v2.asset_id = a.id
             AND v2.user_id = $1
             AND v2.version_hash = a.version_hash
         )
         ${whereSuffix}
         GROUP BY a.id
         ORDER BY MAX(rs.created_at) ASC
         LIMIT 1`,
        params,
      );
      if (!oldest) return { card: null, resurfacedFromSkip: false };
      const card = await this.buildCard(user, q, String(oldest.asset_id), 'random');
      return { card, resurfacedFromSkip: true };
    }

    const now = new Date();
    const candidates: (Candidate & { _row: Record<string, unknown> })[] =
      rows.map((r) => ({
        assetId: String(r.asset_id),
        confidence: Number(r.confidence),
        totalVotes: Number(r.total_votes),
        lastReviewedAt: r.last_reviewed_at
          ? String(r.last_reviewed_at)
          : null,
        inCampaign: Boolean(r.in_campaign),
        isNewVersion: Boolean(r.is_new_version),
        _row: r,
      }));

    const picked = pickWeighted(
      candidates,
      (c) => surfacingWeight(c, now, settings.stalenessDays),
    );
    if (!picked) return { card: null, resurfacedFromSkip: false };

    const card = await this.buildCard(user, q, picked.assetId, reasonFor(picked));
    return { card, resurfacedFromSkip: false };
  }

  /** Hydrate a ReviewCard for one asset. */
  private async buildCard(
    user: UserContext,
    q: GetNextQuery,
    assetId: string,
    reason: ReviewCard['reason'],
  ): Promise<ReviewCard> {
    const asset = await this.assets.get(assetId);
    const synonyms = await this.assets.listSynonyms(assetId);
    const examples = await this.assets.listExamples(assetId);
    const confidence = await this.readConfidence(assetId);

    // Progress: user's distinct-asset votes vs total pool
    const totalRow = await this.db.one<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app.assets',
    );
    const votedRow = await this.db.one<{ count: string }>(
      `SELECT COUNT(DISTINCT asset_id)::text AS count
       FROM app.votes WHERE user_id = $1`,
      [user.userId],
    );

    const campaign = q.campaignId
      ? await this.db.one<{ id: string; name: string }>(
          'SELECT id, name FROM app.campaigns WHERE id = $1',
          [q.campaignId],
        )
      : null;

    return {
      asset,
      synonyms,
      examples,
      confidence,
      campaign: campaign
        ? { campaignId: campaign.id, name: campaign.name }
        : undefined,
      reason,
      progress: {
        reviewed: Number(votedRow?.count ?? 0),
        total: Number(totalRow?.count ?? 0),
      },
    };
  }

  // ── submitVote ──────────────────────────────────────────────────────

  async submitVote(
    user: UserContext,
    body: VoteBody,
  ): Promise<VoteResult> {
    const asset = await this.assets.get(body.assetId);
    const settings = await this.config.get();

    // Read current version_hash directly (not on the DTO)
    const hashRow = await this.db.one<{ version_hash: string }>(
      'SELECT version_hash FROM app.assets WHERE id = $1',
      [body.assetId],
    );
    const versionHash = hashRow?.version_hash ?? '';

    // First active campaign containing this asset
    const campaignRow = await this.db.one<{ campaign_id: string }>(
      `SELECT ca.campaign_id FROM app.campaign_assets ca
       JOIN app.campaigns c ON c.id = ca.campaign_id AND c.status = 'active'
       WHERE ca.asset_id = $1 AND ca.status = 'pending'
       LIMIT 1`,
      [body.assetId],
    );
    const campaignId = campaignRow?.campaign_id ?? null;

    // INSERT vote
    const voteRow = await this.db.one<Record<string, unknown>>(
      `INSERT INTO app.votes (
         asset_id, user_id, vote_type, source, feedback,
         edit_description, edit_plain_english_logic, edit_display_name,
         version_hash, campaign_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        body.assetId,
        user.userId,
        body.voteType,
        user.source,
        body.feedback ?? null,
        body.edits?.description ?? null,
        body.edits?.plainEnglishLogic ?? null,
        body.edits?.displayName ?? null,
        versionHash,
        campaignId,
      ],
    );

    // For edit votes, record proposed edits
    if (body.voteType === 'edit' && body.edits) {
      await this.assets.applyEdits(body.assetId, body.edits, user.userId);
    }

    // Idempotent recompute
    const confidence = await this.recompute(body.assetId);

    // Mark campaign_assets reviewed
    if (campaignId) {
      await this.db.query(
        `UPDATE app.campaign_assets SET status = 'reviewed'
         WHERE campaign_id = $1 AND asset_id = $2`,
        [campaignId, body.assetId],
      );
    }

    // Touch reviewed
    await this.assets.touchReviewed(body.assetId);

    // Update user_activity (streak + badges)
    const todayStr = todayUtc();
    const activityRow = await this.db.one<Record<string, unknown>>(
      'SELECT * FROM app.user_activity WHERE user_id = $1',
      [user.userId],
    );

    let totalVotes = 1;
    let streakDays = 1;
    let longestStreak = 1;
    let badges: string[] = [];

    if (activityRow) {
      totalVotes = Number(activityRow.total_votes) + 1;
      const streak = nextStreak(
        activityRow.last_vote_date
          ? String(activityRow.last_vote_date)
          : null,
        todayStr,
      );
      const currentStreak = Number(activityRow.current_streak_days);
      if (streak.streakDelta === 'continue') {
        streakDays = currentStreak + 1;
      } else if (streak.streakDelta === 'same_day') {
        streakDays = currentStreak;
      } else {
        streakDays = 1;
      }
      longestStreak = Math.max(
        Number(activityRow.longest_streak_days),
        streakDays,
      );
      badges = Array.isArray(activityRow.badges)
        ? (activityRow.badges as string[])
        : (JSON.parse(String(activityRow.badges ?? '[]')) as string[]);
    }

    const newBadges = earnedBadges(totalVotes, streakDays, badges);
    const allBadges = [...badges, ...newBadges];

    await this.db.query(
      `INSERT INTO app.user_activity (
         user_id, email, total_votes, current_streak_days,
         longest_streak_days, last_vote_date, badges
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::text[])
       ON CONFLICT (user_id) DO UPDATE SET
         total_votes = $3,
         current_streak_days = $4,
         longest_streak_days = $5,
         last_vote_date = $6,
         badges = $7::text[]`,
      [
        user.userId,
        user.email,
        totalVotes,
        streakDays,
        longestStreak,
        todayStr,
        allBadges, // user_activity.badges is TEXT[]; pg serialises JS arrays natively
      ],
    );

    // Events
    const campaignIds = campaignId ? [campaignId] : [];
    this.events.emit({
      type: 'vote.recorded',
      assetId: body.assetId,
      userId: user.userId,
      voteType: body.voteType as VoteType,
      campaignIds,
    });

    for (const badge of newBadges) {
      this.events.emit({
        type: 'vote.milestone',
        userId: user.userId,
        badge,
      });
    }

    // Certification transition
    const newStatus = deriveStatus(
      confidence.confidence,
      confidence.totalVotes,
      settings,
    );
    if (newStatus === 'CERTIFIED' && asset.status !== 'CERTIFIED') {
      this.events.emit({
        type: 'asset.certified',
        assetId: body.assetId,
      });
    }

    // Build vote DTO
    const vote = {
      id: String(voteRow!.id),
      assetId: String(voteRow!.asset_id),
      userId: String(voteRow!.user_id),
      voteType: String(voteRow!.vote_type) as VoteType,
      source: String(voteRow!.source) as VoteSource,
      feedback: voteRow!.feedback ? String(voteRow!.feedback) : null,
      editDescription: voteRow!.edit_description
        ? String(voteRow!.edit_description)
        : null,
      editPlainEnglishLogic: voteRow!.edit_plain_english_logic
        ? String(voteRow!.edit_plain_english_logic)
        : null,
      editDisplayName: voteRow!.edit_display_name
        ? String(voteRow!.edit_display_name)
        : null,
      createdAt: String(voteRow!.created_at),
    };

    // Fetch next card
    const next = await this.getNext(user, {});

    return { vote, confidence, assetStatus: newStatus, next };
  }

  // ── skip ────────────────────────────────────────────────────────────────

  /**
   * Record a skip (plan 25/33). A skip is NOT a vote: it inserts
   * app.review_skips (with the asset's current version_hash) and bumps
   * user_activity.total_skips / last_skip_at. It never touches app.votes,
   * app.confidence_scores, Wilson inputs, streaks, badges, campaign_assets
   * or certification, and emits no vote events.
   */
  async skip(
    user: UserContext,
    req: SkipRequest,
    source: VoteSource = user.source,
  ): Promise<SkipResponse> {
    const assetRow = await this.db.one<{ version_hash: string | null }>(
      'SELECT version_hash FROM app.assets WHERE id = $1',
      [req.assetId],
    );
    if (!assetRow) throw notFound(`Asset not found: ${req.assetId}`);

    if (req.campaignId) {
      const campaignRow = await this.db.one<{ id: string }>(
        'SELECT id FROM app.campaigns WHERE id = $1',
        [req.campaignId],
      );
      if (!campaignRow) throw notFound(`Campaign not found: ${req.campaignId}`);
    }

    const row = await this.db.one<Record<string, unknown>>(
      `INSERT INTO app.review_skips (
         user_id, asset_id, campaign_id, reason, version_hash, source
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user.userId,
        req.assetId,
        req.campaignId ?? null,
        req.reason ?? null,
        assetRow.version_hash ?? null,
        source,
      ],
    );
    if (!row) throw new Error('INSERT INTO app.review_skips returned no row');

    // Activity row: skip counters only (vote totals and streaks untouched).
    await this.db.query(
      `INSERT INTO app.user_activity (user_id, email, total_skips, last_skip_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         total_skips = app.user_activity.total_skips + 1,
         last_skip_at = NOW(),
         updated_at = NOW()`,
      [user.userId, user.email],
    );

    const stats = await this.getSkipStats(user.userId);
    return { skip: rowToReviewSkip(row), stats };
  }

  /** Skip counts for one user (all time, and since 00:00 UTC today). */
  async getSkipStats(userId: string): Promise<SkipStats> {
    const row = await this.db.one<{ skipped_count: number | string; skipped_today: number | string }>(
      `SELECT
         COUNT(*)::int AS skipped_count,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW(), 'UTC'))::int AS skipped_today
       FROM app.review_skips
       WHERE user_id = $1`,
      [userId],
    );
    return {
      skippedCount: Number(row?.skipped_count ?? 0),
      skippedToday: Number(row?.skipped_today ?? 0),
    };
  }

  // ── recompute ──────────────────────────────────────────────────────

  async recompute(assetId: string): Promise<ConfidenceScore> {
    const settings = await this.config.get();

    // Read version_hash directly from DB
    const hashRow = await this.db.one<{ version_hash: string }>(
      'SELECT version_hash FROM app.assets WHERE id = $1',
      [assetId],
    );
    if (!hashRow) throw notFound(`Asset not found: ${assetId}`);
    const versionHash = hashRow.version_hash ?? '';

    // Count by vote_type at current version
    const rows = await this.db.query<{ vote_type: string; cnt: string }>(
      `SELECT vote_type, COUNT(*)::text AS cnt
       FROM app.votes
       WHERE asset_id = $1 AND version_hash = $2
       GROUP BY vote_type`,
      [assetId, versionHash],
    );

    let approvals = 0;
    let rejections = 0;
    let edits = 0;
    for (const r of rows) {
      if (r.vote_type === 'approve') approvals = Number(r.cnt);
      else if (r.vote_type === 'reject') rejections = Number(r.cnt);
      else if (r.vote_type === 'edit') edits = Number(r.cnt);
    }

    const result = computeConfidence(
      { approvals, rejections, edits },
      settings,
    );
    const totalVotes = approvals + rejections + edits;

    // Wilson upper bound
    const p = totalVotes > 0 ? (approvals + 0.5 * edits) / totalVotes : 0;
    const z = settings.wilsonZ;
    const z2 = z * z;
    const upper =
      totalVotes > 0
        ? Math.min(
            1,
            (p +
              z2 / (2 * totalVotes) +
              z *
                Math.sqrt(
                  (p * (1 - p) + z2 / (4 * totalVotes)) / totalVotes,
                )) /
              (1 + z2 / totalVotes),
          )
        : 0;

    const now = new Date().toISOString();
    const lastVoteRow = await this.db.one<{ last_at: string }>(
      `SELECT MAX(created_at)::text AS last_at
       FROM app.votes WHERE asset_id = $1`,
      [assetId],
    );

    const confidence: ConfidenceScore = {
      assetId,
      totalVotes,
      approvals,
      rejections,
      edits,
      wilsonLower: result.score,
      wilsonUpper: upper,
      confidence: result.score,
      lastVoteAt: lastVoteRow?.last_at ?? null,
      computedAt: now,
    };

    // Upsert confidence_scores
    await this.db.query(
      `INSERT INTO app.confidence_scores (
         asset_id, total_votes, approvals, rejections, edits,
         wilson_lower, wilson_upper, confidence,
         last_vote_at, computed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (asset_id) DO UPDATE SET
         total_votes = $2, approvals = $3, rejections = $4, edits = $5,
         wilson_lower = $6, wilson_upper = $7, confidence = $8,
         last_vote_at = $9, computed_at = $10`,
      [
        assetId,
        totalVotes,
        approvals,
        rejections,
        edits,
        result.score,
        upper,
        result.score,
        lastVoteRow?.last_at ?? null,
        now,
      ],
    );

    // Update asset status
    const newStatus = deriveStatus(result.score, totalVotes, settings);
    await this.assets.updateStatus(assetId, newStatus);

    return confidence;
  }

  // ── getUserStats ───────────────────────────────────────────────────

  async getUserStats(userId: string): Promise<UserStats> {
    const row = await this.db.one<Record<string, unknown>>(
      'SELECT * FROM app.user_activity WHERE user_id = $1',
      [userId],
    );

    const skipStats = await this.getSkipStats(userId);

    if (!row) {
      return {
        totalVotes: 0,
        approvals: 0,
        rejections: 0,
        edits: 0,
        ...skipStats,
        currentStreakDays: 0,
        rank: 0,
        coveragePct: 0,
      };
    }

    // Vote breakdown
    const breakdown = await this.db.query<{
      vote_type: string;
      cnt: string;
    }>(
      `SELECT vote_type, COUNT(*)::text AS cnt
       FROM app.votes WHERE user_id = $1
       GROUP BY vote_type`,
      [userId],
    );

    let approvals = 0;
    let rejections = 0;
    let edits = 0;
    for (const r of breakdown) {
      if (r.vote_type === 'approve') approvals = Number(r.cnt);
      else if (r.vote_type === 'reject') rejections = Number(r.cnt);
      else if (r.vote_type === 'edit') edits = Number(r.cnt);
    }

    // Rank (number of users with more votes + 1)
    const rankRow = await this.db.one<{ rank: string }>(
      `SELECT COUNT(*)::text AS rank FROM app.user_activity
       WHERE total_votes > (
         SELECT COALESCE(total_votes, 0)
         FROM app.user_activity WHERE user_id = $1
       )`,
      [userId],
    );
    const rank = Number(rankRow?.rank ?? 0) + 1;

    // Coverage
    const totalAssets = await this.db.one<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app.assets',
    );
    const userAssets = await this.db.one<{ count: string }>(
      `SELECT COUNT(DISTINCT asset_id)::text AS count
       FROM app.votes WHERE user_id = $1`,
      [userId],
    );
    const total = Number(totalAssets?.count ?? 0);
    const coveragePct =
      total > 0
        ? Math.round(
            (Number(userAssets?.count ?? 0) / total) * 10000,
          ) / 100
        : 0;

    return {
      totalVotes: Number(row.total_votes),
      approvals,
      rejections,
      edits,
      ...skipStats,
      currentStreakDays: Number(row.current_streak_days),
      rank,
      coveragePct,
    };
  }

  // ── getLeaderboard ─────────────────────────────────────────────────

  async getLeaderboard(
    period: '7d' | '30d' | 'all' = '7d',
    limit = 20,
  ): Promise<LeaderboardEntry[]> {
    let dateFilter = '';
    let skipDateFilter = '';
    if (period === '7d') {
      dateFilter = `AND v.created_at >= NOW() - INTERVAL '7 days'`;
      skipDateFilter = `AND rs.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === '30d') {
      dateFilter = `AND v.created_at >= NOW() - INTERVAL '30 days'`;
      skipDateFilter = `AND rs.created_at >= NOW() - INTERVAL '30 days'`;
    }

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT
         v.user_id,
         ua.email,
         COALESCE(ua.email, v.user_id) AS display_name,
         COUNT(*)::int AS total_votes,
         COUNT(*) FILTER (WHERE v.vote_type = 'approve')::int AS approvals,
         COUNT(*) FILTER (WHERE v.vote_type = 'reject')::int AS rejections,
         COUNT(*) FILTER (WHERE v.vote_type = 'edit')::int AS edits,
         COALESCE(ua.current_streak_days, 0)::int AS current_streak_days,
         (SELECT COUNT(*) FROM app.review_skips rs
          WHERE rs.user_id = v.user_id ${skipDateFilter})::int AS skipped_count,
         ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC)::int AS rank
       FROM app.votes v
       LEFT JOIN app.user_activity ua ON ua.user_id = v.user_id
       WHERE TRUE ${dateFilter}
       GROUP BY v.user_id, ua.email, ua.current_streak_days
       ORDER BY total_votes DESC
       LIMIT $1`,
      [limit],
    );

    return rows.map((r) => ({
      userId: String(r.user_id),
      email: String(r.email ?? ''),
      displayName: String(r.display_name ?? ''),
      totalVotes: Number(r.total_votes),
      approvals: Number(r.approvals),
      rejections: Number(r.rejections),
      edits: Number(r.edits),
      skippedCount: Number(r.skipped_count ?? 0),
      currentStreakDays: Number(r.current_streak_days),
      rank: Number(r.rank),
    }));
  }

  // ── getExecutiveSummary ─────────────────────────────────────────────

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const row = await this.db.one<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*)::int FROM app.assets) AS total_assets,
         (SELECT COUNT(*)::int FROM app.assets
          WHERE status IN ('REVIEWED', 'CERTIFIED')) AS reviewed_assets,
         (SELECT COUNT(*)::int FROM app.assets
          WHERE status = 'CERTIFIED') AS certified_assets,
         (SELECT COUNT(DISTINCT user_id)::int FROM app.votes
          WHERE created_at >= NOW() - INTERVAL '7 days') AS active_reviewers_7d,
         (SELECT COUNT(*)::int FROM app.votes
          WHERE created_at >= NOW() - INTERVAL '7 days') AS votes_7d,
         (SELECT COUNT(*)::int FROM app.campaigns
          WHERE status = 'active') AS active_campaigns`,
    );

    const totalAssets = Number(row?.total_assets ?? 0);
    const reviewedAssets = Number(row?.reviewed_assets ?? 0);
    const certifiedAssets = Number(row?.certified_assets ?? 0);

    return {
      totalAssets,
      reviewedAssets,
      certifiedAssets,
      coveragePct:
        totalAssets > 0
          ? Math.round((reviewedAssets / totalAssets) * 10000) / 100
          : 0,
      certificationPct:
        totalAssets > 0
          ? Math.round((certifiedAssets / totalAssets) * 10000) / 100
          : 0,
      activeReviewers7d: Number(row?.active_reviewers_7d ?? 0),
      votes7d: Number(row?.votes_7d ?? 0),
      activeCampaigns: Number(row?.active_campaigns ?? 0),
    };
  }

  // ── runQuery ────────────────────────────────────────────────────────

  async runQuery(
    user: UserContext,
    assetId: string,
  ): Promise<QueryResult> {
    const asset = await this.assets.get(assetId);
    const sql = buildValidationQuery(asset);
    if (!sql) {
      throw badRequest('No validation query for this asset');
    }
    return this.metricViews.runAssetQuery(user, sql);
  }

  // ── private helpers ─────────────────────────────────────────────────

  private async readConfidence(
    assetId: string,
  ): Promise<ConfidenceScore | null> {
    const r = await this.db.one<Record<string, unknown>>(
      'SELECT * FROM app.confidence_scores WHERE asset_id = $1',
      [assetId],
    );
    if (!r) return null;
    return {
      assetId: String(r.asset_id),
      totalVotes: Number(r.total_votes),
      approvals: Number(r.approvals),
      rejections: Number(r.rejections),
      edits: Number(r.edits),
      wilsonLower: Number(r.wilson_lower),
      wilsonUpper: Number(r.wilson_upper),
      confidence: Number(r.confidence),
      lastVoteAt: r.last_vote_at ? String(r.last_vote_at) : null,
      computedAt: String(r.computed_at),
    };
  }
}
