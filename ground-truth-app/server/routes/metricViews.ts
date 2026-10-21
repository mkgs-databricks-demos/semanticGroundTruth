// server/routes/metricViews.ts — /api/metric-views/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { MetricViewListQuerySchema } from '../../shared/contracts/api';

export function registerMetricViewRoutes(app: Application, services: Services): void {
  // GET /api/metric-views
  app.get('/api/metric-views', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(MetricViewListQuerySchema, req.query);
    const views = await services.metricViews.list(user, query);
    res.json(views);
  }));

  // GET /api/metric-views/:fullName
  app.get('/api/metric-views/:fullName', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const fullName = String(req.params.fullName);
    const detail = await services.metricViews.get(user, fullName);
    res.json(detail);
  }));

  // POST /api/metric-views/:fullName/validate
  app.post('/api/metric-views/:fullName/validate', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const fullName = String(req.params.fullName);
    const result = await services.metricViews.validate(user, fullName);
    res.json(result);
  }));
}
