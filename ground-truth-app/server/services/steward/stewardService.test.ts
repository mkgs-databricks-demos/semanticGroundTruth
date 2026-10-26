// server/services/steward/stewardService.test.ts — conflict detection, resolution, feedback branches
// Session 33 · Wave 4-1 · Vitest with a mocked Db

import { describe, it, expect, vi } from 'vitest';
import { StewardService, detectConflicts, resolutionFor, rowToFeedbackBranch } from './stewardService';
import type { TriageVoteRow } from './stewardService';
import type { ServiceDeps } from '../../lib/deps';
import type { NotificationService } from '../notification';
import type { UserContext } from '../../lib/context';

const ASSET = '550e8400-e29b-41d4-a716-446655440000';
const ASSET_B = '550e8400-e29b-41d4-a716-446655440001';
const BATCH = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const STEWARD: UserContext = {
  userId: 'steward-1',
  email: 's@example.com',
  displayName: 'S',
  source: 'web',
  roles: ['reviewer', 'steward'],
};

function vote(p: Partial<TriageVoteRow> & Pick<TriageVoteRow, 'id' | 'voteType'>): TriageVoteRow {
  return {
    assetId: ASSET,
    displayName: 'Revenue',
    userId: `user-${p.id}`,
    editDescription: null,
    editPlainEnglishLogic: null,
    editDisplayName: null,
    createdAt: '2026-10-24T18:00:00.000Z',
    ...p,
  };
}

function toDbRow(v: TriageVoteRow): Record<string, unknown> {
  return {
    id: v.id,
    asset_id: v.assetId,
    user_id: v.userId,
    vote_type: v.voteType,
    edit_description: v.editDescription,
    edit_plain_english_logic: v.editPlainEnglishLogic,
    edit_display_name: v.editDisplayName,
    created_at: v.createdAt,
    display_name: v.displayName,
    name: 'revenue',
  };
}

type Route = [RegExp, (params: unknown[]) => Record<string, unknown>[]];

function makeService(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const run = (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const hit = routes.find(([re]) => re.test(sql));
    return hit ? hit[1](params) : [];
  };
  const db = {
    query: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)),
    one: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)[0] ?? null),
    tx: vi.fn(),
  };
  const notifications = { notify: vi.fn(async () => {}) };
  const svc = new StewardService(
    { db } as unknown as ServiceDeps,
    notifications as unknown as NotificationService,
  );
  return { svc, calls, notifications };
}

// ── detectConflicts ──

describe('detectConflicts', () => {
  it('flags two different edits to the same field', () => {
    const groups = detectConflicts([
      vote({ id: 'v1', voteType: 'edit', editDescription: 'Net revenue' }),
      vote({ id: 'v2', voteType: 'edit', editDescription: 'Gross revenue' }),
      vote({ id: 'v3', voteType: 'approve' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ assetId: ASSET, rejectCount: 0, approveCount: 1 });
    expect(groups[0].edits.map((e) => [e.voteId, e.field])).toEqual([
      ['v1', 'description'],
      ['v2', 'description'],
    ]);
  });

  it('flags an edit plus a reject', () => {
    const groups = detectConflicts([
      vote({ id: 'v1', voteType: 'edit', editDisplayName: 'Revenue (net)' }),
      vote({ id: 'v2', voteType: 'reject' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rejectCount).toBe(1);
  });

  it('does not flag matching edits (whitespace ignored) or edits to different fields', () => {
    expect(detectConflicts([
      vote({ id: 'v1', voteType: 'edit', editDescription: 'Net revenue' }),
      vote({ id: 'v2', voteType: 'edit', editDescription: '  Net revenue ' }),
    ])).toEqual([]);
    expect(detectConflicts([
      vote({ id: 'v1', voteType: 'edit', editDescription: 'Net revenue' }),
      vote({ id: 'v2', voteType: 'edit', editDisplayName: 'Revenue' }),
    ])).toEqual([]);
  });

  it('groups per asset', () => {
    const groups = detectConflicts([
      vote({ id: 'v1', voteType: 'edit', editDescription: 'a' }),
      vote({ id: 'v2', voteType: 'edit', editDescription: 'b' }),
      vote({ id: 'v3', assetId: ASSET_B, voteType: 'edit', editDescription: 'c' }),
    ]);
    expect(groups.map((g) => g.assetId)).toEqual([ASSET]);
  });
});

describe('resolutionFor', () => {
  it('accepted edit gets accept_edit, every other vote reject_all', () => {
    expect(resolutionFor({ resolution: 'accept_edit', voteId: 'v1' }, 'v1')).toBe('accept_edit');
    expect(resolutionFor({ resolution: 'accept_edit', voteId: 'v1' }, 'v2')).toBe('reject_all');
  });
  it('keep_current / reject_all apply to every vote', () => {
    expect(resolutionFor({ resolution: 'keep_current' }, 'v9')).toBe('keep_current');
    expect(resolutionFor({ resolution: 'reject_all' }, 'v9')).toBe('reject_all');
  });
});

// ── resolveConflict ──

const conflicting = [
  vote({ id: 'v1', voteType: 'edit', userId: 'alice', editDescription: 'Net revenue' }),
  vote({ id: 'v2', voteType: 'edit', userId: 'bob', editDescription: 'Gross revenue' }),
  vote({ id: 'v3', voteType: 'approve', userId: 'carol' }),
];

function resolveRoutes(votes: TriageVoteRow[], updated: (params: unknown[]) => Record<string, unknown>[]): Route[] {
  return [
    [/SELECT id, display_name, name FROM app\.assets/, () => [{ id: ASSET, display_name: 'Revenue', name: 'revenue' }]],
    [/UPDATE app\.votes v/, updated],
    [/FROM app\.votes v\s+JOIN app\.assets a/, () => votes.map(toDbRow)],
  ];
}

describe('StewardService.resolveConflict', () => {
  it('accept_edit writes per-vote resolutions and notifies the edit authors', async () => {
    const { svc, calls, notifications } = makeService(resolveRoutes(conflicting, (p) =>
      (p[0] as string[]).map((id) => ({ id, resolved_at: new Date('2026-10-24T19:00:00Z') }))));

    const res = await svc.resolveConflict(STEWARD, ASSET, { resolution: 'accept_edit', voteId: 'v2', note: 'gross is right' });

    expect(res).toEqual({
      assetId: ASSET,
      resolution: 'accept_edit',
      resolvedVotes: 2,
      resolvedBy: 'steward-1',
      resolvedAt: '2026-10-24T19:00:00.000Z',
    });
    const update = calls.find((c) => /UPDATE app\.votes v/.test(c.sql))!;
    // Approve votes are not part of the conflict group.
    expect(update.params).toEqual([['v1', 'v2'], ['reject_all', 'accept_edit'], 'steward-1']);
    expect(update.sql).toMatch(/v\.resolution IS NULL/);
    // The asset itself is never rewritten here.
    expect(calls.some((c) => /UPDATE app\.assets/.test(c.sql))).toBe(false);
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(notifications.notify.mock.calls.map((c) => (c as unknown[])[0])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientType: 'user', recipientId: 'alice' }),
        expect.objectContaining({ recipientType: 'user', recipientId: 'bob' }),
      ]),
    );
  });

  it('404s an accept_edit voteId that is not an unresolved edit on the asset', async () => {
    const { svc, calls } = makeService(resolveRoutes(conflicting, () => []));
    await expect(
      svc.resolveConflict(STEWARD, ASSET, { resolution: 'accept_edit', voteId: 'v3' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls.some((c) => /UPDATE app\.votes/.test(c.sql))).toBe(false);
  });

  it('409s when the asset has no conflict', async () => {
    const { svc } = makeService(resolveRoutes([conflicting[0], conflicting[2]], () => []));
    await expect(
      svc.resolveConflict(STEWARD, ASSET, { resolution: 'keep_current' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('409s when another steward resolved it first (0 rows updated)', async () => {
    const { svc, notifications } = makeService(resolveRoutes(conflicting, () => []));
    await expect(
      svc.resolveConflict(STEWARD, ASSET, { resolution: 'keep_current' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('404s an unknown asset', async () => {
    const { svc } = makeService([]);
    await expect(
      svc.resolveConflict(STEWARD, ASSET, { resolution: 'reject_all' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// ── feedback branches ──

const batchRow = (over: Record<string, unknown> = {}) => ({
  id: BATCH,
  triggered_by: 'sp-feedback',
  branch_name: 'mg-genie-feedback-20261024',
  status: 'proposed',
  asset_count: 3,
  files: ['fixtures/metrics/revenue.yml'],
  summary: '3 assets',
  created_at: new Date('2026-10-24T18:00:00Z'),
  completed_at: new Date('2026-10-24T18:05:00Z'),
  reviewed_by: null,
  ...over,
});

describe('rowToFeedbackBranch', () => {
  it('maps JSONB files given as an array or a JSON string', () => {
    expect(rowToFeedbackBranch(batchRow()).files).toEqual(['fixtures/metrics/revenue.yml']);
    expect(rowToFeedbackBranch(batchRow({ files: '["a.yml","b.yml"]' })).files).toEqual(['a.yml', 'b.yml']);
    expect(rowToFeedbackBranch(batchRow({ files: null })).files).toEqual([]);
  });
});

describe('StewardService.upsertFeedbackBranch', () => {
  const req = {
    branchName: 'mg-genie-feedback-20261024',
    files: ['fixtures/metrics/revenue.yml'],
    summary: '3 assets',
    status: 'proposed' as const,
  };

  it('inserts a new branch and notifies all stewards in-app', async () => {
    const { svc, calls, notifications } = makeService([
      [/INSERT INTO app\.feedback_batches/, () => [batchRow()]],
    ]);
    const { branch, created } = await svc.upsertFeedbackBranch(STEWARD, req);
    expect(created).toBe(true);
    expect(branch).toMatchObject({ batchId: BATCH, branchName: req.branchName, status: 'proposed' });
    const insert = calls.find((c) => /INSERT INTO app\.feedback_batches/.test(c.sql))!;
    expect(insert.params[2]).toBe(JSON.stringify(req.files));
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'feedback.branch_ready',
      recipientType: 'role',
      recipientId: 'steward',
    }));
  });

  it('updates an existing branch by name (created false)', async () => {
    const { svc, calls } = makeService([
      [/SELECT id FROM app\.feedback_batches WHERE branch_name/, () => [{ id: BATCH }]],
      [/UPDATE app\.feedback_batches/, () => [batchRow()]],
    ]);
    const { created } = await svc.upsertFeedbackBranch(STEWARD, req);
    expect(created).toBe(false);
    expect(calls.some((c) => /INSERT INTO app\.feedback_batches/.test(c.sql))).toBe(false);
  });

  it('sends feedback.failed for a failed run and nothing for pending', async () => {
    const failed = makeService([[/INSERT INTO app\.feedback_batches/, () => [batchRow({ status: 'failed' })]]]);
    await failed.svc.upsertFeedbackBranch(STEWARD, { ...req, status: 'failed' });
    expect(failed.notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'feedback.failed' }));

    const pending = makeService([[/INSERT INTO app\.feedback_batches/, () => [batchRow({ status: 'pending' })]]]);
    await pending.svc.upsertFeedbackBranch(STEWARD, { ...req, status: 'pending' });
    expect(pending.notifications.notify).not.toHaveBeenCalled();
  });

  it('404s an unknown batchId', async () => {
    const { svc } = makeService([]);
    await expect(svc.upsertFeedbackBranch(STEWARD, { ...req, batchId: BATCH })).rejects.toMatchObject({ status: 404 });
  });

  const VOTES = ['644eff17-327b-4a18-9563-68ebc160dd81', '4f81557c-0000-4000-8000-000000000001'];

  it('marks voteIds processed for a proposed branch (unprocessed only)', async () => {
    const { svc, calls } = makeService([
      [/INSERT INTO app\.feedback_batches/, () => [batchRow()]],
      [/UPDATE app\.votes SET is_processed = TRUE/, () => [{ id: VOTES[0] }]],
    ]);
    await svc.upsertFeedbackBranch(STEWARD, { ...req, voteIds: VOTES });
    const mark = calls.find((c) => /UPDATE app\.votes/.test(c.sql))!;
    expect(mark.sql).toMatch(/NOT is_processed/);
    expect(mark.params).toEqual([VOTES]);
    // after the branch row exists
    expect(calls.findIndex((c) => /INSERT INTO app\.feedback_batches/.test(c.sql)))
      .toBeLessThan(calls.indexOf(mark));
  });

  it('leaves votes unprocessed for failed or pending runs and when voteIds is empty', async () => {
    for (const [status, voteIds] of [['failed', VOTES], ['pending', VOTES], ['proposed', []]] as const) {
      const { svc, calls } = makeService([[/INSERT INTO app\.feedback_batches/, () => [batchRow({ status })]]]);
      await svc.upsertFeedbackBranch(STEWARD, { ...req, status, voteIds: [...voteIds] });
      expect(calls.some((c) => /UPDATE app\.votes/.test(c.sql))).toBe(false);
    }
  });
});

describe('StewardService.updateFeedbackBranchStatus', () => {
  it('moves a proposed branch to merged and records the reviewer', async () => {
    const { svc, calls } = makeService([
      [/SELECT status FROM app\.feedback_batches/, () => [{ status: 'proposed' }]],
      [/UPDATE app\.feedback_batches/, () => [batchRow({ status: 'merged', reviewed_by: 'steward-1' })]],
    ]);
    const branch = await svc.updateFeedbackBranchStatus(STEWARD, BATCH, { status: 'merged' });
    expect(branch).toMatchObject({ status: 'merged', reviewedBy: 'steward-1' });
    const update = calls.find((c) => /UPDATE app\.feedback_batches/.test(c.sql))!;
    expect(update.params.slice(0, 3)).toEqual([BATCH, 'merged', 'steward-1']);
  });

  it('409s for a pending / failed / already merged branch', async () => {
    for (const status of ['pending', 'failed', 'merged', 'rejected']) {
      const { svc } = makeService([[/SELECT status FROM app\.feedback_batches/, () => [{ status }]]]);
      await expect(
        svc.updateFeedbackBranchStatus(STEWARD, BATCH, { status: 'in_review' }),
        status,
      ).rejects.toMatchObject({ status: 409 });
    }
  });

  it('404s an unknown batch', async () => {
    const { svc } = makeService([]);
    await expect(svc.updateFeedbackBranchStatus(STEWARD, BATCH, { status: 'merged' })).rejects.toMatchObject({ status: 404 });
  });
});

// ── feedback queue / conflicts SQL ──

describe('StewardService.feedbackQueue', () => {
  it('maps rows and filters pending + campaign with bound parameters', async () => {
    const { svc, calls } = makeService([
      [/WITH va AS/, () => [{
        asset_id: ASSET, display_name: 'Revenue', name: 'revenue', asset_type: 'measure',
        campaign_id: null, approve: 2, reject: 1, edit: 1, pending_edits: 1, skips: 4,
        last_activity_at: new Date('2026-10-24T18:00:00Z'), total_count: 7,
      }]],
    ]);
    const page = await svc.feedbackQueue({ status: 'pending', limit: 10, offset: 0, campaignId: BATCH, assetType: 'measure' });
    expect(page).toEqual({
      items: [{
        assetId: ASSET, displayName: 'Revenue', assetType: 'measure', campaignId: null,
        votes: { approve: 2, reject: 1, edit: 1 }, skips: 4, pendingEdits: 1,
        lastActivityAt: '2026-10-24T18:00:00.000Z',
      }],
      total: 7, limit: 10, offset: 0,
    });
    const q = calls[0];
    expect(q.sql).toMatch(/COALESCE\(va\.unprocessed, 0\) > 0/);
    expect(q.params).toEqual([BATCH, 'measure', 10, 0]);
    expect(q.sql).not.toContain(BATCH);
  });

  it("status 'all' drops the pending filter", async () => {
    const { svc, calls } = makeService([]);
    await svc.feedbackQueue({ status: 'all', limit: 50, offset: 0 });
    expect(calls[0].sql).not.toMatch(/unprocessed, 0\) > 0/);
  });
});

describe('StewardService.conflicts', () => {
  it('reads unresolved votes and returns conflict groups', async () => {
    const { svc, calls } = makeService([
      [/FROM app\.votes v\s+JOIN app\.assets a/, () => conflicting.map(toDbRow)],
    ]);
    const groups = await svc.conflicts({ assetType: 'measure' });
    expect(groups).toHaveLength(1);
    expect(calls[0].sql).toMatch(/v\.resolution IS NULL/);
    expect(calls[0].params).toEqual(['measure']);
  });
});
