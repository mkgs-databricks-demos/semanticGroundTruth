// server/services/notification/slackShare.test.ts — Share to Slack routes + service (mocked MCP client)
// Build 5 · Session 50
//
// Runs the real registerSlackRoutes chain (flag -> RBAC -> validation ->
// handler) in-process with routeHarness.invoke, a fake MCP client and an
// in-memory notifications / assets / confidence store.

import type { Application, RequestHandler } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Asset, Notification } from '../../../shared/contracts/entities';
import { AppError, notFound } from '../../lib/errors';
import { findRoute, invoke, makeUser } from '../../lib/testing/routeHarness';
import type { Registration } from '../../lib/testing/routeHarness';
import { registerConfigRoutes } from '../../routes/config';
import { registerSlackRoutes } from '../../routes/slack';
import type { Services } from '../index';
import { SlackLoginRequiredError } from './destinations/slackMcp';
import type { SlackMcpApi } from './destinations/slackMcp';
import type { SlackShareAudit } from './notificationService';
import { SLACK_SHARE_TEXT_MAX, appOrigin, buildShareMessage, slackShareEnabled } from './slackShare';

const APP_URL = 'https://dev-semantic-ground-truth-123.aws.databricksapps.com';
const ASSET_ID = 'a0000000-0000-4000-8000-000000000001';
const NOTIF_ID = 'b0000000-0000-4000-8000-000000000001';
const ROLE_NOTIF_ID = 'c0000000-0000-4000-8000-000000000002';
const UNKNOWN_ID = 'd0000000-0000-4000-8000-00000000ffff';
const PERMALINK = 'https://acme.slack.com/archives/C0123ABCD/p1761600000000100';
const LOGIN_URL = 'https://example.cloud.databricks.com/login/slack';

const STEWARD = makeUser(['reviewer', 'steward'], { userId: 'steward-1', accessToken: 'tok-steward' });
const ADMIN = makeUser(['reviewer', 'steward', 'admin'], { userId: 'admin-1', accessToken: 'tok-admin' });
const REVIEWER = makeUser(['reviewer'], { userId: 'reviewer-1', accessToken: 'tok-reviewer' });

const ASSET = {
  id: ASSET_ID,
  assetType: 'metric_view',
  name: 'orders_mv',
  displayName: 'Orders',
  status: 'in_review',
} as unknown as Asset;

function notification(id: string, userId: string, metadata: Record<string, unknown> | null): Notification {
  return {
    id,
    userId,
    eventType: 'asset.certified',
    channel: 'in_app',
    status: 'sent',
    title: 'Asset certified: Orders',
    body: 'Confidence passed the threshold.',
    metadata,
    createdAt: '2026-10-28T00:00:00Z',
    readAt: null,
  };
}

type Mode = 'ok' | 'login' | 'rate' | 'forbidden';

interface Env {
  routes: Registration[];
  audits: SlackShareAudit[];
  sent: { tool: 'send' | 'draft'; channelId: string; text: string; token: string }[];
  tokens: string[];
  mode: Mode;
  auditFails: boolean;
}

function newEnv(): Env {
  const env: Env = { routes: [], audits: [], sent: [], tokens: [], mode: 'ok', auditFails: false };
  const notifications = [notification(NOTIF_ID, STEWARD.userId, { assetId: ASSET_ID }), notification(ROLE_NOTIF_ID, 'steward', null)];

  const fail = (): never => {
    if (env.mode === 'login') throw new SlackLoginRequiredError(LOGIN_URL);
    if (env.mode === 'rate') throw new AppError('RATE_LIMITED', 'Slack rate limit reached; try again later', { retryAfterSeconds: 30 });
    throw new AppError('FORBIDDEN', 'No EXECUTE privilege on system.ai.slack');
  };
  const clientFor = (token: string): SlackMcpApi => {
    env.tokens.push(token);
    return {
      searchChannels: async () => (env.mode === 'ok' ? [{ id: 'C0123ABCD', name: 'data-stewards' }] : fail()),
      send: async (channelId, text) => {
        if (env.mode !== 'ok') fail();
        env.sent.push({ tool: 'send', channelId, text, token });
        return { permalink: PERMALINK };
      },
      draft: async (channelId, text) => {
        if (env.mode !== 'ok') fail();
        env.sent.push({ tool: 'draft', channelId, text, token });
        return {};
      },
    };
  };

  const services = {
    notifications: {
      getVisible: async (id: string, userId: string, roles: string[] = []) =>
        notifications.find((n) => n.id === id && (n.userId === userId || roles.includes(n.userId))) ?? null,
      recordSlackShare: async (audit: SlackShareAudit) => {
        if (env.auditFails) throw new Error('db down');
        env.audits.push(audit);
        return `audit-${env.audits.length}`;
      },
    },
    assets: {
      get: async (id: string) => {
        if (id !== ASSET_ID) throw notFound(`Asset not found: ${id}`);
        return ASSET;
      },
    },
    db: {
      one: async (_sql: string, params?: unknown[]) => (params?.[0] === ASSET_ID ? { confidence: 0.834 } : null),
    },
  } as unknown as Services;

  const app: Record<string, unknown> = {};
  for (const m of ['get', 'post']) {
    app[m] = (path: string, ...handlers: RequestHandler[]) => {
      env.routes.push({ method: m.toUpperCase(), path, handlers });
      return app;
    };
  }
  registerSlackRoutes(app as unknown as Application, services, { clientFor });
  registerConfigRoutes(app as unknown as Application, services);
  return env;
}

const SHARE_NOTIF = 'POST /api/notifications/:id/share-slack';
const SHARE_ASSET = 'POST /api/assets/:assetId/share-slack';
const CHANNELS = 'GET /api/slack/channels';

function call(env: Env, key: string, input: Parameters<typeof invoke>[1]) {
  const [method, path] = key.split(' ');
  return invoke(findRoute(env.routes, method, path), input);
}

const errorCode = (body: unknown) => (body as { error: { code: string } }).error.code;

let savedEnv: Record<string, string | undefined>;
beforeEach(() => {
  savedEnv = { GT_SLACK_SHARE_ENABLED: process.env.GT_SLACK_SHARE_ENABLED, DATABRICKS_APP_URL: process.env.DATABRICKS_APP_URL };
  delete process.env.GT_SLACK_SHARE_ENABLED;
  process.env.DATABRICKS_APP_URL = APP_URL;
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('Share to Slack routes', () => {
  it('a reviewer gets 403 on every route and nothing is sent', async () => {
    const env = newEnv();
    const inputs = {
      [SHARE_NOTIF]: { params: { id: NOTIF_ID }, body: { channelId: 'C0123ABCD', mode: 'draft' } },
      [SHARE_ASSET]: { params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'draft' } },
      [CHANNELS]: { query: { query: 'data' } },
    };
    for (const [key, input] of Object.entries(inputs)) {
      const res = await call(env, key, { user: REVIEWER, ...input });
      expect(res.status, key).toBe(403);
      expect(errorCode(res.body), key).toBe('FORBIDDEN');
    }
    expect(env.sent).toEqual([]);
    expect(env.tokens).toEqual([]);
  });

  it('steward draft of an asset -> drafted, with the user token, and one audit row', async () => {
    const env = newEnv();
    const res = await call(env, SHARE_ASSET, {
      user: STEWARD,
      params: { assetId: ASSET_ID },
      body: { channelId: 'C0123ABCD', mode: 'draft', message: 'Please review this week.' },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({ status: 'drafted' });
    expect(env.tokens).toEqual(['tok-steward']);
    expect(env.sent).toHaveLength(1);
    const { tool, channelId, text } = env.sent[0];
    expect(tool).toBe('draft');
    expect(channelId).toBe('C0123ABCD');
    expect(text).toContain('Asset: Orders (metric_view)');
    expect(text).toContain('Status: in_review');
    expect(text).toContain('Confidence: 83%');
    expect(text).toContain(`${APP_URL}/steward?asset=${ASSET_ID}`);
    expect(text).toContain('Note: Please review this week.');
    expect(env.audits).toEqual([{
      userId: STEWARD.userId,
      title: 'Shared to Slack: Orders',
      body: text,
      status: 'sent',
      metadata: { mode: 'draft', channelId: 'C0123ABCD', source: { type: 'asset', id: ASSET_ID }, shareStatus: 'drafted' },
    }]);
  });

  it('admin send of a notification -> sent + permalink + audit row with the permalink', async () => {
    const env = newEnv();
    // Admin sees the role-addressed notification (recipient "steward").
    const res = await call(env, SHARE_NOTIF, { user: ADMIN, params: { id: ROLE_NOTIF_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toEqual({ status: 'sent', permalink: PERMALINK });
    expect(env.sent[0].tool).toBe('send');
    expect(env.sent[0].token).toBe('tok-admin');
    expect(env.sent[0].text).toContain('Asset certified: Orders');
    expect(env.sent[0].text).toContain(`${APP_URL}/`);
    expect(env.audits).toHaveLength(1);
    expect(env.audits[0]).toMatchObject({
      userId: ADMIN.userId,
      status: 'sent',
      metadata: { mode: 'send', shareStatus: 'sent', permalink: PERMALINK, source: { type: 'notification', id: ROLE_NOTIF_ID } },
    });
  });

  it('a notification about an asset links to the asset and carries its lines', async () => {
    const env = newEnv();
    const res = await call(env, SHARE_NOTIF, { user: STEWARD, params: { id: NOTIF_ID }, body: { channelId: 'C0123ABCD', mode: 'draft' } });
    expect(res.status).toBe(200);
    expect(env.sent[0].text).toContain(`${APP_URL}/steward?asset=${ASSET_ID}`);
    expect(env.sent[0].text).toContain('Confidence: 83%');
  });

  it('login needed -> 200 needs_slack_login with the login URL; no audit row', async () => {
    const env = newEnv();
    env.mode = 'login';
    const res = await call(env, SHARE_ASSET, { user: STEWARD, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'needs_slack_login', loginUrl: LOGIN_URL });
    expect(env.audits).toEqual([]);
  });

  it('Slack 429 -> 429 RATE_LIMITED and a failed audit row', async () => {
    const env = newEnv();
    env.mode = 'rate';
    const res = await call(env, SHARE_ASSET, { user: STEWARD, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status).toBe(429);
    expect(errorCode(res.body)).toBe('RATE_LIMITED');
    expect(env.audits).toHaveLength(1);
    expect(env.audits[0]).toMatchObject({ status: 'failed', metadata: { errorCode: 'RATE_LIMITED', mode: 'send' } });
  });

  it('no EXECUTE on system.ai.slack -> 403 FORBIDDEN (channels too)', async () => {
    const env = newEnv();
    env.mode = 'forbidden';
    const res = await call(env, CHANNELS, { user: STEWARD, query: {} });
    expect(res.status).toBe(403);
    expect(errorCode(res.body)).toBe('FORBIDDEN');
  });

  it('unknown notification / asset -> 404 and nothing is sent', async () => {
    const env = newEnv();
    const body = { channelId: 'C0123ABCD', mode: 'send' };
    const a = await call(env, SHARE_NOTIF, { user: STEWARD, params: { id: UNKNOWN_ID }, body });
    const b = await call(env, SHARE_ASSET, { user: STEWARD, params: { assetId: UNKNOWN_ID }, body });
    expect([a.status, b.status]).toEqual([404, 404]);
    expect(env.sent).toEqual([]);
  });

  it('a notification addressed to another user is 404 for a steward', async () => {
    const env = newEnv();
    const res = await call(env, SHARE_NOTIF, { user: { ...STEWARD, userId: 'steward-2' }, params: { id: NOTIF_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status).toBe(404);
  });

  it('no OBO token -> 401 UNAUTHENTICATED (never the app SPN)', async () => {
    const env = newEnv();
    const res = await call(env, SHARE_ASSET, { user: { ...STEWARD, accessToken: undefined }, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status).toBe(401);
    expect(errorCode(res.body)).toBe('UNAUTHENTICATED');
    expect(env.tokens).toEqual([]);
  });

  it('GET /api/slack/channels returns { id, name }[]', async () => {
    const env = newEnv();
    const res = await call(env, CHANNELS, { user: STEWARD, query: { query: 'data' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'C0123ABCD', name: 'data-stewards' }]);
  });

  it('invalid body -> 400 BAD_REQUEST', async () => {
    const env = newEnv();
    const res = await call(env, SHARE_ASSET, { user: STEWARD, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'post' } });
    expect(res.status).toBe(400);
  });

  it('a failed audit write does not fail a share that reached Slack', async () => {
    const env = newEnv();
    env.auditFails = true;
    const res = await call(env, SHARE_ASSET, { user: STEWARD, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'sent', permalink: PERMALINK });
  });

  it('GT_SLACK_SHARE_ENABLED=false -> every route 404 (before RBAC) and /api/config reports false', async () => {
    process.env.GT_SLACK_SHARE_ENABLED = 'false';
    const env = newEnv();
    for (const [key, input] of [
      [SHARE_NOTIF, { user: STEWARD, params: { id: NOTIF_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } }],
      [SHARE_ASSET, { user: REVIEWER, params: { assetId: ASSET_ID }, body: { channelId: 'C0123ABCD', mode: 'send' } }],
      [CHANNELS, { user: ADMIN, query: {} }],
    ] as const) {
      const res = await call(env, key, input);
      expect(res.status, key).toBe(404);
      expect(errorCode(res.body), key).toBe('NOT_FOUND');
    }
    expect(env.sent).toEqual([]);
    const config = await call(env, 'GET /api/config', { user: REVIEWER });
    expect(config.body).toMatchObject({ slackShareEnabled: false });
  });

  it('/api/config reports slackShareEnabled true by default', async () => {
    const env = newEnv();
    const config = await call(env, 'GET /api/config', { user: REVIEWER });
    expect(config.body).toMatchObject({ slackShareEnabled: true });
  });
});

describe('Share to Slack helpers', () => {
  it('slackShareEnabled defaults to true; false/0/no/off disable it', () => {
    expect(slackShareEnabled({})).toBe(true);
    expect(slackShareEnabled({ GT_SLACK_SHARE_ENABLED: 'true' })).toBe(true);
    expect(slackShareEnabled({ GT_SLACK_SHARE_ENABLED: ' ' })).toBe(true);
    for (const v of ['false', 'FALSE', '0', 'no', 'off']) expect(slackShareEnabled({ GT_SLACK_SHARE_ENABLED: v }), v).toBe(false);
  });

  it('appOrigin prefers DATABRICKS_APP_URL, else a well-formed forwarded host', () => {
    expect(appOrigin({}, { DATABRICKS_APP_URL: `${APP_URL}/` })).toBe(APP_URL);
    expect(appOrigin({ 'x-forwarded-host': 'app.example.com, proxy' }, {})).toBe('https://app.example.com');
    expect(appOrigin({ host: 'evil.com/path?x=' }, {})).toBe('');
    expect(appOrigin(undefined, {})).toBe('');
  });

  it('buildShareMessage stays within 3,000 chars and keeps the link', () => {
    const link = `${APP_URL}/steward?asset=${ASSET_ID}`;
    const text = buildShareMessage({
      headline: 'H'.repeat(400),
      detail: 'D'.repeat(2900),
      asset: { name: 'Orders', assetType: 'metric_view', status: 'certified', confidence: null },
      link,
      note: 'N'.repeat(2000),
    });
    expect(text.length).toBeLessThanOrEqual(SLACK_SHARE_TEXT_MAX);
    expect(text).toContain(link);
    expect(text).toContain('Confidence: not scored yet');
    expect(text).toContain('Note: NNN');
  });
});
