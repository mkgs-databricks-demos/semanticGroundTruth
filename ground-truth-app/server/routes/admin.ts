// server/routes/admin.ts — /api/admin/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import { UpdateConfigBodySchema } from '../../shared/contracts/api';

export function registerAdminRoutes(app: Application, services: Services): void {
  // GET /api/admin/config
  app.get('/api/admin/config', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const settings = await services.config.get();
    res.json(settings);
  }));

  // PUT /api/admin/config
  app.put('/api/admin/config', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const body = parseBody(UpdateConfigBodySchema, req.body);
    const settings = await services.config.update(body, user.userId);
    res.json(settings);
  }));

  // GET /api/admin/summary
  app.get('/api/admin/summary', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const summary = await services.review.getExecutiveSummary();
    res.json(summary);
  }));

  // POST /api/admin/recompute/:assetId
  app.post('/api/admin/recompute/:assetId', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const assetId = String(req.params.assetId);
    addSpanAttributes(res, { assetId });
    const score = await services.review.recompute(assetId);
    res.json(score);
  }));
}
