// server/routes/me.ts — GET /api/me, GET|PUT /api/me/settings
// Session 09 · Wave 3 (settings: session 33 · wave 4-1) · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import { UpdateUserSettingsRequestSchema } from '../../shared/contracts/api';

const NO_INPUT = {};
const UPDATE_SETTINGS = { body: UpdateUserSettingsRequestSchema };

export function registerMeRoutes(app: Application, services: Services): void {
  // GET /api/me
  app.get('/api/me', requireRoleMiddleware('reviewer'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    res.json({
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
    });
  }));

  // GET /api/me/settings — defaults when the user has no row yet
  app.get('/api/me/settings', requireRoleMiddleware('reviewer'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    res.json(await services.settings.get(user.userId));
  }));

  // PUT /api/me/settings — partial update (upsert)
  app.put('/api/me/settings', requireRoleMiddleware('reviewer'), validate(UPDATE_SETTINGS), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, UPDATE_SETTINGS);
    res.json(await services.settings.update(user.userId, body));
  }));
}
