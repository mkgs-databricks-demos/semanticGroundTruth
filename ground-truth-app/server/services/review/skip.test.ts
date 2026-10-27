// server/services/review/skip.test.ts — skip is tracked, never a vote; cooldown + resurfacing
// Session 33 · Wave 4-1 · Vitest with a mocked Db (SQL routed by pattern)

import { describe, it, expect, vi } from 'vitest';
import { ReviewEngine } from './reviewEngine';
import type { ServiceDeps } from '../../lib/deps';
import type { AssetRegistry } from '../asset';
import type { MetricViewService } from '../metricView';
import type { UserContext } from '../../lib/context';

const ASSET = '550e8400-e29b-41d4-a716-446655440000';
const OTHER = '550e8400-e29b-41d4-a716-446655440001';
const USER: UserContext = {
  userId: 'u1',
  email: 'u1@example.com',
  displayName: 'U1',
  source: 'web',
  roles: ['reviewer'],
};

type Route = [RegExp, (params: unknown[]) => Record<string, unknown>[]];

function makeEngine(routes: Route[], skipCooldownHours = 24) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const run = (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const hit = routes.find(([re]) => re.test(sql));
    return hit ? hit[1](params) : [];
  };
  const db = {
    query: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)),
    one: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)[0] ?? null),
    tx: vi.fn(async () => {}),
  };
  const events = { emit: vi.fn(), on: vi.fn() };
  const config = {
    get: vi.fn(async () => ({ skipCooldownHours, stalenessDays: 90 })),
  };
  const assets = {
    get: vi.fn(async (id: string) => ({ id, name: `asset-${id}`, displayName: `Asset ${id}` })),
    listSynonyms: vi.fn(async () => []),
    listExamples: vi.fn(async () => []),
  };
  const engine = new ReviewEngine(
    { db, config, events } as unknown as ServiceDeps,
    assets as unknown as AssetRegistry,
    {} as MetricViewService,
  );
  return { engine, calls, events, assets };
}

const skipRow = (params: unknown[]) => [{
  id: 'skip-1',
  user_id: params[0],
  asset_id: params[1],
  campaign_id: params[2],
  reason: params[3],
  version_hash: params[4],
  source: params[5],
  created_at: new Date('2026-10-24T18:00:00Z'),
}];

const VOTE_OR_SCORE_WRITE = /(INSERT INTO|UPDATE|DELETE FROM)\s+app\.(votes|confidence_scores|campaign_assets|assets)\b/i;

describe('ReviewEngine.skip', () => {
  it('inserts app.review_skips and bumps skip counters only', async () => {
    const { engine, calls, events } = makeEngine([
      [/SELECT version_hash FROM app\.assets/, () => [{ version_hash: 'h1' }]],
      [/INSERT INTO app\.review_skips/, skipRow],
      [/FROM app\.review_skips\s+WHERE user_id/, () => [{ skipped_count: 3, skipped_today: 1 }]],
    ]);

    const res = await engine.skip(USER, { assetId: ASSET, reason: 'not_sure' });

    expect(res.skip).toMatchObject({ assetId: ASSET, reason: 'not_sure', versionHash: 'h1', source: 'web' });
    expect(res.stats).toEqual({ skippedCount: 3, skippedToday: 1 });

    const sqls = calls.map((c) => c.sql);
    expect(sqls.some((s) => /INSERT INTO app\.review_skips/.test(s))).toBe(true);
    const activity = sqls.find((s) => /app\.user_activity/.test(s))!;
    expect(activity).toMatch(/total_skips/);
    expect(activity).not.toMatch(/total_votes|streak|badge/i);
    // Never a vote: no write to votes / confidence / campaign progress / assets.
    expect(sqls.filter((s) => VOTE_OR_SCORE_WRITE.test(s))).toEqual([]);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('404s an unknown asset without writing anything', async () => {
    const { engine, calls } = makeEngine([]);
    await expect(engine.skip(USER, { assetId: ASSET })).rejects.toMatchObject({ status: 404 });
    expect(calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
  });

  it('404s an unknown campaign', async () => {
    const { engine, calls } = makeEngine([
      [/SELECT version_hash FROM app\.assets/, () => [{ version_hash: 'h1' }]],
    ]);
    await expect(
      engine.skip(USER, { assetId: ASSET, campaignId: OTHER }),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
  });
});

describe('ReviewEngine.getNextWithMeta (skip cooldown)', () => {
  it('excludes assets skipped within skipCooldownHours', async () => {
    const { engine, calls } = makeEngine([
      [/LIMIT 200/, () => [{ asset_id: OTHER, confidence: 0, total_votes: 0, last_reviewed_at: null, in_campaign: false, is_new_version: false }]],
    ], 24);

    const res = await engine.getNextWithMeta(USER, {});

    expect(res.resurfacedFromSkip).toBe(false);
    expect(res.card?.asset.id).toBe(OTHER);
    const candidate = calls.find((c) => /LIMIT 200/.test(c.sql))!;
    expect(candidate.sql).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM app\.review_skips rs/);
    expect(candidate.sql).toMatch(/make_interval\(hours => \$2::int\)/);
    expect(candidate.params).toEqual(['u1', 24]);
  });

  it('resurfaces the oldest-skipped asset when everything is in cooldown', async () => {
    const { engine, calls } = makeEngine([
      [/LIMIT 200/, () => []],
      [/ORDER BY MAX\(rs\.created_at\) ASC/, () => [{ asset_id: ASSET }]],
    ], 24);

    const res = await engine.getNextWithMeta(USER, {});

    expect(res.resurfacedFromSkip).toBe(true);
    expect(res.card?.asset.id).toBe(ASSET);
    expect(calls.some((c) => /ORDER BY MAX\(rs\.created_at\) ASC/.test(c.sql))).toBe(true);
  });

  it('returns null (not resurfaced) when nothing was skipped either', async () => {
    const { engine } = makeEngine([[/LIMIT 200/, () => []]], 24);
    expect(await engine.getNextWithMeta(USER, {})).toEqual({ card: null, resurfacedFromSkip: false });
  });

  it('cooldown 0 disables the skip filter and resurfacing', async () => {
    const { engine, calls } = makeEngine([[/LIMIT 200/, () => []]], 0);
    expect(await engine.getNextWithMeta(USER, {})).toEqual({ card: null, resurfacedFromSkip: false });
    const candidate = calls.find((c) => /LIMIT 200/.test(c.sql))!;
    expect(candidate.sql).not.toMatch(/review_skips/);
    expect(calls.some((c) => /ORDER BY MAX\(rs\.created_at\)/.test(c.sql))).toBe(false);
  });

  it('getNext keeps returning just the card', async () => {
    const { engine } = makeEngine([
      [/LIMIT 200/, () => []],
      [/ORDER BY MAX\(rs\.created_at\) ASC/, () => [{ asset_id: ASSET }]],
    ], 24);
    const card = await engine.getNext(USER, {});
    expect(card?.asset.id).toBe(ASSET);
  });
});
