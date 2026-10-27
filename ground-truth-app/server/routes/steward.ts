// server/routes/steward.ts — /api/steward/* (steward triage, G6 backend)
// Session 33 · Wave 4-1 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { getUser } from '../lib/context';
import { validate, validated } from '../lib/validate';
import { addSpanAttributes, requireRoleMiddleware } from '../middleware';
import {
  AssetIdParamSchema,
  BatchIdParamSchema,
  ConflictsQuerySchema,
  FeedbackBranchListQuerySchema,
  FeedbackQueueQuerySchema,
  ResolveConflictRequestSchema,
  UpdateFeedbackBranchStatusRequestSchema,
  UpsertFeedbackBranchRequestSchema,
} from '../../shared/contracts/api';

const QUEUE = { query: FeedbackQueueQuerySchema };
const CONFLICTS = { query: ConflictsQuerySchema };
const RESOLVE = { params: AssetIdParamSchema, body: ResolveConflictRequestSchema };
const BRANCHES = { query: FeedbackBranchListQuerySchema };
const UPSERT_BRANCH = { body: UpsertFeedbackBranchRequestSchema };
const BRANCH_STATUS = { params: BatchIdParamSchema, body: UpdateFeedbackBranchStatusRequestSchema };

export function registerStewardRoutes(app: Application, services: Services): void {
  // GET /api/steward/feedback-queue
  app.get('/api/steward/feedback-queue', requireRoleMiddleware('steward'), validate(QUEUE), asyncRoute(async (_req, res) => {
    const { query } = validated(res, QUEUE);
    res.json(await services.steward.feedbackQueue(query));
  }));

  // GET /api/steward/conflicts
  app.get('/api/steward/conflicts', requireRoleMiddleware('steward'), validate(CONFLICTS), asyncRoute(async (_req, res) => {
    const { query } = validated(res, CONFLICTS);
    res.json(await services.steward.conflicts(query));
  }));

  // POST /api/steward/conflicts/:assetId/resolve
  app.post('/api/steward/conflicts/:assetId/resolve', requireRoleMiddleware('steward'), validate(RESOLVE), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, RESOLVE);
    addSpanAttributes(res, { assetId: params.assetId });
    res.json(await services.steward.resolveConflict(user, params.assetId, body));
  }));

  // GET /api/steward/feedback-branches
  app.get('/api/steward/feedback-branches', requireRoleMiddleware('steward'), validate(BRANCHES), asyncRoute(async (_req, res) => {
    const { query } = validated(res, BRANCHES);
    res.json(await services.steward.listFeedbackBranches(query));
  }));

  // POST /api/steward/feedback-branches — admin: the feedback job calls it as the app's M2M service principal
  app.post('/api/steward/feedback-branches', requireRoleMiddleware('admin'), validate(UPSERT_BRANCH), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, UPSERT_BRANCH);
    const { branch, created } = await services.steward.upsertFeedbackBranch(user, body);
    addSpanAttributes(res, { batchId: branch.batchId });
    res.status(created ? 201 : 200).json(branch);
  }));

  // POST /api/steward/feedback-branches/:batchId/status
  app.post('/api/steward/feedback-branches/:batchId/status', requireRoleMiddleware('steward'), validate(BRANCH_STATUS), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { params, body } = validated(res, BRANCH_STATUS);
    addSpanAttributes(res, { batchId: params.batchId });
    res.json(await services.steward.updateFeedbackBranchStatus(user, params.batchId, body));
  }));
}
