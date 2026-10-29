// server/services/notification/notificationService.ts — event-driven notification service
// Session 08 · Wave 2 · No default export · No imports from review/ or campaign/ services

import type { Notification, NotificationPreference } from '../../../shared/contracts/entities';
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
} from '../../../shared/contracts/values';
import type { Role } from '../../lib/context';
import type { ServiceDeps } from '../../lib/deps';
import { logger } from '../../lib/logger';
import type { Destination } from './destinations/types';
import { SlackDestination } from './destinations/slack';
import { TeamsDestination } from './destinations/teams';
import { WebhookDestination } from './destinations/webhook';
import { resolveChannels } from './routing';

// ── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_DELAYS = [1_000, 2_000, 4_000]; // 1s / 2s / 4s

/**
 * event_type of the audit row a Share to Slack writes (build 5 session 50).
 * Server-internal: audit rows use channel 'slack', so the in-app inbox (which
 * reads channel 'in_app' only) never returns them.
 */
export const SLACK_SHARE_EVENT_TYPE = 'share.slack';

/** One Share to Slack, as recorded in app.notifications (channel 'slack'). */
export interface SlackShareAudit {
  /** The steward/admin who shared (recipient_id of the audit row). */
  userId: string;
  title: string;
  body: string;
  /** 'sent' for a sent or drafted share, 'failed' when system.ai.slack failed. */
  status: Extract<NotificationStatus, 'sent' | 'failed'>;
  metadata: Record<string, unknown>;
}

interface NotifyInput {
  eventType: NotificationEventType;
  recipientType: 'user' | 'role';
  recipientId: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

/** Map a Postgres row to a Notification entity (snake_case → camelCase). */
function mapRow(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.recipient_id as string,
    eventType: row.event_type as NotificationEventType,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationStatus,
    title: row.title as string,
    body: (row.body as string) ?? '',
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

function mapPreferenceRow(row: Record<string, unknown>): NotificationPreference {
  return {
    userId: row.user_id as string,
    eventType: row.event_type as NotificationEventType,
    channels: row.channels as NotificationChannel[],
    digest: row.digest as boolean,
  };
}

// ── Service ─────────────────────────────────────────────────────────────

export class NotificationService {
  private readonly destinations: Destination[];

  constructor(
    private readonly deps: ServiceDeps,
    destinations?: Destination[],
  ) {
    this.destinations = destinations ?? [
      new SlackDestination(),
      new TeamsDestination(),
      new WebhookDestination(),
    ];
  }

  // ── Channel discovery ───────────────────────────────────────────────

  /** Returns channels available in this deployment (always includes in_app). */
  enabledChannels(): NotificationChannel[] {
    const channels: NotificationChannel[] = ['in_app'];
    for (const dest of this.destinations) {
      if (dest.enabled()) channels.push(dest.channel);
    }
    return channels;
  }

  // ── Core notify ─────────────────────────────────────────────────────

  /**
   * Create notification rows (one per resolved channel) and deliver outbound
   * channels immediately unless digest is active.
   *
   * - in_app rows are inserted with status 'sent'.
   * - outbound rows start as 'pending'; delivered inline (retry 3×) or left
   *   for `flushDigests()` when digest is true.
   */
  async notify(input: NotifyInput): Promise<Notification[]> {
    const { eventType, recipientType, recipientId, title, body, metadata } = input;

    // Look up per-user prefs only for user-addressed notifications
    const prefs = recipientType === 'user'
      ? await this.getPreferencesForEvent(recipientId, eventType)
      : undefined;

    const enabled = this.enabledChannels();
    const { channels, digest } = resolveChannels(eventType, prefs, enabled);

    const results: Notification[] = [];

    for (const channel of channels) {
      const isInApp = channel === 'in_app';
      const initialStatus: NotificationStatus = isInApp ? 'sent' : 'pending';

      const row = await this.deps.db.one<Record<string, unknown>>(
        `INSERT INTO app.notifications
           (recipient_id, event_type, channel, status, title, body, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          recipientId,
          eventType,
          channel,
          initialStatus,
          title,
          body ?? '',
          metadata ? JSON.stringify(metadata) : null,
        ],
      );

      if (!row) continue;
      const notification = mapRow(row);
      results.push(notification);

      // Deliver outbound channels immediately unless digest
      if (!isInApp && !digest) {
        await this.deliverWithRetry(notification.id, channel, { title, body });
      }
    }

    return results;
  }

  // ── Inbox (in-app) ──────────────────────────────────────────────────

  /**
   * List in-app notifications for a user. Role-addressed notifications
   * (where recipient_id is a role name) are included when the user holds
   * that role — pass the user's roles array.
   */
  async list(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number; roles?: Role[] },
  ): Promise<Notification[]> {
    const { unreadOnly = false, limit = 50, roles = [] } = opts ?? {};

    const recipientConditions = ['recipient_id = $1'];
    const params: unknown[] = [userId];
    let idx = 2;

    if (roles.length > 0) {
      recipientConditions.push(`recipient_id = ANY($${idx})`);
      params.push(roles);
      idx++;
    }

    const where = [
      `(${recipientConditions.join(' OR ')})`,
      `channel = 'in_app'`,
    ];
    if (unreadOnly) where.push(`status != 'read'`);

    params.push(limit);
    const rows = await this.deps.db.query<Record<string, unknown>>(
      `SELECT * FROM app.notifications
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      params,
    );

    return rows.map(mapRow);
  }

  /** Count unread in-app notifications for a user (+ their roles). */
  async unreadCount(userId: string, roles?: Role[]): Promise<number> {
    const recipientConditions = ['recipient_id = $1'];
    const params: unknown[] = [userId];
    let idx = 2;

    if (roles && roles.length > 0) {
      recipientConditions.push(`recipient_id = ANY($${idx})`);
      params.push(roles);
      idx++;
    }

    const row = await this.deps.db.one<Record<string, unknown>>(
      `SELECT COUNT(*)::int AS count FROM app.notifications
       WHERE (${recipientConditions.join(' OR ')})
         AND channel = 'in_app'
         AND status != 'read'`,
      params,
    );

    return (row?.count as number) ?? 0;
  }

  /** Mark notifications as read. Pass specific ids or 'all'. */
  async markRead(
    userId: string,
    ids: string[] | 'all',
    roles?: Role[],
  ): Promise<number> {
    const recipientConditions = ['recipient_id = $1'];
    const params: unknown[] = [userId];
    let idx = 2;

    if (roles && roles.length > 0) {
      recipientConditions.push(`recipient_id = ANY($${idx})`);
      params.push(roles);
      idx++;
    }

    const where = [
      `(${recipientConditions.join(' OR ')})`,
      `channel = 'in_app'`,
      `status != 'read'`,
    ];

    if (ids !== 'all') {
      where.push(`id = ANY($${idx})`);
      params.push(ids);
    }

    const rows = await this.deps.db.query<Record<string, unknown>>(
      `UPDATE app.notifications
       SET status = 'read', read_at = NOW()
       WHERE ${where.join(' AND ')}
       RETURNING id`,
      params,
    );

    return rows.length;
  }

  /**
   * One in-app notification the user can see (addressed to them or to one of
   * their roles), or null.
   */
  async getVisible(id: string, userId: string, roles: Role[] = []): Promise<Notification | null> {
    const row = await this.deps.db.one<Record<string, unknown>>(
      `SELECT * FROM app.notifications
       WHERE id = $1
         AND channel = 'in_app'
         AND (recipient_id = $2 OR recipient_id = ANY($3))`,
      [id, userId, roles],
    );
    return row ? mapRow(row) : null;
  }

  // ── Share to Slack audit (build 5 session 50) ──

  /** Insert the audit row of one Share to Slack (channel 'slack'); returns its id. */
  async recordSlackShare(audit: SlackShareAudit): Promise<string | null> {
    const row = await this.deps.db.one<Record<string, unknown>>(
      `INSERT INTO app.notifications
         (recipient_id, event_type, channel, status, title, body, metadata)
       VALUES ($1, $2, 'slack', $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [audit.userId, SLACK_SHARE_EVENT_TYPE, audit.status, audit.title, audit.body, JSON.stringify(audit.metadata)],
    );
    return (row?.id as string | undefined) ?? null;
  }

  // ── Preferences ─────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const rows = await this.deps.db.query<Record<string, unknown>>(
      'SELECT * FROM app.notification_preferences WHERE user_id = $1',
      [userId],
    );
    return rows.map(mapPreferenceRow);
  }

  async updatePreferences(
    userId: string,
    prefs: Array<{
      eventType: NotificationEventType;
      channels: NotificationChannel[];
      digest: boolean;
    }>,
  ): Promise<NotificationPreference[]> {
    for (const pref of prefs) {
      await this.deps.db.one(
        `INSERT INTO app.notification_preferences
           (user_id, event_type, channels, digest, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, event_type)
         DO UPDATE SET channels = $3, digest = $4, updated_at = NOW()`,
        [userId, pref.eventType, pref.channels, pref.digest],
      );
    }
    return this.getPreferences(userId);
  }

  // ── Digest flush ────────────────────────────────────────────────────

  /**
   * Batch-deliver pending digest rows grouped by recipient + channel.
   * Returns the number of notifications flushed.
   */
  async flushDigests(): Promise<number> {
    const pending = await this.deps.db.query<Record<string, unknown>>(
      `SELECT id, recipient_id, channel, title, body
       FROM app.notifications
       WHERE status = 'pending' AND channel != 'in_app'
       ORDER BY recipient_id, channel, created_at`,
    );

    if (pending.length === 0) return 0;

    // Group by recipient_id + channel
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const row of pending) {
      const key = `${row.recipient_id as string}:${row.channel as string}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    let flushed = 0;

    for (const [_key, rows] of groups) {
      const channel = rows[0].channel as NotificationChannel;
      const dest = this.destinations.find((d) => d.channel === channel);
      if (!dest || !dest.enabled()) continue;

      const titles = rows.map((r) => r.title as string);
      const digestTitle = `${titles.length} notification${titles.length === 1 ? '' : 's'}`;
      const digestBody = titles.map((t) => `\u2022 ${t}`).join('\n');
      const ids = rows.map((r) => r.id as string);

      try {
        await dest.send({ title: digestTitle, body: digestBody });
        await this.deps.db.query(
          `UPDATE app.notifications SET status = 'sent' WHERE id = ANY($1)`,
          [ids],
        );
        flushed += ids.length;
      } catch (err) {
        logger.error('Digest delivery failed', {
          channel,
          count: ids.length,
          error: (err as Error).message,
        });
        await this.deps.db.query(
          `UPDATE app.notifications SET status = 'failed' WHERE id = ANY($1)`,
          [ids],
        );
      }
    }

    return flushed;
  }

  // ── Event subscriptions ─────────────────────────────────────────────

  /** Register domain-event handlers. Call once at startup. */
  subscribe(): void {
    const { events } = this.deps;

    events.on('asset.certified', async (event) => {
      const asset = await this.deps.db.one<Record<string, unknown>>(
        'SELECT display_name, name FROM app.assets WHERE id = $1',
        [event.assetId],
      );
      const assetName = (asset?.display_name ?? asset?.name ?? event.assetId) as string;
      await this.notify({
        eventType: 'asset.certified',
        recipientType: 'role',
        recipientId: 'steward',
        title: `Asset certified: ${assetName}`,
        metadata: { assetId: event.assetId },
      });
    });

    events.on('campaign.created', async (event) => {
      const campaign = await this.deps.db.one<Record<string, unknown>>(
        'SELECT name FROM app.campaigns WHERE id = $1',
        [event.campaignId],
      );
      const campaignName = (campaign?.name ?? event.campaignId) as string;
      await this.notify({
        eventType: 'campaign.created',
        recipientType: 'role',
        recipientId: 'reviewer',
        title: `New campaign: ${campaignName}`,
        metadata: { campaignId: event.campaignId },
      });
    });

    events.on('campaign.completed', async (event) => {
      const campaign = await this.deps.db.one<Record<string, unknown>>(
        'SELECT name FROM app.campaigns WHERE id = $1',
        [event.campaignId],
      );
      const campaignName = (campaign?.name ?? event.campaignId) as string;
      await this.notify({
        eventType: 'campaign.completed',
        recipientType: 'role',
        recipientId: 'reviewer',
        title: `Campaign completed: ${campaignName}`,
        metadata: { campaignId: event.campaignId },
      });
    });

    events.on('vote.milestone', async (event) => {
      await this.notify({
        eventType: 'vote.milestone',
        recipientType: 'user',
        recipientId: event.userId,
        title: `Achievement unlocked: ${event.badge}`,
        metadata: { badge: event.badge },
      });
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /** Look up a single preference row for (user, eventType). */
  private async getPreferencesForEvent(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<NotificationPreference | undefined> {
    const row = await this.deps.db.one<Record<string, unknown>>(
      `SELECT * FROM app.notification_preferences
       WHERE user_id = $1 AND event_type = $2`,
      [userId, eventType],
    );
    return row ? mapPreferenceRow(row) : undefined;
  }

  /**
   * Attempt to deliver a notification via its outbound destination,
   * retrying up to 3 times with exponential backoff (1s / 2s / 4s).
   * Updates the row to 'sent' on success or 'failed' after exhaustion.
   */
  private async deliverWithRetry(
    notificationId: string,
    channel: NotificationChannel,
    payload: { title: string; body?: string; link?: string },
  ): Promise<void> {
    const dest = this.destinations.find((d) => d.channel === channel);
    if (!dest || !dest.enabled()) return;

    // Initial attempt + up to 3 retries = 4 total attempts
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        await dest.send(payload);
        await this.deps.db.one(
          `UPDATE app.notifications SET status = 'sent' WHERE id = $1`,
          [notificationId],
        );
        return;
      } catch (err) {
        logger.warn('Delivery attempt failed', {
          notificationId,
          channel,
          attempt: attempt + 1,
          error: (err as Error).message,
        });
        if (attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt]);
        }
      }
    }

    // All retries exhausted
    await this.deps.db.one(
      `UPDATE app.notifications SET status = 'failed' WHERE id = $1`,
      [notificationId],
    );
    logger.error('Delivery failed after retries', { notificationId, channel });
  }
}
