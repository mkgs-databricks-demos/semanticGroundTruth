// server/services/settings/userSettingsService.ts — GET|PUT /api/me/settings (plan 33)
// Session 33 · Wave 4-1 · No enum, no namespace, no default export

import type { Db } from '../../lib/db';
import type { ServiceDeps } from '../../lib/deps';
import { notFound } from '../../lib/errors';
import type { UserSettings } from '../../../shared/contracts/entities';
import type { UpdateUserSettingsRequest } from '../../../shared/contracts/api';
import type { AssetType, Density, MotionPref, Theme } from '../../../shared/contracts/values';
import { CARDS_PER_SESSION_DEFAULT } from '../../../shared/contracts/values';

/** Settings for a user with no app.user_settings row (matches the migration 009 column defaults). */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  density: 'comfortable',
  motion: 'system',
  defaultCampaignId: null,
  defaultAssetType: null,
  showKeyboardHints: true,
  cardsPerSession: CARDS_PER_SESSION_DEFAULT,
  updatedAt: null,
};

/** Request field -> app.user_settings column. Fixed list: column names never come from input. */
const COLUMNS: Record<keyof UpdateUserSettingsRequest, string> = {
  theme: 'theme',
  density: 'density',
  motion: 'motion',
  defaultCampaignId: 'default_campaign_id',
  defaultAssetType: 'default_asset_type',
  showKeyboardHints: 'show_keyboard_hints',
  cardsPerSession: 'cards_per_session',
};

export function rowToUserSettings(r: Record<string, unknown>): UserSettings {
  const updated = r.updated_at;
  return {
    theme: String(r.theme) as Theme,
    density: String(r.density) as Density,
    motion: String(r.motion) as MotionPref,
    defaultCampaignId: r.default_campaign_id ? String(r.default_campaign_id) : null,
    defaultAssetType: r.default_asset_type ? (String(r.default_asset_type) as AssetType) : null,
    showKeyboardHints: r.show_keyboard_hints === true || r.show_keyboard_hints === 'true',
    cardsPerSession: Number(r.cards_per_session),
    updatedAt:
      updated === null || updated === undefined
        ? null
        : updated instanceof Date
          ? updated.toISOString()
          : String(updated),
  };
}

export class UserSettingsService {
  private db: Db;

  constructor(deps: ServiceDeps) {
    this.db = deps.db;
  }

  /** The user's settings, or the defaults (updatedAt null) when no row exists. */
  async get(userId: string): Promise<UserSettings> {
    const row = await this.db.one<Record<string, unknown>>(
      'SELECT * FROM app.user_settings WHERE user_id = $1',
      [userId],
    );
    return row ? rowToUserSettings(row) : { ...DEFAULT_USER_SETTINGS };
  }

  /** Partial update: only the given fields change; the row is created on first write. */
  async update(userId: string, patch: UpdateUserSettingsRequest): Promise<UserSettings> {
    if (patch.defaultCampaignId) {
      const campaign = await this.db.one<{ id: string }>(
        'SELECT id FROM app.campaigns WHERE id = $1',
        [patch.defaultCampaignId],
      );
      if (!campaign) throw notFound(`Campaign not found: ${patch.defaultCampaignId}`);
    }

    const keys = (Object.keys(COLUMNS) as (keyof UpdateUserSettingsRequest)[]).filter(
      (k) => patch[k] !== undefined,
    );
    const columns = keys.map((k) => COLUMNS[k]);
    const values = keys.map((k) => patch[k] ?? null);
    const placeholders = columns.map((_c, i) => `$${i + 2}`);
    const updates = columns.map((c) => `${c} = EXCLUDED.${c}`);

    const row = await this.db.one<Record<string, unknown>>(
      `INSERT INTO app.user_settings (user_id${columns.map((c) => `, ${c}`).join('')}, updated_at)
       VALUES ($1${placeholders.map((p) => `, ${p}`).join('')}, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         ${[...updates, 'updated_at = NOW()'].join(',\n         ')}
       RETURNING *`,
      [userId, ...values],
    );
    if (!row) throw new Error('user_settings upsert returned no row');
    return rowToUserSettings(row);
  }
}
