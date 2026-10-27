// server/routes/leaderboard.ts — GET /api/leaderboard
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { validate, validated } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import { LeaderboardQuerySchema } from '../../shared/contracts/api';

const LEADERBOARD = { query: LeaderboardQuerySchema };

export function registerLeaderboardRoutes(app: Application, services: Services): void {
  // GET /api/leaderboard (entries include skippedCount for the period)
  app.get('/api/leaderboard', requireRoleMiddleware('reviewer'), validate(LEADERBOARD), asyncRoute(async (_req, res) => {
    const { query } = validated(res, LEADERBOARD);
    const entries = await services.review.getLeaderboard(query.period, query.limit);
    res.json(entries);
  }));
}
