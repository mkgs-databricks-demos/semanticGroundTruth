// server/routes/campaigns.ts — /api/campaigns/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import {
  CreateCampaignBodySchema,
  UpdateCampaignStatusBodySchema,
  CampaignListQuerySchema,
} from '../../shared/contracts/api';

export function registerCampaignRoutes(app: Application, services: Services): void {
  // GET /api/campaigns
  app.get('/api/campaigns', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(CampaignListQuerySchema, req.query);
    const campaigns = await services.campaigns.list(user, query);
    res.json(campaigns);
  }));

  // POST /api/campaigns
  app.post('/api/campaigns', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const body = parseBody(CreateCampaignBodySchema, req.body);
    const campaign = await services.campaigns.create(body, user.userId);
    addSpanAttributes(res, { campaignId: campaign.id });
    res.status(201).json(campaign);
  }));

  // GET /api/campaigns/:campaignId
  app.get('/api/campaigns/:campaignId', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const campaignId = String(req.params.campaignId);
    addSpanAttributes(res, { campaignId });
    const campaign = await services.campaigns.get(user, campaignId);
    res.json(campaign);
  }));

  // PATCH /api/campaigns/:campaignId/status
  app.patch('/api/campaigns/:campaignId/status', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'steward');

    const campaignId = String(req.params.campaignId);
    addSpanAttributes(res, { campaignId });
    const body = parseBody(UpdateCampaignStatusBodySchema, req.body);
    const campaign = await services.campaigns.updateStatus(campaignId, body.status, user.userId);
    res.json(campaign);
  }));

  // POST /api/campaigns/freshness-check
  app.post('/api/campaigns/freshness-check', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const result = await services.campaigns.runFreshnessCheck();
    res.json(result);
  }));
}
