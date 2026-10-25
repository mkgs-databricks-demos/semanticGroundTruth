// server/routes/review.ts — /api/review/* routes
// Session 09 · Wave 3 · No default export

import type { Application, RequestHandler } from 'express';
import type { Services } from '../services';
import { asyncRoute, sendError } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { badRequest } from '../lib/errors';
import { validate, validated } from '../lib/validate';
import { addSpanAttributes, requireRoleMiddleware } from '../middleware';
import {
  GetNextQuerySchema,
  VoteBodySchema,
  SynonymBodySchema,
  ExampleBodySchema,
  RunQueryBodySchema,
  SkipRequestSchema,
} from '../../shared/contracts/api';

const NEXT = { query: GetNextQuerySchema };
const VOTE = { body: VoteBodySchema };
const SKIP = { body: SkipRequestSchema };
const SYNONYM = { body: SynonymBodySchema };
const EXAMPLE = { body: ExampleBodySchema };
const RUN_QUERY = { body: RunQueryBodySchema };
const NO_INPUT = {};

/** Response header set when GET /api/review/next resurfaces a skipped asset (all eligible assets in cooldown). */
export const RESURFACED_FROM_SKIP_HEADER = 'x-gt-resurfaced-from-skip';

/**
 * Skip is not a vote (plan 25). Answer a legacy `voteType: 'skip'` with a
 * 400 that names the skip endpoint instead of the generic enum error.
 */
export const rejectSkipVote: RequestHandler = (req, res, next) => {
  const body = req.body as { voteType?: unknown } | undefined;
  if (body && body.voteType === 'skip') {
    sendError(
      res,
      badRequest('Skip is not a vote: use POST /api/review/skip', {
        issues: [{ path: ['voteType'], message: "'skip' is not a vote type; use POST /api/review/skip" }],
      }),
    );
    return;
  }
  next();
};

export function registerReviewRoutes(app: Application, services: Services): void {
  // GET /api/review/next (skip cooldown applied; see ReviewEngine.getNextWithMeta)
  app.get('/api/review/next', requireRoleMiddleware('reviewer'), validate(NEXT), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { query } = validated(res, NEXT);
    const { card, resurfacedFromSkip } = await services.review.getNextWithMeta(user, query);
    if (card) {
      addSpanAttributes(res, { assetId: card.asset.id, 'gt.resurfaced_from_skip': resurfacedFromSkip });
    }
    if (resurfacedFromSkip) {
      res.setHeader(RESURFACED_FROM_SKIP_HEADER, 'true');
    }
    res.json(card);
  }));

  // POST /api/review/vote
  app.post('/api/review/vote', requireRoleMiddleware('reviewer'), rejectSkipVote, validate(VOTE), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, VOTE);
    addSpanAttributes(res, { assetId: body.assetId });
    const result = await services.review.submitVote(user, body);
    res.json(result);
  }));

  // POST /api/review/skip — never changes votes or confidence
  app.post('/api/review/skip', requireRoleMiddleware('reviewer'), validate(SKIP), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, SKIP);
    addSpanAttributes(res, { assetId: body.assetId });
    const result = await services.review.skip(user, body, user.source);
    res.status(201).json(result);
  }));

  // POST /api/review/synonym (remove needs steward; checked below)
  app.post('/api/review/synonym', requireRoleMiddleware('reviewer'), validate(SYNONYM), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, SYNONYM);
    addSpanAttributes(res, { assetId: body.assetId });

    if (body.action === 'remove') {
      requireRole(user, 'steward');
    }

    switch (body.action) {
      case 'add':
        await services.assets.addSynonym(body.assetId, body.synonym, user.userId);
        break;
      case 'approve':
      case 'reject':
        await services.assets.voteSynonym(body.assetId, body.synonym, user.userId, body.action as 'approve' | 'reject');
        break;
      case 'remove':
        await services.assets.removeSynonym(body.assetId, body.synonym);
        break;
    }
    const synonyms = await services.assets.listSynonyms(body.assetId);
    res.json(synonyms);
  }));

  // POST /api/review/example
  app.post('/api/review/example', requireRoleMiddleware('reviewer'), validate(EXAMPLE), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, EXAMPLE);
    addSpanAttributes(res, { assetId: body.assetId });

    switch (body.action) {
      case 'add':
        await services.assets.addExample(body.assetId, body.questionText!, user.userId);
        break;
      case 'approve':
      case 'reject':
        await services.assets.voteExample(body.questionId!, user.userId, body.action as 'approve' | 'reject');
        break;
    }
    const examples = await services.assets.listExamples(body.assetId);
    res.json(examples);
  }));

  // POST /api/review/run-query
  app.post('/api/review/run-query', requireRoleMiddleware('reviewer'), validate(RUN_QUERY), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const { body } = validated(res, RUN_QUERY);
    addSpanAttributes(res, { assetId: body.assetId });
    const result = await services.review.runQuery(user, body.assetId);
    res.json(result);
  }));

  // GET /api/review/stats/me (includes skippedCount / skippedToday)
  app.get('/api/review/stats/me', requireRoleMiddleware('reviewer'), validate(NO_INPUT), asyncRoute(async (_req, res) => {
    const user = getUser(res);
    const stats = await services.review.getUserStats(user.userId);
    res.json(stats);
  }));
}
