// server/routes/metricViews.ts — /api/metric-views/* and /api/catalog/* routes
// Session 09 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import {
  MetricViewListQuerySchema,
  CatalogSchemasQuerySchema,
  CatalogMetricViewsQuerySchema,
  MetricViewFullNameParamSchema,
} from '../../shared/contracts/api';

const NO_INPUT = {};
const SCHEMAS = { query: CatalogSchemasQuerySchema };
const CATALOG_VIEWS = { query: CatalogMetricViewsQuerySchema };
const LIST = { query: MetricViewListQuerySchema };
const FULL_NAME = { params: MetricViewFullNameParamSchema };

export function registerMetricViewRoutes(app: Application, services: Services): void {
  // ── Catalog browse (conventions §4) ────────────────────────────────────

  // GET /api/catalog/catalogs
  app.get('/api/catalog/catalogs', requireRoleMiddleware('steward'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const catalogs = await services.metricViews.listCatalogs(user.accessToken);
    res.json(catalogs);
  }));

  // GET /api/catalog/schemas?catalog=
  app.get('/api/catalog/schemas', requireRoleMiddleware('steward'), validate(SCHEMAS), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const { query } = validated(res, SCHEMAS);
    const schemas = await services.metricViews.listSchemas(user.accessToken, query.catalog);
    res.json(schemas);
  }));

  // GET /api/catalog/metric-views?catalog=&schema=
  app.get('/api/catalog/metric-views', requireRoleMiddleware('steward'), validate(CATALOG_VIEWS), asyncRoute(async (_req, res) => {
    const user = getUser(res);

    if (!user.accessToken) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'OBO token required' } });
      return;
    }
    const { query } = validated(res, CATALOG_VIEWS);
    const views = await services.metricViews.listMetricViews(
      user.accessToken,
      query.catalog,
      query.schema,
    );
    res.json(views);
  }));

  // ── Existing metric view routes ────────────────────────────────────────

  // GET /api/metric-views
  app.get('/api/metric-views', requireRoleMiddleware('reviewer'), validate(LIST), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { query } = validated(res, LIST);
    const views = await services.metricViews.list(user, query);
    res.json(views);
  }));

  // GET /api/metric-views/:fullName
  app.get('/api/metric-views/:fullName', requireRoleMiddleware('reviewer'), validate(FULL_NAME), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { fullName } = validated(res, FULL_NAME).params;
    const detail = await services.metricViews.get(user, fullName);
    res.json(detail);
  }));

  // POST /api/metric-views/:fullName/validate
  app.post('/api/metric-views/:fullName/validate', requireRoleMiddleware('reviewer'), validate(FULL_NAME), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { fullName } = validated(res, FULL_NAME).params;
    const result = await services.metricViews.validate(user, fullName);
    res.json(result);
  }));
}
