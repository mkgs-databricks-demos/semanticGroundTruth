// server/services/settings/userSettingsService.test.ts — defaults and partial upsert
// Session 33 · Wave 4-1 · Vitest with a mocked Db

import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_USER_SETTINGS, UserSettingsService } from './userSettingsService';
import type { ServiceDeps } from '../../lib/deps';

const CAMPAIGN = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function makeService(oneImpl: (sql: string, params: unknown[]) => Record<string, unknown> | null) {
  const one = vi.fn(async (sql: string, params: unknown[] = []) => oneImpl(sql, params));
  const db = { query: vi.fn(async () => []), one, tx: vi.fn() };
  return { svc: new UserSettingsService({ db } as unknown as ServiceDeps), one };
}

const storedRow = {
  user_id: 'u1',
  theme: 'dark',
  density: 'compact',
  motion: 'reduce',
  default_campaign_id: null,
  default_asset_type: 'measure',
  show_keyboard_hints: false,
  cards_per_session: 40,
  updated_at: new Date('2026-10-24T18:00:00Z'),
};

describe('UserSettingsService.get', () => {
  it('returns the migration defaults (updatedAt null) when no row exists', async () => {
    const { svc } = makeService(() => null);
    const s = await svc.get('u1');
    expect(s).toEqual(DEFAULT_USER_SETTINGS);
    expect(s).toMatchObject({
      theme: 'system',
      density: 'comfortable',
      motion: 'system',
      showKeyboardHints: true,
      cardsPerSession: 20,
      updatedAt: null,
    });
  });

  it('maps a stored row', async () => {
    const { svc } = makeService(() => storedRow);
    expect(await svc.get('u1')).toEqual({
      theme: 'dark',
      density: 'compact',
      motion: 'reduce',
      defaultCampaignId: null,
      defaultAssetType: 'measure',
      showKeyboardHints: false,
      cardsPerSession: 40,
      updatedAt: '2026-10-24T18:00:00.000Z',
    });
  });
});

describe('UserSettingsService.update', () => {
  it('upserts only the given columns', async () => {
    const { svc, one } = makeService(() => ({ ...storedRow, density: 'compact' }));
    await svc.update('u1', { density: 'compact', showKeyboardHints: false });

    const [sql, params] = one.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO app\.user_settings \(user_id, density, show_keyboard_hints, updated_at\)/);
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE SET/);
    expect(sql).toMatch(/density = EXCLUDED\.density/);
    expect(sql).toMatch(/show_keyboard_hints = EXCLUDED\.show_keyboard_hints/);
    expect(sql).not.toMatch(/theme|motion|cards_per_session|default_campaign_id/);
    expect(params).toEqual(['u1', 'compact', false]);
  });

  it('writes an explicit null (clearing defaultCampaignId)', async () => {
    const { svc, one } = makeService(() => storedRow);
    await svc.update('u1', { defaultCampaignId: null });
    const [sql, params] = one.mock.calls[0];
    expect(sql).toMatch(/default_campaign_id = EXCLUDED\.default_campaign_id/);
    expect(params).toEqual(['u1', null]);
  });

  it('404s an unknown defaultCampaignId before writing', async () => {
    const { svc, one } = makeService(() => null);
    await expect(svc.update('u1', { defaultCampaignId: CAMPAIGN })).rejects.toMatchObject({ status: 404 });
    expect(one.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
  });
});
