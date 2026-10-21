// server/routes/leaderboard.ts — GET /api/leaderboard
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute, parseQuery } from '../lib/http';
import { getUser, requireRole } from '../lib/context';
import { LeaderboardQuerySchema } from '../../shared/contracts/api';

export function registerLeaderboardRoutes(app: Application, services: Services): void {
  app.get('/api/leaderboard', asyncRoute(async (req, res) => {
    const user = getUser(res);
    requireRole(user, 'reviewer');

    const query = parseQuery(LeaderboardQuerySchema, req.query);
    const entries = await services.review.getLeaderboard(query);
    res.json(entries);
  }));
}
