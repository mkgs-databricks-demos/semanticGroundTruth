// server/routes/admin.ts — /api/admin/* routes
// Session 08 · Wave 1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import {
  UpdateConfigBodySchema,
  AddGroupMemberBodySchema,
  GroupNameParamSchema,
  RemoveGroupMemberParamSchema,
} from '../../shared/contracts/api';
import { z } from 'zod';

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

  // ── App Group Management (conventions §3) ────────────────────────────

  // GET /api/admin/groups
  app.get('/api/admin/groups', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const groups = await services.membership.listGroups();
    res.json(groups);
  }));

  // POST /api/admin/groups/:name/members
  app.post('/api/admin/groups/:name/members', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const params = GroupNameParamSchema.parse(req.params);
    const body = parseBody(AddGroupMemberBodySchema, req.body);

    await services.membership.addMember(params.name, body.memberId, user.userId);

    const groups = await services.membership.listGroups();
    const group = groups.find((g) => g.name === params.name);
    res.json(group ?? { name: params.name, members: [] });
  }));

  // DELETE /api/admin/groups/:name/members/:memberId
  app.delete('/api/admin/groups/:name/members/:memberId', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'admin');

    const params = RemoveGroupMemberParamSchema.parse(req.params);

    await services.membership.removeMember(params.name, params.memberId);

    const groups = await services.membership.listGroups();
    const group = groups.find((g) => g.name === params.name);
    res.json(group ?? { name: params.name, members: [] });
  }));
}
