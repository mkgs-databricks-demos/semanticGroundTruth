// server/routes/notifications.ts — /api/notifications/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import {
  NotificationListQuerySchema,
  MarkReadBodySchema,
  UpdatePreferencesBodySchema,
} from '../../shared/contracts/api';

export function registerNotificationRoutes(app: Application, services: Services): void {
  // GET /api/notifications
  app.get('/api/notifications', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(NotificationListQuerySchema, req.query);
    const notifications = await services.notifications.list(user.userId, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
      roles: user.roles,
    });
    res.json(notifications);
  }));

  // GET /api/notifications/unread-count
  app.get('/api/notifications/unread-count', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const count = await services.notifications.unreadCount(user.userId, user.roles);
    res.json({ count });
  }));

  // POST /api/notifications/read
  app.post('/api/notifications/read', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const body = parseBody(MarkReadBodySchema, req.body);
    const updated = await services.notifications.markRead(user.userId, body.ids, user.roles);
    res.json({ updated });
  }));

  // GET /api/notifications/preferences
  app.get('/api/notifications/preferences', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const prefs = await services.notifications.getPreferences(user.userId);
    res.json(prefs);
  }));

  // PUT /api/notifications/preferences
  app.put('/api/notifications/preferences', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const body = parseBody(UpdatePreferencesBodySchema, req.body);
    const prefs = await services.notifications.updatePreferences(user.userId, body.preferences);
    res.json(prefs);
  }));
}
