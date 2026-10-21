// server/services/notification/routing.test.ts — vitest (written, not run in session)
// Session 08 · Wave 2

import { describe, expect, it } from 'vitest';
import type { NotificationPreference } from '../../../shared/contracts/entities';
import type { NotificationChannel } from '../../../shared/contracts/values';
import { PRIORITY, resolveChannels } from './routing';

describe('PRIORITY', () => {
  it('marks feedback.branch_ready as high', () => {
    expect(PRIORITY['feedback.branch_ready']).toBe('high');
  });

  it('marks feedback.failed as high', () => {
    expect(PRIORITY['feedback.failed']).toBe('high');
  });

  it('marks asset.certified as high', () => {
    expect(PRIORITY['asset.certified']).toBe('high');
  });

  it('marks campaign.created as low', () => {
    expect(PRIORITY['campaign.created']).toBe('low');
  });

  it('marks campaign.completed as low', () => {
    expect(PRIORITY['campaign.completed']).toBe('low');
  });

  it('marks vote.milestone as low', () => {
    expect(PRIORITY['vote.milestone']).toBe('low');
  });
});

describe('resolveChannels', () => {
  const allEnabled: NotificationChannel[] = ['in_app', 'slack', 'teams', 'webhook'];
  const inAppOnly: NotificationChannel[] = ['in_app'];

  it('defaults to [in_app] when no prefs', () => {
    const result = resolveChannels('campaign.created', undefined, allEnabled);
    expect(result.channels).toEqual(['in_app']);
  });

  it('respects user channel preferences', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'campaign.created',
      channels: ['in_app', 'slack'],
      digest: false,
    };
    const result = resolveChannels('campaign.created', prefs, allEnabled);
    expect(result.channels).toEqual(['in_app', 'slack']);
  });

  it('filters out channels not in enabled list', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'campaign.created',
      channels: ['in_app', 'slack', 'teams'],
      digest: false,
    };
    const result = resolveChannels('campaign.created', prefs, inAppOnly);
    expect(result.channels).toEqual(['in_app']);
  });

  it('guarantees in_app when all preferred channels are disabled', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'campaign.created',
      channels: ['slack'],
      digest: false,
    };
    // in_app is enabled but not in prefs; slack is in prefs but not enabled
    const result = resolveChannels('campaign.created', prefs, inAppOnly);
    expect(result.channels).toEqual(['in_app']);
  });

  it('digest defaults to true for low priority without prefs', () => {
    const result = resolveChannels('campaign.created', undefined, allEnabled);
    expect(result.digest).toBe(true);
  });

  it('digest is false for high priority regardless of prefs', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'asset.certified',
      channels: ['in_app', 'slack'],
      digest: true,
    };
    const result = resolveChannels('asset.certified', prefs, allEnabled);
    expect(result.digest).toBe(false);
  });

  it('low priority respects user digest=false override', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'campaign.created',
      channels: ['in_app', 'slack'],
      digest: false,
    };
    const result = resolveChannels('campaign.created', prefs, allEnabled);
    expect(result.digest).toBe(false);
  });

  it('low priority respects user digest=true', () => {
    const prefs: NotificationPreference = {
      userId: 'u1',
      eventType: 'vote.milestone',
      channels: ['in_app', 'teams'],
      digest: true,
    };
    const result = resolveChannels('vote.milestone', prefs, allEnabled);
    expect(result.digest).toBe(true);
  });
});
