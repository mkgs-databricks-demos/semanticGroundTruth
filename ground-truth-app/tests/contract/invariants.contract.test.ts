// tests/contract/invariants.contract.test.ts — behaviour that spans more than one call
// Session 35 · Wave 4-3 · Vitest, routes in-process against the seeded fake
//
// skip never touches confidence or votes; skip is not a vote type; a skipped
// card is hidden for the cooldown and comes back after it; settings PUT/GET
// round-trip; /health reports degraded (200) when the database is down.
// Build 5 (session 44): resurfacedFromSkip on cards, edit votes need a value,
// feedback-branch upserts notify once.

import { describe, expect, it, vi } from 'vitest';
import { HealthResponseSchema, ROUTE_CONTRACTS, routeKey } from '../../shared/contracts/schemas';
import type { RouteContract } from '../../shared/contracts/schemas';
import { callRoute, newEnv } from './harness';
import type { Env } from './harness';
import { ADMIN, IDS, REVIEWER } from './fixtures';
import { EDIT_VOTE_NEEDS_VALUE_MESSAGE } from '../../shared/contracts/api';
import type { CallInput } from './routeCases';

vi.mock('../../server/services/sources', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  SourceService: (await import('./fakeStore')).FakeSourceService,
}));

function contract(key: string): RouteContract {
  const c = ROUTE_CONTRACTS.find((r) => routeKey(r) === key);
  if (!c) throw new Error(`no contract ${key}`);
  return c;
}
const call = (env: Env, key: string, input: CallInput = {}) => callRoute(env, contract(key), input);
const nextAssetId = async (env: Env) =>
  ((await call(env, 'GET /api/review/next', { query: {} })).body as { asset: { id: string } } | null)?.asset.id;

describe('skip invariants', () => {
  it('skip leaves confidence and vote count unchanged', async () => {
    const env = newEnv();
    const before = { confidence: env.store.confidence(IDS.A1), votes: env.store.votes.length };
    const res = await call(env, 'POST /api/review/skip', { body: { assetId: IDS.A1, reason: 'not_sure' } });
    expect(res.status).toBe(201);
    expect(env.store.confidence(IDS.A1)).toEqual(before.confidence);
    expect(env.store.votes).toHaveLength(before.votes);
    expect(env.store.skips).toHaveLength(1);
  });

  it("voteType 'skip' is rejected with 400 and writes nothing", async () => {
    const env = newEnv();
    const res = await call(env, 'POST /api/review/vote', { body: { assetId: IDS.A3, voteType: 'skip' } });
    expect(res.status).toBe(400);
    expect(env.store.votes).toHaveLength(5);
    expect(env.store.skips).toHaveLength(0);
  });

  it('a skipped asset is hidden for the cooldown, then served again', async () => {
    const env = newEnv();
    expect(await nextAssetId(env)).toBe(IDS.A3);
    await call(env, 'POST /api/review/skip', { body: { assetId: IDS.A3, reason: 'need_context' } });
    expect(await nextAssetId(env)).toBe(IDS.A4);
    // Move the skip past the 24h default cooldown.
    env.store.skips[0].createdAt = '2026-10-24T11:59:59.000Z';
    expect(await nextAssetId(env)).toBe(IDS.A3);
  });

  it('a card served again after the cooldown has resurfacedFromSkip: true', async () => {
    const env = newEnv();
    const first = (await call(env, 'GET /api/review/next', { query: {} })).body as Record<string, unknown>;
    expect(first.resurfacedFromSkip).toBe(false);
    await call(env, 'POST /api/review/skip', { body: { assetId: IDS.A3 } });
    env.store.skips[0].createdAt = '2026-10-24T11:59:59.000Z';
    const again = (await call(env, 'GET /api/review/next', { query: {} })).body as Record<string, unknown>;
    expect(again).toMatchObject({ asset: { id: IDS.A3 }, resurfacedFromSkip: true });
  });

  it('skips count in stats but not in totals', async () => {
    const env = newEnv();
    await call(env, 'POST /api/review/skip', { body: { assetId: IDS.A3 } });
    const stats = (await call(env, 'GET /api/review/stats/me')).body as Record<string, number>;
    expect(stats.skippedCount).toBe(1);
    expect(stats.skippedToday).toBe(1);
    expect(stats.totalVotes).toBe(2);
  });
});

describe('edit votes need a proposed value (build 5 follow-up 6)', () => {
  it.each([
    ['no edits', {}],
    ['blank edits', { edits: { description: ' ', displayName: '' } }],
  ])('POST /api/review/vote edit with %s: 400 issue at edits, nothing written', async (_label, extra) => {
    const env = newEnv();
    const res = await call(env, 'POST /api/review/vote', { body: { assetId: IDS.A3, voteType: 'edit', ...extra } });
    expect(res.status).toBe(400);
    const err = (res.body as { error: { code: string; details: { issues: { path: string[]; message: string }[] } } }).error;
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.details.issues).toEqual([expect.objectContaining({ path: ['edits'], message: EDIT_VOTE_NEEDS_VALUE_MESSAGE })]);
    expect(env.store.votes).toHaveLength(5);
  });
});

describe('feedback branch notifications (build 5 follow-up 5)', () => {
  const body = { branchName: 'mg-genie-feedback-20261020', files: ['a.yml'], status: 'proposed' };

  it('re-upserting a branch with the same status sends no notification', async () => {
    const env = newEnv();
    // Fixture B1 is already proposed: a retry / re-registration.
    const res = await call(env, 'POST /api/steward/feedback-branches', { user: ADMIN, body });
    expect(res.status).toBe(200);
    expect(env.store.stewardNotifications).toEqual([]);
  });

  it('a status change notifies once', async () => {
    const env = newEnv();
    await call(env, 'POST /api/steward/feedback-branches', { user: ADMIN, body: { ...body, status: 'failed' } });
    await call(env, 'POST /api/steward/feedback-branches', { user: ADMIN, body: { ...body, status: 'failed' } });
    expect(env.store.stewardNotifications).toEqual([{ eventType: 'feedback.failed', batchId: IDS.B1 }]);
  });
});

describe('settings round-trip', () => {
  it('PUT /api/me/settings then GET returns the same settings', async () => {
    const env = newEnv();
    const put = await call(env, 'PUT /api/me/settings', { body: { theme: 'light', motion: 'reduce', showKeyboardHints: false } });
    expect(put.status).toBe(200);
    const get = await call(env, 'GET /api/me/settings');
    expect(get.body).toEqual(put.body);
    expect(put.body).toMatchObject({ theme: 'light', motion: 'reduce', showKeyboardHints: false });
    expect(env.store.settings.get(REVIEWER.userId)).toEqual(put.body);
  });

  it('PUT /api/admin/config then GET returns the same config', async () => {
    const env = newEnv();
    const put = await call(env, 'PUT /api/admin/config', { user: ADMIN, body: { minVotesForCertification: 5, skipCooldownHours: 48 } });
    expect(put.status).toBe(200);
    const get = await call(env, 'GET /api/admin/config', { user: ADMIN });
    expect(get.body).toEqual(put.body);
    expect((get.body as Record<string, number>).skipCooldownHours).toBe(48);
  });

  it('a longer admin cooldown keeps a 30-hour-old skip hidden', async () => {
    const env = newEnv();
    await call(env, 'PUT /api/admin/config', { user: ADMIN, body: { skipCooldownHours: 48 } });
    await call(env, 'POST /api/review/skip', { body: { assetId: IDS.A3 } });
    env.store.skips[0].createdAt = '2026-10-24T06:00:00.000Z';
    expect(await nextAssetId(env)).toBe(IDS.A4);
  });
});

describe('health', () => {
  it('database down: 200 degraded, still matches HealthResponse', async () => {
    const env = newEnv();
    env.store.dbDown = true;
    const res = await call(env, 'GET /health');
    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(res.body)).toEqual(res.body);
    expect(res.body).toEqual({ status: 'degraded', db: false, migrations: 0, version: process.env.APP_VERSION ?? '0.0.0' });
  });
});
