// server/routes/review.ts — /api/review/* routes
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseBody, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { addSpanAttributes } from '../middleware';
import {
  GetNextQuerySchema,
  VoteBodySchema,
  SynonymBodySchema,
  ExampleBodySchema,
  RunQueryBodySchema,
} from '../../shared/contracts/api';

export function registerReviewRoutes(app: Application, services: Services): void {
  // GET /api/review/next
  app.get('/api/review/next', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(GetNextQuerySchema, req.query);
    const card = await services.review.getNext(user, query);
    if (card) {
      addSpanAttributes(res, { assetId: card.asset.id });
    }
    res.json(card);
  }));

  // POST /api/review/vote
  app.post('/api/review/vote', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const body = parseBody(VoteBodySchema, req.body);
    addSpanAttributes(res, { assetId: body.assetId });
    const result = await services.review.submitVote(user, body);
    res.json(result);
  }));

  // POST /api/review/synonym
  app.post('/api/review/synonym', asyncRoute(async (req, res) => {
    const user = getUser(res);
    const body = parseBody(SynonymBodySchema, req.body);
    addSpanAttributes(res, { assetId: body.assetId });

    if (body.action === 'remove') {
      requireRole(user, 'steward');
    } else {
      requireRole(user, 'reviewer');
    }

    let synonyms;
    switch (body.action) {
      case 'add':
        synonyms = await services.assets.addSynonym(body.assetId, body.synonym, user.userId);
        break;
      case 'approve':
      case 'reject':
        synonyms = await services.assets.voteSynonym(body.assetId, body.synonym, body.action, user.userId);
        break;
      case 'remove':
        synonyms = await services.assets.removeSynonym(body.assetId, body.synonym);
        break;
    }
    res.json(synonyms);
  }));

  // POST /api/review/example
  app.post('/api/review/example', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const body = parseBody(ExampleBodySchema, req.body);
    addSpanAttributes(res, { assetId: body.assetId });

    let examples;
    switch (body.action) {
      case 'add':
        examples = await services.assets.addExample(body.assetId, body.questionText!, user.userId);
        break;
      case 'approve':
      case 'reject':
        examples = await services.assets.voteExample(body.assetId, body.questionId!, body.action);
        break;
    }
    res.json(examples);
  }));

  // POST /api/review/run-query
  app.post('/api/review/run-query', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const body = parseBody(RunQueryBodySchema, req.body);
    addSpanAttributes(res, { assetId: body.assetId });
    const result = await services.review.runQuery(user, body.assetId);
    res.json(result);
  }));

  // GET /api/review/stats/me
  app.get('/api/review/stats/me', asyncRoute(async (_req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const stats = await services.review.getUserStats(user.userId);
    res.json(stats);
  }));
}
