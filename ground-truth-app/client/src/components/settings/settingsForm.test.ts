// @a11y-strict
// client/src/components/settings/settingsForm.test.ts — S7 form model (diff, validation, preferences)
// Session 52 · Build 5 · wave 5-2

import { describe, expect, it } from 'vitest';
import { UpdatePreferencesBodySchema, UpdateUserSettingsRequestSchema } from '../../../../shared/contracts';
import type { NotificationPreference, UserSettings } from '../../../../shared/contracts';
import {
  CARDS_PER_SESSION_ERROR,
  changedPreferences,
  diffSettings,
  isSettingsDirty,
  isUsingDefaults,
  mergePreferences,
  parseCardsPerSession,
  preferencesBody,
  toDraft,
  toggleChannel,
  toggleDigest,
  validateCardsPerSession,
} from './settingsForm';

const saved: UserSettings = {
  theme: 'system',
  density: 'comfortable',
  motion: 'system',
  defaultCampaignId: '11111111-1111-4111-8111-111111111111',
  defaultAssetType: null,
  showKeyboardHints: true,
  cardsPerSession: 20,
  updatedAt: '2026-10-21T08:00:00.000Z',
};

describe('cards per session', () => {
  it.each([
    ['5', 5],
    ['100', 100],
    [' 20 ', 20],
    ['4', null],
    ['101', null],
    ['150', null],
    ['', null],
    ['12.5', null],
    ['-5', null],
    ['1e2', null],
  ])('parse(%j) = %j', (text, expected) => {
    expect(parseCardsPerSession(text)).toBe(expected);
  });

  it('validate returns the inline error text only when invalid', () => {
    expect(validateCardsPerSession('150')).toBe(CARDS_PER_SESSION_ERROR);
    expect(validateCardsPerSession('50')).toBeNull();
  });
});

describe('diffSettings', () => {
  it('an untouched draft has no changes and is not dirty', () => {
    expect(diffSettings(saved, toDraft(saved))).toEqual({});
    expect(isSettingsDirty(saved, toDraft(saved))).toBe(false);
  });

  it('contains only the changed fields, and the body passes UpdateUserSettingsRequest', () => {
    const draft = { ...toDraft(saved), density: 'compact' as const, cardsPerSession: '30', defaultCampaignId: null };
    const body = diffSettings(saved, draft);
    expect(body).toEqual({ density: 'compact', cardsPerSession: 30, defaultCampaignId: null });
    expect(UpdateUserSettingsRequestSchema.safeParse(body).success).toBe(true);
  });

  it('leaves out an invalid card count but still reports the form dirty', () => {
    const draft = { ...toDraft(saved), cardsPerSession: '150' };
    expect(diffSettings(saved, draft)).toEqual({});
    expect(isSettingsDirty(saved, draft)).toBe(true);
  });

  it('changing a value and changing it back is clean again', () => {
    const draft = { ...toDraft(saved), theme: 'dark' as const };
    expect(diffSettings(saved, draft)).toEqual({ theme: 'dark' });
    expect(isSettingsDirty(saved, { ...draft, theme: 'system' })).toBe(false);
  });

  it('updatedAt null means the API returned defaults', () => {
    expect(isUsingDefaults({ ...saved, updatedAt: null })).toBe(true);
    expect(isUsingDefaults(saved)).toBe(false);
  });
});

describe('notification preferences', () => {
  const stored: NotificationPreference[] = [
    { userId: 'u1', eventType: 'feedback.branch_ready', channels: ['in_app', 'slack'], digest: false },
    { userId: 'u1', eventType: 'asset.certified', channels: [], digest: true },
  ];

  it('merge gives one row per event type in contract order, defaults for missing rows', () => {
    const rows = mergePreferences(stored);
    expect(rows.map((r) => r.eventType)).toEqual([
      'asset.certified',
      'campaign.created',
      'campaign.completed',
      'vote.milestone',
      'feedback.branch_ready',
      'feedback.failed',
    ]);
    expect(rows[0]).toEqual({ eventType: 'asset.certified', channels: [], digest: true });
    expect(rows[1]).toEqual({ eventType: 'campaign.created', channels: ['in_app'], digest: false });
  });

  it('toggling in-app keeps a stored Slack channel; the body has only the changed row', () => {
    const base = mergePreferences(stored);
    const draft = toggleChannel(base, 'feedback.branch_ready', 'in_app');
    expect(draft[4].channels).toEqual(['slack']);
    const body = preferencesBody(base, draft);
    expect(body).toEqual({ preferences: [{ eventType: 'feedback.branch_ready', channels: ['slack'], digest: false }] });
    expect(UpdatePreferencesBodySchema.safeParse(body).success).toBe(true);
  });

  it('toggling twice is no change; channel order does not count as a change', () => {
    const base = mergePreferences(stored);
    expect(preferencesBody(base, toggleDigest(toggleDigest(base, 'vote.milestone'), 'vote.milestone'))).toBeNull();
    const reordered = base.map((r) => ({ ...r, channels: [...r.channels].reverse() }));
    expect(changedPreferences(base, reordered)).toEqual([]);
  });
});
