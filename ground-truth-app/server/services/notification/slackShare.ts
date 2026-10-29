// server/services/notification/slackShare.ts — Share to Slack (G5 Option A)
// Build 5 · Session 50 · No default export
//
// User-initiated shares of a notification or an asset to a Slack channel,
// through system.ai.slack with the caller's OBO token (never the app SPN).
// Steward/admin RBAC is enforced by the routes (server/routes/slack.ts).
// Every share that reaches Slack, or fails there, is audited as an
// app.notifications row (channel 'slack', permalink in metadata).

import type { Asset, Notification } from '../../../shared/contracts/entities';
import type { ShareSlackRequest, ShareSlackResponse, SlackChannel } from '../../../shared/contracts/api';
import type { UserContext } from '../../lib/context';
import type { Db } from '../../lib/db';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { SlackLoginRequiredError, SlackMcpClient } from './destinations/slackMcp';
import type { SlackMcpApi } from './destinations/slackMcp';
import type { NotificationService, SlackShareAudit } from './notificationService';

/** Max length of the whole Slack message the app builds. */
export const SLACK_SHARE_TEXT_MAX = 3000;

const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

/** GT_SLACK_SHARE_ENABLED (default true). false / 0 / no / off turn Share to Slack off. */
export function slackShareEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.GT_SLACK_SHARE_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !FALSE_VALUES.has(raw);
}

/**
 * https origin of the app for deep links: DATABRICKS_APP_URL when set, else
 * the forwarded host of the request. Empty string when neither is usable
 * (links are then app-relative paths).
 */
export function appOrigin(
  headers: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const fromEnv = env.DATABRICKS_APP_URL?.trim();
  if (fromEnv && /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/?$/.test(fromEnv)) return fromEnv.replace(/\/+$/, '');
  const raw = headers?.['x-forwarded-host'] ?? headers?.host;
  const first = (Array.isArray(raw) ? raw[0] : raw) as unknown;
  const host = typeof first === 'string' ? first.split(',')[0].trim() : '';
  return /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) ? `https://${host}` : '';
}

/** App path a notification points at (metadata.assetId / batchId), default the review page. */
export function notificationPath(n: Pick<Notification, 'metadata'>): string {
  const meta = n.metadata ?? {};
  if (typeof meta.assetId === 'string' && meta.assetId) return assetPath(meta.assetId);
  if (typeof meta.batchId === 'string' && meta.batchId) return '/steward/feedback-branches';
  return '/';
}

export function assetPath(assetId: string): string {
  return `/steward?asset=${encodeURIComponent(assetId)}`;
}

export interface ShareAssetSummary {
  name: string;
  assetType: string;
  status: string;
  /** 0..1, null when the asset has no score yet. */
  confidence: number | null;
}

export interface ShareMessageInput {
  /** Notification title. */
  headline?: string;
  /** Notification body. */
  detail?: string;
  asset?: ShareAssetSummary;
  link: string;
  /** Optional note from the user who shares. */
  note?: string;
}

function clip(text: string, max: number): string {
  if (max <= 0) return '';
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}\u2026`;
}

export function formatConfidence(confidence: number | null): string {
  return confidence === null || !Number.isFinite(confidence) ? 'not scored yet' : `${Math.round(confidence * 100)}%`;
}

/**
 * Plain-text Slack message: headline, detail, asset name/type/status/confidence,
 * deep link, user note. At most SLACK_SHARE_TEXT_MAX chars: the notification
 * detail is shortened first, then the note; the link is always kept.
 */
export function buildShareMessage(input: ShareMessageInput): string {
  const head: string[] = [];
  if (input.headline?.trim()) head.push(input.headline.trim());
  const assetLines: string[] = [];
  if (input.asset) {
    const a = input.asset;
    assetLines.push(`Asset: ${a.name} (${a.assetType})`);
    assetLines.push(`Status: ${a.status} \u00b7 Confidence: ${formatConfidence(a.confidence)}`);
  }
  const linkLine = `Open in Semantic Ground Truth: ${input.link}`;
  let detail = input.detail?.trim() ?? '';
  let note = input.note?.trim() ?? '';

  const compose = () => [
    ...head.map((l) => clip(l, 500)),
    ...(detail ? [detail] : []),
    ...assetLines.map((l) => clip(l, 500)),
    linkLine,
    ...(note ? ['', `Note: ${note}`] : []),
  ].join('\n');

  let text = compose();
  if (text.length > SLACK_SHARE_TEXT_MAX && detail) {
    detail = clip(detail, Math.max(0, detail.length - (text.length - SLACK_SHARE_TEXT_MAX)));
    text = compose();
  }
  if (text.length > SLACK_SHARE_TEXT_MAX && note) {
    note = clip(note, Math.max(0, note.length - (text.length - SLACK_SHARE_TEXT_MAX)));
    text = compose();
  }
  return text.length > SLACK_SHARE_TEXT_MAX ? clip(text, SLACK_SHARE_TEXT_MAX) : text;
}

// ── Service ────────────────────────────────────────────────────────────────

export type SlackClientFactory = (token: string) => SlackMcpApi;

export const defaultSlackClientFactory: SlackClientFactory = (token) => new SlackMcpClient({ token });

export interface SlackShareDeps {
  notifications: Pick<NotificationService, 'getVisible' | 'recordSlackShare'>;
  assets: { get(assetId: string): Promise<Asset> };
  db: Pick<Db, 'one'>;
  clientFor?: SlackClientFactory;
}

interface ShareSource {
  type: 'notification' | 'asset';
  id: string;
}

export class SlackShareService {
  private readonly clientFor: SlackClientFactory;

  constructor(private readonly deps: SlackShareDeps) {
    this.clientFor = deps.clientFor ?? defaultSlackClientFactory;
  }

  /** GET /api/slack/channels */
  async searchChannels(user: UserContext, query?: string): Promise<SlackChannel[]> {
    return this.client(user).searchChannels(query ?? '');
  }

  /** POST /api/notifications/:id/share-slack */
  async shareNotification(user: UserContext, id: string, req: ShareSlackRequest, origin: string): Promise<ShareSlackResponse> {
    const client = this.client(user);
    const n = await this.deps.notifications.getVisible(id, user.userId, user.roles);
    if (!n) throw notFound(`Notification not found: ${id}`);
    const assetId = typeof n.metadata?.assetId === 'string' ? n.metadata.assetId : undefined;
    const asset = assetId ? await this.assetSummary(assetId, { optional: true }) : undefined;
    const text = buildShareMessage({
      headline: n.title,
      detail: n.body,
      asset,
      link: `${origin}${notificationPath(n)}`,
      note: req.message,
    });
    return this.share(client, user, req, text, `Shared to Slack: ${n.title}`, { type: 'notification', id });
  }

  /** POST /api/assets/:assetId/share-slack */
  async shareAsset(user: UserContext, assetId: string, req: ShareSlackRequest, origin: string): Promise<ShareSlackResponse> {
    const client = this.client(user);
    const asset = await this.assetSummary(assetId, { optional: false });
    const text = buildShareMessage({ asset, link: `${origin}${assetPath(assetId)}`, note: req.message });
    return this.share(client, user, req, text, `Shared to Slack: ${asset!.name}`, { type: 'asset', id: assetId });
  }

  // ── Private ──

  private client(user: UserContext): SlackMcpApi {
    if (!user.accessToken) {
      throw new AppError('UNAUTHENTICATED', 'Share to Slack needs your signed-in Databricks token (OBO)');
    }
    return this.clientFor(user.accessToken);
  }

  private async assetSummary(assetId: string, opts: { optional: boolean }): Promise<ShareAssetSummary | undefined> {
    let asset: Asset;
    try {
      asset = await this.deps.assets.get(assetId);
    } catch (err) {
      // A notification may point at an asset that was removed since: share it without asset lines.
      if (opts.optional && err instanceof AppError && err.code === 'NOT_FOUND') return undefined;
      throw err;
    }
    const row = await this.deps.db.one<{ confidence: unknown }>(
      'SELECT confidence FROM app.confidence_scores WHERE asset_id = $1',
      [assetId],
    );
    const confidence = row && row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : null;
    return {
      name: asset.displayName || asset.name,
      assetType: asset.assetType,
      status: asset.status,
      confidence: confidence !== null && Number.isFinite(confidence) ? confidence : null,
    };
  }

  private async share(
    client: SlackMcpApi,
    user: UserContext,
    req: ShareSlackRequest,
    text: string,
    title: string,
    source: ShareSource,
  ): Promise<ShareSlackResponse> {
    const base = { mode: req.mode, channelId: req.channelId, source };
    let permalink: string | undefined;
    try {
      const result = req.mode === 'send' ? await client.send(req.channelId, text) : await client.draft(req.channelId, text);
      permalink = result.permalink;
    } catch (err) {
      // Nothing reached Slack: the user must connect Slack first (no audit row).
      if (err instanceof SlackLoginRequiredError) {
        return { status: 'needs_slack_login', ...(err.loginUrl ? { loginUrl: err.loginUrl } : {}) };
      }
      const errorCode = err instanceof AppError ? err.code : 'INTERNAL';
      await this.audit({ userId: user.userId, title, body: text, status: 'failed', metadata: { ...base, errorCode } });
      throw err;
    }
    const status = req.mode === 'send' ? 'sent' : 'drafted';
    await this.audit({
      userId: user.userId,
      title,
      body: text,
      status: 'sent',
      metadata: { ...base, shareStatus: status, ...(permalink ? { permalink } : {}) },
    });
    return { status, ...(permalink ? { permalink } : {}) };
  }

  /**
   * Write the audit row. A failed audit write is logged and does not change the
   * response: the Slack call already happened, and failing the request would
   * make the user retry and post the message twice.
   */
  private async audit(entry: SlackShareAudit): Promise<void> {
    try {
      await this.deps.notifications.recordSlackShare(entry);
    } catch (err) {
      logger.error('Share to Slack audit row not written', {
        source: (entry.metadata.source as ShareSource | undefined)?.type,
        status: entry.status,
        error: (err as Error).message,
      });
    }
  }
}
