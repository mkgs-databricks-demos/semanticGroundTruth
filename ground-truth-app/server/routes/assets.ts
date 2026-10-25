// server/routes/assets.ts — /api/assets/*, /api/sources/*, /api/assets/import routes
// Session 09 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { addSpanAttributes, requireRoleMiddleware } from '../middleware';
import {
  AssetIdParamSchema,
  ReviewableQuerySchema,
  RegisterAssetBodySchema,
  RegisterSourceBodySchema,
  ImportAssetsBodySchema,
  SourceIdParamSchema,
} from '../../shared/contracts/api';
import { SourceService } from '../services/sources';

const LIST = { query: ReviewableQuerySchema };
const ASSET_ID = { params: AssetIdParamSchema };
const REGISTER = { body: RegisterAssetBodySchema };
const IMPORT = { body: ImportAssetsBodySchema };
const REGISTER_SOURCE = { body: RegisterSourceBodySchema };
const SOURCE_ID = { params: SourceIdParamSchema };
const NO_INPUT = {};

export function registerAssetRoutes(app: Application, services: Services): void {
  // Construct SourceService here (plan 09: do not edit services/index.ts)
  const sources = new SourceService(services.db, services.assets, services.metricViews);

  // ── Assets CRUD ────────────────────────────────────────────────────────

  // GET /api/assets
  app.get('/api/assets', requireRoleMiddleware('reviewer'), validate(LIST), asyncRoute(async (_req, res) => {
    const { query } = validated(res, LIST);
    const result = await services.assets.list(query);
    res.json(result);
  }));

  // GET /api/assets/:assetId
  app.get('/api/assets/:assetId', requireRoleMiddleware('reviewer'), validate(ASSET_ID), asyncRoute(async (_req, res) => {
    const { assetId } = validated(res, ASSET_ID).params;
    addSpanAttributes(res, { assetId });
    const asset = await services.assets.get(assetId);
    res.json(asset);
  }));

  // GET /api/assets/:assetId/versions
  app.get('/api/assets/:assetId/versions', requireRoleMiddleware('reviewer'), validate(ASSET_ID), asyncRoute(async (_req, res) => {
    const { assetId } = validated(res, ASSET_ID).params;
    addSpanAttributes(res, { assetId });
    const versions = await services.assets.listVersions(assetId);
    res.json(versions);
  }));

  // POST /api/assets/register
  app.post('/api/assets/register', requireRoleMiddleware('steward'), validate(REGISTER), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, REGISTER);
    const result = await services.assets.register(body, user.userId);
    addSpanAttributes(res, { assetId: result.asset.id });
    res.status(result.created ? 201 : 200).json(result);
  }));

  // ── Import (conventions §4) ────────────────────────────────────────────

  // POST /api/assets/import
  app.post('/api/assets/import', requireRoleMiddleware('steward'), validate(IMPORT), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, IMPORT);
    const result = await sources.importAssets(user, body);
    res.json(result);
  }));

  // ── Sources (conventions §4) ───────────────────────────────────────────

  // GET /api/sources
  app.get('/api/sources', requireRoleMiddleware('steward'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const list = await sources.list();
    res.json(list);
  }));

  // POST /api/sources
  app.post('/api/sources', requireRoleMiddleware('steward'), validate(REGISTER_SOURCE), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, REGISTER_SOURCE);
    const source = await sources.register(body, user.userId);
    res.status(201).json(source);
  }));

  // POST /api/sources/:id/scan
  app.post('/api/sources/:id/scan', requireRoleMiddleware('steward'), validate(SOURCE_ID), asyncRoute(async (_req, res) => {
    const sourceId = validated(res, SOURCE_ID).params.id;
    addSpanAttributes(res, { sourceId });
    const result = await sources.scan(sourceId);
    res.json(result);
  }));
}
