// @a11y-strict
// client/src/components/settings/settingsForm.ts — S7 Settings form model (no React)
// Session 52 · Build 5 · wave 5-2 (screen_inventory.md S7, F8)
//
// The Settings page keeps two drafts, one per API:
//   * SettingsDraft  <- GET /api/me/settings (UserSettings); saved with
//     PUT /api/me/settings, whose body holds only the fields that changed
//     (UpdateUserSettingsRequest is partial and rejects an empty object).
//   * PrefRow[]      <- GET /api/notifications/preferences, one row per
//     NOTIFICATION_EVENT_TYPES entry (missing rows get the server default:
//     in-app on, no digest); saved with PUT /api/notifications/preferences,
//     whose body holds only the rows that changed (the server upserts rows).
// `cardsPerSession` stays a string in the draft so the field can hold what the
// user typed (e.g. "150") and show an inline error instead of a request.

import {
  CARDS_PER_SESSION_MAX,
  CARDS_PER_SESSION_MIN,
  NOTIFICATION_EVENT_TYPES,
} from '../../../../shared/contracts';
import type {
  AssetType,
  Density,
  MotionPref,
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
  Theme,
  UpdatePreferencesBody,
  UpdateUserSettingsRequest,
  UserSettings,
} from '../../../../shared/contracts';

export interface SettingsDraft {
  theme: Theme;
  density: Density;
  motion: MotionPref;
  defaultCampaignId: string | null;
  defaultAssetType: AssetType | null;
  showKeyboardHints: boolean;
  /** Raw field text; parsed and range-checked by validateCardsPerSession. */
  cardsPerSession: string;
}

export interface PrefRow {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  digest: boolean;
}

/** Channels that can be switched today. Slack / Teams / webhook delivery is deferred (G5). */
export const EDITABLE_CHANNELS: readonly NotificationChannel[] = ['in_app'];
/** Channels shown disabled with "Coming later". */
export const COMING_LATER_CHANNELS: readonly NotificationChannel[] = ['slack', 'teams', 'webhook'];

export const CHANNEL_LABELS: Readonly<Record<NotificationChannel, string>> = {
  in_app: 'In-app',
  slack: 'Slack',
  teams: 'Teams',
  webhook: 'Webhook',
};

export const EVENT_LABELS: Readonly<Record<NotificationEventType, string>> = {
  'asset.certified': 'Asset certified',
  'campaign.created': 'Campaign created',
  'campaign.completed': 'Campaign completed',
  'vote.milestone': 'Vote milestone',
  'feedback.branch_ready': 'Feedback branch ready',
  'feedback.failed': 'Feedback failed',
};

export const CARDS_PER_SESSION_ERROR = `Enter a whole number from ${CARDS_PER_SESSION_MIN} to ${CARDS_PER_SESSION_MAX}`;

// ── User settings ───────────────────────────────────────────────────────

export function toDraft(settings: UserSettings): SettingsDraft {
  return {
    theme: settings.theme,
    density: settings.density,
    motion: settings.motion,
    defaultCampaignId: settings.defaultCampaignId,
    defaultAssetType: settings.defaultAssetType,
    showKeyboardHints: settings.showKeyboardHints,
    cardsPerSession: String(settings.cardsPerSession),
  };
}

/** The parsed value, or null when the text is not a whole number in range. */
export function parseCardsPerSession(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= CARDS_PER_SESSION_MIN && n <= CARDS_PER_SESSION_MAX ? n : null;
}

/** Inline error text for the field, or null when valid. */
export function validateCardsPerSession(text: string): string | null {
  return parseCardsPerSession(text) === null ? CARDS_PER_SESSION_ERROR : null;
}

/**
 * PUT /api/me/settings body: only the fields that differ from `saved`.
 * An invalid cardsPerSession is left out (the page blocks saving first).
 */
export function diffSettings(saved: UserSettings, draft: SettingsDraft): UpdateUserSettingsRequest {
  const out: UpdateUserSettingsRequest = {};
  if (draft.theme !== saved.theme) out.theme = draft.theme;
  if (draft.density !== saved.density) out.density = draft.density;
  if (draft.motion !== saved.motion) out.motion = draft.motion;
  if (draft.defaultCampaignId !== saved.defaultCampaignId) out.defaultCampaignId = draft.defaultCampaignId;
  if (draft.defaultAssetType !== saved.defaultAssetType) out.defaultAssetType = draft.defaultAssetType;
  if (draft.showKeyboardHints !== saved.showKeyboardHints) out.showKeyboardHints = draft.showKeyboardHints;
  const cards = parseCardsPerSession(draft.cardsPerSession);
  if (cards !== null && cards !== saved.cardsPerSession) out.cardsPerSession = cards;
  return out;
}

/** True when the draft differs from `saved` (an edited, invalid card count counts). */
export function isSettingsDirty(saved: UserSettings, draft: SettingsDraft): boolean {
  if (Object.keys(diffSettings(saved, draft)).length > 0) return true;
  return draft.cardsPerSession.trim() !== String(saved.cardsPerSession);
}

/** No stored row yet: the API answered with defaults (updatedAt null). */
export function isUsingDefaults(settings: UserSettings): boolean {
  return settings.updatedAt === null;
}

// ── Notification preferences ────────────────────────────────────────────

/** One row per event type, in contract order; missing rows get the server default. */
export function mergePreferences(prefs: readonly NotificationPreference[]): PrefRow[] {
  const byType = new Map(prefs.map((p) => [p.eventType, p]));
  return NOTIFICATION_EVENT_TYPES.map((eventType) => {
    const p = byType.get(eventType);
    return p
      ? { eventType, channels: [...p.channels], digest: p.digest }
      : { eventType, channels: ['in_app'], digest: false };
  });
}

function sameChannels(a: readonly NotificationChannel[], b: readonly NotificationChannel[]): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

/** Rows of `draft` that differ from `saved` (same order). */
export function changedPreferences(saved: readonly PrefRow[], draft: readonly PrefRow[]): PrefRow[] {
  const byType = new Map(saved.map((r) => [r.eventType, r]));
  return draft.filter((row) => {
    const before = byType.get(row.eventType);
    return !before || before.digest !== row.digest || !sameChannels(before.channels, row.channels);
  });
}

/** PUT /api/notifications/preferences body for the changed rows, or null when nothing changed. */
export function preferencesBody(saved: readonly PrefRow[], draft: readonly PrefRow[]): UpdatePreferencesBody | null {
  const rows = changedPreferences(saved, draft);
  return rows.length === 0 ? null : { preferences: rows.map((r) => ({ ...r, channels: [...r.channels] })) };
}

/** Turn one channel on or off for one event; other channels (e.g. a stored Slack) are kept. */
export function toggleChannel(rows: readonly PrefRow[], eventType: NotificationEventType, channel: NotificationChannel): PrefRow[] {
  return rows.map((r) => {
    if (r.eventType !== eventType) return r;
    const on = r.channels.includes(channel);
    return { ...r, channels: on ? r.channels.filter((c) => c !== channel) : [...r.channels, channel] };
  });
}

export function toggleDigest(rows: readonly PrefRow[], eventType: NotificationEventType): PrefRow[] {
  return rows.map((r) => (r.eventType === eventType ? { ...r, digest: !r.digest } : r));
}
