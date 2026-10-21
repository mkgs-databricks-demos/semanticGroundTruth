// server/services/notification/destinations/types.ts — outbound destination interface
// Session 08 · Wave 2

import type { NotificationChannel } from '../../../../shared/contracts/values';

/**
 * An outbound notification destination (Slack, Teams, generic webhook).
 * Each reads its URL from an environment variable at call time;
 * `enabled()` returns false when the env var is unset.
 */
export interface Destination {
  readonly channel: NotificationChannel;
  enabled(): boolean;
  send(n: { title: string; body?: string; link?: string }): Promise<void>;
}
