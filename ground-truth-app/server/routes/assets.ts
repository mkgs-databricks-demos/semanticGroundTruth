// server/routes/assets.ts — /api/assets/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import {
  ReviewableQuerySchema,
  RegisterAssetBodySchema,
} from '../../shared/contracts/api';

export function registerAssetRoutes(app: Application, services: Services): void {
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

    const { assetId } = req.params;
    addSpanAttributes(res, { assetId });
    const asset = await services.assets.get(assetId);
    res.json(asset);
  }));

  // GET /api/assets/:assetId/versions
  app.get('/api/assets/:assetId/versions', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const { assetId } = req.params;
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
}
