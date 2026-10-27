// server/routes/skipSettingsSteward.test.ts — route behaviour for plan 33 (skip, settings, steward RBAC)
// Session 33 · Wave 4-1 · Vitest with stubbed services (no DB, no Express)

import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { Services } from '../services';
import { findRoute, invoke, makeUser, recordRoutes } from '../lib/testing/routeHarness';
import { RESURFACED_FROM_SKIP_HEADER } from './review';

const ASSET = '550e8400-e29b-41d4-a716-446655440000';
const CAMPAIGN = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const BATCH = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const reviewer = makeUser(['reviewer']);
const steward = makeUser(['reviewer', 'steward']);
const admin = makeUser(['reviewer', 'steward', 'admin']);

function makeServices() {
  return {
    db: { query: vi.fn(async () => []), one: vi.fn(async () => null) },
    review: {
      submitVote: vi.fn(async () => ({ vote: {}, confidence: {} })),
      skip: vi.fn(async () => ({ skip: { id: 'skip-1' }, stats: { skippedCount: 1, skippedToday: 1 } })),
      getNextWithMeta: vi.fn(async () => ({ card: null, resurfacedFromSkip: false })),
      getUserStats: vi.fn(async () => ({ skippedCount: 2, skippedToday: 1 })),
    },
    settings: {
      get: vi.fn(async () => ({ theme: 'system' })),
      update: vi.fn(async (_u: string, patch: object) => ({ theme: 'dark', ...patch })),
    },
    steward: {
      feedbackQueue: vi.fn(async () => ({ items: [], total: 0, limit: 50, offset: 0 })),
      conflicts: vi.fn(async () => []),
      resolveConflict: vi.fn(async () => ({ assetId: ASSET, resolution: 'keep_current', resolvedVotes: 2 })),
      listFeedbackBranches: vi.fn(async () => []),
      upsertFeedbackBranch: vi.fn(async () => ({ branch: { batchId: BATCH }, created: true })),
      updateFeedbackBranchStatus: vi.fn(async () => ({ batchId: BATCH, status: 'merged' })),
    },
  };
}

let stubs: ReturnType<typeof makeServices>;
let routes: ReturnType<typeof recordRoutes>;

beforeEach(() => {
  stubs = makeServices();
  routes = recordRoutes(stubs as unknown as Services);
});

const route = (method: string, path: string) => findRoute(routes, method, path);

describe('POST /api/review/vote', () => {
  it("rejects voteType 'skip' with 400 pointing at the skip endpoint", async () => {
    const res = await invoke(route('POST', '/api/review/vote'), {
      user: reviewer,
      body: { assetId: ASSET, voteType: 'skip' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(JSON.stringify(res.body)).toContain('/api/review/skip');
    expect(stubs.review.submitVote).not.toHaveBeenCalled();
  });

  it('passes approve votes through to submitVote', async () => {
    const res = await invoke(route('POST', '/api/review/vote'), {
      user: reviewer,
      body: { assetId: ASSET, voteType: 'approve' },
    });
    expect(res.status).toBe(200);
    expect(stubs.review.submitVote).toHaveBeenCalledOnce();
  });
});

describe('POST /api/review/skip', () => {
  it('records a skip (201) via ReviewEngine.skip and never calls submitVote', async () => {
    const res = await invoke(route('POST', '/api/review/skip'), {
      user: reviewer,
      body: { assetId: ASSET, campaignId: CAMPAIGN, reason: 'not_sure' },
    });
    expect(res.status).toBe(201);
    expect(stubs.review.skip).toHaveBeenCalledWith(
      reviewer,
      { assetId: ASSET, campaignId: CAMPAIGN, reason: 'not_sure' },
      'web',
    );
    expect(stubs.review.submitVote).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-uuid assetId or unknown reason', async () => {
    for (const body of [{ assetId: 'nope' }, { assetId: ASSET, reason: 'bored' }]) {
      const res = await invoke(route('POST', '/api/review/skip'), { user: reviewer, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(stubs.review.skip).not.toHaveBeenCalled();
  });

  it('returns 401 without an identity', async () => {
    const res = await invoke(route('POST', '/api/review/skip'), { body: { assetId: ASSET } });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/review/next', () => {
  it('flags a resurfaced skipped card with a response header', async () => {
    stubs.review.getNextWithMeta.mockResolvedValueOnce({
      card: { asset: { id: ASSET } },
      resurfacedFromSkip: true,
    } as never);
    const res = await invoke(route('GET', '/api/review/next'), { user: reviewer });
    expect(res.status).toBe(200);
    expect(res.headers[RESURFACED_FROM_SKIP_HEADER]).toBe('true');
  });

  it('sets no header for a normal card', async () => {
    stubs.review.getNextWithMeta.mockResolvedValueOnce({
      card: { asset: { id: ASSET } },
      resurfacedFromSkip: false,
    } as never);
    const res = await invoke(route('GET', '/api/review/next'), { user: reviewer });
    expect(res.headers[RESURFACED_FROM_SKIP_HEADER]).toBeUndefined();
  });
});

describe('GET|PUT /api/me/settings', () => {
  it('GET returns the service result for the caller', async () => {
    const res = await invoke(route('GET', '/api/me/settings'), { user: reviewer });
    expect(res.status).toBe(200);
    expect(stubs.settings.get).toHaveBeenCalledWith(reviewer.userId);
  });

  it('PUT applies a partial update', async () => {
    const res = await invoke(route('PUT', '/api/me/settings'), {
      user: reviewer,
      body: { density: 'compact' },
    });
    expect(res.status).toBe(200);
    expect(stubs.settings.update).toHaveBeenCalledWith(reviewer.userId, { density: 'compact' });
  });

  it('PUT rejects an empty body, unknown keys and out-of-range values', async () => {
    for (const body of [{}, { colour: 'red' }, { cardsPerSession: 1000 }, { theme: 'neon' }]) {
      const res = await invoke(route('PUT', '/api/me/settings'), { user: reviewer, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(stubs.settings.update).not.toHaveBeenCalled();
  });
});

describe('steward routes RBAC', () => {
  const stewardRoutes: [string, string, { body?: unknown; params?: Record<string, string> }][] = [
    ['GET', '/api/steward/feedback-queue', {}],
    ['GET', '/api/steward/conflicts', {}],
    ['POST', '/api/steward/conflicts/:assetId/resolve', { params: { assetId: ASSET }, body: { resolution: 'keep_current' } }],
    ['GET', '/api/steward/feedback-branches', {}],
    ['POST', '/api/steward/feedback-branches/:batchId/status', { params: { batchId: BATCH }, body: { status: 'merged' } }],
  ];

  for (const [method, path, input] of stewardRoutes) {
    it(`${method} ${path}: reviewer 403, steward 2xx`, async () => {
      const denied = await invoke(route(method, path), { user: reviewer, ...input });
      expect(denied.status).toBe(403);
      const allowed = await invoke(route(method, path), { user: steward, ...input });
      expect(allowed.status).toBeLessThan(300);
    });
  }

  it('POST /api/steward/feedback-branches is admin only (feedback job M2M)', async () => {
    const body = { branchName: 'mg-genie-feedback-20261024', files: ['a.yml'], status: 'proposed' };
    const denied = await invoke(route('POST', '/api/steward/feedback-branches'), { user: steward, body });
    expect(denied.status).toBe(403);
    const created = await invoke(route('POST', '/api/steward/feedback-branches'), { user: admin, body });
    expect(created.status).toBe(201);
    stubs.steward.upsertFeedbackBranch.mockResolvedValueOnce({ branch: { batchId: BATCH }, created: false } as never);
    const updated = await invoke(route('POST', '/api/steward/feedback-branches'), { user: admin, body });
    expect(updated.status).toBe(200);
  });

  it('accept_edit without voteId is a 400', async () => {
    const res = await invoke(route('POST', '/api/steward/conflicts/:assetId/resolve'), {
      user: steward,
      params: { assetId: ASSET },
      body: { resolution: 'accept_edit' },
    });
    expect(res.status).toBe(400);
    expect(stubs.steward.resolveConflict).not.toHaveBeenCalled();
  });

  it('rejects a branch name outside mg-genie-feedback-<yyyymmdd>', async () => {
    const res = await invoke(route('POST', '/api/steward/feedback-branches'), {
      user: admin,
      body: { branchName: 'main', files: [], status: 'proposed' },
    });
    expect(res.status).toBe(400);
  });

  it('feedback-queue applies query defaults', async () => {
    await invoke(route('GET', '/api/steward/feedback-queue'), { user: steward });
    expect(stubs.steward.feedbackQueue).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', limit: expect.any(Number), offset: 0 }),
    );
  });
});
