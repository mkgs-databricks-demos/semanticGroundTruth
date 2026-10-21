// server/services/notification/routing.ts — pure priority + channel routing
// Session 08 · Wave 2 · No default export

import type { NotificationChannel, NotificationEventType } from '../../../shared/contracts/values';
import type { NotificationPreference } from '../../../shared/contracts/entities';

/**
 * Priority map: high = immediate delivery, low = digest-eligible for outbound channels.
 * feedback.* + asset.certified are high; campaign.* + vote.milestone are low.
 */
export const PRIORITY: Record<NotificationEventType, 'high' | 'low'> = {
  'feedback.branch_ready': 'high',
  'feedback.failed': 'high',
  'asset.certified': 'high',
  'campaign.created': 'low',
  'campaign.completed': 'low',
  'vote.milestone': 'low',
};

/**
 * Resolve which channels a notification should be sent through and whether
 * non-in-app channels should be batched into a digest.
 *
 * @param eventType  The domain event triggering the notification.
 * @param prefs      User preferences for this event type (undefined = defaults).
 * @param enabled    Channels currently enabled (in_app + any destinations whose env var is set).
 * @returns          `channels` to deliver on, and `digest` flag for non-in-app channels.
 */
export function resolveChannels(
  eventType: NotificationEventType,
  prefs: NotificationPreference | undefined,
  enabled: NotificationChannel[],
): { channels: NotificationChannel[]; digest: boolean } {
  // Default: in_app only when no user prefs exist
  const preferredChannels = prefs?.channels ?? (['in_app'] as NotificationChannel[]);

  // Only keep channels that are actually enabled in this deployment
  const channels = preferredChannels.filter((ch) => enabled.includes(ch));

  // Guarantee at least in_app if enabled and channels would otherwise be empty
  if (channels.length === 0 && enabled.includes('in_app')) {
    channels.push('in_app');
  }

  const priority = PRIORITY[eventType] ?? 'low';

  // High priority: never digest. Low priority: default to digest unless user explicitly opts out.
  const digest = priority === 'high' ? false : (prefs?.digest ?? true);

  return { channels, digest };
}
