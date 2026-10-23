// server/routes/assets.ts — /api/assets/*, /api/sources/*, /api/assets/import routes
// Session 09 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import {
  ReviewableQuerySchema,
  RegisterAssetBodySchema,
  RegisterSourceBodySchema,
  ImportAssetsBodySchema,
} from '../../shared/contracts/api';
import { SourceService } from '../services/sources';

export function registerAssetRoutes(app: Application, services: Services): void {
  // Construct SourceService here (plan 09: do not edit services/index.ts)
  const sources = new SourceService(services.db, services.assets, services.metricViews);

  // ── Assets CRUD ────────────────────────────────────────────────────────

  // GET /api/assets
  app.get('/api/assets', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(ReviewableQuerySchema, req.query);
    const result = await services.assets.list(query);
    res.json(result);
  }));

  // GET /api/assets/:assetId
  app.get('/api/assets/:assetId', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const assetId = String(req.params.assetId);
    addSpanAttributes(res, { assetId });
    const asset = await services.assets.get(assetId);
    res.json(asset);
  }));

  // GET /api/assets/:assetId/versions
  app.get('/api/assets/:assetId/versions', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const assetId = String(req.params.assetId);
    addSpanAttributes(res, { assetId });
    const versions = await services.assets.listVersions(assetId);
    res.json(versions);
  }));

  // POST /api/assets/register
  app.post('/api/assets/register', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const body = parseBody(RegisterAssetBodySchema, req.body);
    const result = await services.assets.register(body, user.userId);
    addSpanAttributes(res, { assetId: result.asset.id });
    res.status(result.created ? 201 : 200).json(result);
  }));

  // ── Import (conventions §4) ────────────────────────────────────────────

  // POST /api/assets/import
  app.post('/api/assets/import', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const body = parseBody(ImportAssetsBodySchema, req.body);
    const result = await sources.importAssets(user, body);
    res.json(result);
  }));

  // ── Sources (conventions §4) ───────────────────────────────────────────

  // GET /api/sources
  app.get('/api/sources', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const list = await sources.list();
    res.json(list);
  }));

  // POST /api/sources
  app.post('/api/sources', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const body = parseBody(RegisterSourceBodySchema, req.body);
    const source = await sources.register(body, user.userId);
    res.status(201).json(source);
  }));

  // POST /api/sources/:id/scan
  app.post('/api/sources/:id/scan', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const sourceId = String(req.params.id);
    addSpanAttributes(res, { sourceId });
    const result = await sources.scan(sourceId);
    res.json(result);
  }));
}
