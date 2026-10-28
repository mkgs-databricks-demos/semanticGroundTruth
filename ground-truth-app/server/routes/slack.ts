// server/routes/slack.ts — Share to Slack routes (G5 Option A)
// Build 5 · Session 44 (contract + stubs) · Session 50 (handlers) · No default export
//
//   POST /api/notifications/:id/share-slack
//   POST /api/assets/:assetId/share-slack
//   GET  /api/slack/channels?query=
//
// Steward/admin only (requireRole is a minimum). The shares are user-initiated
// and go through system.ai.slack with the caller's OBO token, never the app SPN
// (docs/research/05_slack_mcp_notifications.md). GT_SLACK_SHARE_ENABLED=false
// makes every route answer 404 before RBAC and validation (the feature looks absent).

import type { Application, RequestHandler } from 'express';
import type { Services } from '../services';
import { asyncRoute, sendError } from '../lib/http';
import { getUser } from '../lib/context';
import { notFound } from '../lib/errors';
import { validate, validated } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import { SlackShareService, appOrigin, slackShareEnabled } from '../services/notification/slackShare';
import type { SlackClientFactory } from '../services/notification/slackShare';
import {
  AssetIdParamSchema,
  NotificationIdParamSchema,
  ShareSlackRequestSchema,
  SlackChannelsQuerySchema,
} from '../../shared/contracts/api';

const SHARE_NOTIFICATION = { params: NotificationIdParamSchema, body: ShareSlackRequestSchema };
const SHARE_ASSET = { params: AssetIdParamSchema, body: ShareSlackRequestSchema };
const CHANNELS = { query: SlackChannelsQuerySchema };

/** Error message when GT_SLACK_SHARE_ENABLED is false. */
export const SLACK_SHARE_DISABLED_MESSAGE = 'Share to Slack is not enabled';

/** 404 when the feature flag is off (runs first, so the routes look absent). */
export const requireSlackShareEnabled: RequestHandler = (_req, res, next) => {
  if (!slackShareEnabled()) {
    sendError(res, notFound(SLACK_SHARE_DISABLED_MESSAGE));
    return;
  }
  next();
};

export interface SlackRouteOptions {
  /** Slack MCP client per OBO token (tests inject a fake; default: SlackMcpClient). */
  clientFor?: SlackClientFactory;
}

export function registerSlackRoutes(app: Application, services: Services, opts: SlackRouteOptions = {}): void {
  const share = new SlackShareService({
    notifications: services.notifications,
    assets: services.assets,
    db: services.db,
    clientFor: opts.clientFor,
  });

  // POST /api/notifications/:id/share-slack
  app.post('/api/notifications/:id/share-slack', requireSlackShareEnabled, requireRoleMiddleware('steward'), validate(SHARE_NOTIFICATION), asyncRoute(async (req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, SHARE_NOTIFICATION);
    res.json(await share.shareNotification(user, params.id, body, appOrigin(req.headers)));
  }));

  // POST /api/assets/:assetId/share-slack
  app.post('/api/assets/:assetId/share-slack', requireSlackShareEnabled, requireRoleMiddleware('steward'), validate(SHARE_ASSET), asyncRoute(async (req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, SHARE_ASSET);
    res.json(await share.shareAsset(user, params.assetId, body, appOrigin(req.headers)));
  }));

  // GET /api/slack/channels?query=
  app.get('/api/slack/channels', requireSlackShareEnabled, requireRoleMiddleware('steward'), validate(CHANNELS), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { query } = validated(res, CHANNELS);
    res.json(await share.searchChannels(user, query.query));
  }));
}
