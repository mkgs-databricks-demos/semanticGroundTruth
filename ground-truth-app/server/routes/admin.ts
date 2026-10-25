// server/routes/admin.ts — /api/admin/* routes
// Session 08 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { addSpanAttributes, requireRoleMiddleware } from '../middleware';
import {
  AssetIdParamSchema,
  UpdateConfigBodySchema,
  AddGroupMemberBodySchema,
  GroupNameParamSchema,
  RemoveGroupMemberParamSchema,
} from '../../shared/contracts/api';

const NO_INPUT = {};
const UPDATE_CONFIG = { body: UpdateConfigBodySchema };
const ASSET_ID = { params: AssetIdParamSchema };
const ADD_MEMBER = { params: GroupNameParamSchema, body: AddGroupMemberBodySchema };
const REMOVE_MEMBER = { params: RemoveGroupMemberParamSchema };

export function registerAdminRoutes(app: Application, services: Services): void {
  // GET /api/admin/config (scoring config incl. skipCooldownHours)
  app.get('/api/admin/config', requireRoleMiddleware('admin'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const settings = await services.config.get();
    res.json(settings);
  }));

  // PUT /api/admin/config (skipCooldownHours 0-720 -> app_config skip_cooldown_hours)
  app.put('/api/admin/config', requireRoleMiddleware('admin'), validate(UPDATE_CONFIG), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, UPDATE_CONFIG);
    const settings = await services.config.update(body, user.userId);
    res.json(settings);
  }));

  // GET /api/admin/summary
  app.get('/api/admin/summary', requireRoleMiddleware('steward'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const summary = await services.review.getExecutiveSummary();
    res.json(summary);
  }));

  // POST /api/admin/recompute/:assetId
  app.post('/api/admin/recompute/:assetId', requireRoleMiddleware('admin'), validate(ASSET_ID), asyncRoute(async (_req, res) => {
    const { assetId } = validated(res, ASSET_ID).params;
    addSpanAttributes(res, { assetId });
    const score = await services.review.recompute(assetId);
    res.json(score);
  }));

  // ── App Group Management (conventions §3) ────────────────────────────

  // GET /api/admin/groups
  app.get('/api/admin/groups', requireRoleMiddleware('admin'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const groups = await services.membership.listGroups();
    res.json(groups);
  }));

  // POST /api/admin/groups/:name/members
  app.post('/api/admin/groups/:name/members', requireRoleMiddleware('admin'), validate(ADD_MEMBER), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, ADD_MEMBER);

    await services.membership.addMember(params.name, body.memberId, user.userId);

    const groups = await services.membership.listGroups();
    const group = groups.find((g) => g.name === params.name);
    res.json(group ?? { name: params.name, members: [] });
  }));

  // DELETE /api/admin/groups/:name/members/:memberId
  app.delete('/api/admin/groups/:name/members/:memberId', requireRoleMiddleware('admin'), validate(REMOVE_MEMBER), asyncRoute(async (_req, res) => {
    const { params } = validated(res, REMOVE_MEMBER);

    await services.membership.removeMember(params.name, params.memberId);

    const groups = await services.membership.listGroups();
    const group = groups.find((g) => g.name === params.name);
    res.json(group ?? { name: params.name, members: [] });
  }));
}
