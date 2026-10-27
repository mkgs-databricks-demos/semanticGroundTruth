// server/routes/notifications.ts — /api/notifications/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import {
  NotificationListQuerySchema,
  MarkReadBodySchema,
  UpdatePreferencesBodySchema,
} from '../../shared/contracts/api';

const LIST = { query: NotificationListQuerySchema };
const MARK_READ = { body: MarkReadBodySchema };
const UPDATE_PREFS = { body: UpdatePreferencesBodySchema };
const NO_INPUT = {};

export function registerNotificationRoutes(app: Application, services: Services): void {
  // GET /api/notifications
  app.get('/api/notifications', requireRoleMiddleware('reviewer'), validate(LIST), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { query } = validated(res, LIST);
    const notifications = await services.notifications.list(user.userId, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
      roles: user.roles,
    });
    res.json(notifications);
  }));

  // GET /api/notifications/unread-count
  app.get('/api/notifications/unread-count', requireRoleMiddleware('reviewer'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    const count = await services.notifications.unreadCount(user.userId, user.roles);
    res.json({ count });
  }));

  // POST /api/notifications/read
  app.post('/api/notifications/read', requireRoleMiddleware('reviewer'), validate(MARK_READ), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, MARK_READ);
    const updated = await services.notifications.markRead(user.userId, body.ids, user.roles);
    res.json({ updated });
  }));

  // GET /api/notifications/preferences
  app.get('/api/notifications/preferences', requireRoleMiddleware('reviewer'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    const prefs = await services.notifications.getPreferences(user.userId);
    res.json(prefs);
  }));

  // PUT /api/notifications/preferences
  app.put('/api/notifications/preferences', requireRoleMiddleware('reviewer'), validate(UPDATE_PREFS), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, UPDATE_PREFS);
    const prefs = await services.notifications.updatePreferences(user.userId, body.preferences);
    res.json(prefs);
  }));
}
