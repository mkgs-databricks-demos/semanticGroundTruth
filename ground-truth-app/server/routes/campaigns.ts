// server/routes/campaigns.ts — /api/campaigns/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { addSpanAttributes, requireRoleMiddleware } from '../middleware';
import {
  CampaignIdParamSchema,
  CreateCampaignBodySchema,
  UpdateCampaignStatusBodySchema,
  CampaignListQuerySchema,
} from '../../shared/contracts/api';

const LIST = { query: CampaignListQuerySchema };
const CREATE = { body: CreateCampaignBodySchema };
const CAMPAIGN_ID = { params: CampaignIdParamSchema };
const UPDATE_STATUS = { params: CampaignIdParamSchema, body: UpdateCampaignStatusBodySchema };
const NO_INPUT = {};

export function registerCampaignRoutes(app: Application, services: Services): void {
  // GET /api/campaigns
  app.get('/api/campaigns', requireRoleMiddleware('reviewer'), validate(LIST), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { query } = validated(res, LIST);
    const campaigns = await services.campaigns.list(user, query);
    res.json(campaigns);
  }));

  // POST /api/campaigns
  app.post('/api/campaigns', requireRoleMiddleware('steward'), validate(CREATE), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, CREATE);
    const campaign = await services.campaigns.create(body, user.userId);
    addSpanAttributes(res, { campaignId: campaign.id });
    res.status(201).json(campaign);
  }));

  // GET /api/campaigns/:campaignId
  app.get('/api/campaigns/:campaignId', requireRoleMiddleware('reviewer'), validate(CAMPAIGN_ID), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { campaignId } = validated(res, CAMPAIGN_ID).params;
    addSpanAttributes(res, { campaignId });
    const campaign = await services.campaigns.get(user, campaignId);
    res.json(campaign);
  }));

  // PATCH /api/campaigns/:campaignId/status
  app.patch('/api/campaigns/:campaignId/status', requireRoleMiddleware('steward'), validate(UPDATE_STATUS), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, UPDATE_STATUS);
    const { campaignId } = params;
    addSpanAttributes(res, { campaignId });
    const campaign = await services.campaigns.updateStatus(campaignId, body.status, user.userId);
    res.json(campaign);
  }));

  // POST /api/campaigns/freshness-check
  app.post('/api/campaigns/freshness-check', requireRoleMiddleware('admin'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const result = await services.campaigns.runFreshnessCheck();
    res.json(result);
  }));
}
