// server/routes/slack.ts — Share to Slack routes (G5 Option A)
// Build 5 · Session 44 (contract + stubs) · Session 50 implements the handlers · No default export
//
//   POST /api/notifications/:id/share-slack
//   POST /api/assets/:assetId/share-slack
//   GET  /api/slack/channels?query=
//
// Steward/admin only (requireRole is a minimum). The shares are user-initiated
// and go through system.ai.slack with the caller's OBO token, never the app SPN
// (docs/research/05_slack_mcp_notifications.md). Until session 50 lands, RBAC
// and request validation run and the handler answers 501 NOT_IMPLEMENTED.

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import {
  AssetIdParamSchema,
  NotificationIdParamSchema,
  ShareSlackRequestSchema,
  SlackChannelsQuerySchema,
} from '../../shared/contracts/api';

const SHARE_NOTIFICATION = { params: NotificationIdParamSchema, body: ShareSlackRequestSchema };
const SHARE_ASSET = { params: AssetIdParamSchema, body: ShareSlackRequestSchema };
const CHANNELS = { query: SlackChannelsQuerySchema };

/** Error message of the stub handlers (tests/contract checks it). */
export const SLACK_NOT_IMPLEMENTED_MESSAGE = 'Share to Slack is not available yet';

const notImplemented = asyncRoute(async () => {
  throw new AppError('NOT_IMPLEMENTED', SLACK_NOT_IMPLEMENTED_MESSAGE);
});

export function registerSlackRoutes(app: Application, _services: Services): void {
  // POST /api/notifications/:id/share-slack
  app.post('/api/notifications/:id/share-slack', requireRoleMiddleware('steward'), validate(SHARE_NOTIFICATION), notImplemented);

  // POST /api/assets/:assetId/share-slack
  app.post('/api/assets/:assetId/share-slack', requireRoleMiddleware('steward'), validate(SHARE_ASSET), notImplemented);

  // GET /api/slack/channels?query=
  app.get('/api/slack/channels', requireRoleMiddleware('steward'), validate(CHANNELS), notImplemented);
}
