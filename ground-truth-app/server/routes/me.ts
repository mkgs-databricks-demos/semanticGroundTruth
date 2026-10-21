// server/routes/me.ts — GET /api/me
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser, requireRole } from '../lib/context';

export function registerMeRoutes(app: Application, _services: Services): void {
  app.get('/api/me', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    res.json({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    });
  }));
}
