// client/src/test/fixtures/settings.ts — user settings S7 (brief §1.1 "Settings")
// Session 43 · Build 5 · wave 5-0

import { CARDS_PER_SESSION_DEFAULT } from '../../../../shared/contracts';
import type { UserSettings } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS } from './ids';

/** Saved settings: theme system, default campaign Q4 Clinical Quality, 20 cards per session. */
export const userSettings: UserSettings = {
  theme: 'system',
  density: 'comfortable',
  motion: 'system',
  defaultCampaignId: IDS.campaigns.q4ClinicalQuality,
  defaultAssetType: null,
  showKeyboardHints: true,
  cardsPerSession: CARDS_PER_SESSION_DEFAULT,
  updatedAt: hoursAgo(24 * 3),
};

/** Never saved: the API returns defaults with updatedAt null (S7 "Using defaults"). */
export const userSettingsDefaults: UserSettings = {
  theme: 'system',
  density: 'comfortable',
  motion: 'system',
  defaultCampaignId: null,
  defaultAssetType: null,
  showKeyboardHints: true,
  cardsPerSession: CARDS_PER_SESSION_DEFAULT,
  updatedAt: null,
};

/** Settings with an explicit theme (theme-wiring tests). */
export function settingsWithTheme(theme: UserSettings['theme']): UserSettings {
  return { ...userSettings, theme };
}

export const settingsRoutes = {
  'GET /api/me/settings': userSettings,
  'PUT /api/me/settings': userSettings,
} satisfies MockHandlers;
