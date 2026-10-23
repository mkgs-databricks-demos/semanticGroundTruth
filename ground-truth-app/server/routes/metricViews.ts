// server/routes/metricViews.ts — /api/metric-views/* and /api/catalog/* routes
// Session 09 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import {
  MetricViewListQuerySchema,
  CatalogSchemasQuerySchema,
  CatalogMetricViewsQuerySchema,
} from '../../shared/contracts/api';

export function registerMetricViewRoutes(app: Application, services: Services): void {
  // ── Catalog browse (conventions §4) ────────────────────────────────────

  // GET /api/catalog/catalogs
  app.get('/api/catalog/catalogs', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const catalogs = await services.metricViews.listCatalogs(user.accessToken);
    res.json(catalogs);
  }));

  // GET /api/catalog/schemas?catalog=
  app.get('/api/catalog/schemas', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const query = parseQuery(CatalogSchemasQuerySchema, req.query);
    const schemas = await services.metricViews.listSchemas(user.accessToken, query.catalog);
    res.json(schemas);
  }));

  // GET /api/catalog/metric-views?catalog=&schema=
  app.get('/api/catalog/metric-views', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const query = parseQuery(CatalogMetricViewsQuerySchema, req.query);
    const views = await services.metricViews.listMetricViews(
      user.accessToken,
      query.catalog,
      query.schema,
    );
    res.json(views);
  }));

  // ── Existing metric view routes ────────────────────────────────────────

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
