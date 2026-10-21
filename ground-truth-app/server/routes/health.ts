// server/routes/health.ts — GET /health (exempt from identity middleware)
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { logger } from '../lib/logger';

export function registerHealthRoutes(app: Application, services: Services): void {
  app.get('/health', asyncRoute(async (_req, res) => {
    let dbOk = false;
    let migrationCount = 0;

    try {
      await services.db.one('SELECT 1 AS ok');
      dbOk = true;
    } catch (err) {
      logger.warn('Health check: DB unreachable', { error: (err as Error).message });
    }

    if (dbOk) {
      try {
        const row = await services.db.one<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM app._migrations',
        );
        migrationCount = row ? parseInt(row.count, 10) : 0;
      } catch {
        // _migrations table may not exist yet
      }
    }

    const status = dbOk ? 'ok' : 'degraded';
    res.json({
      status,
      db: dbOk,
      migrations: migrationCount,
      version: process.env.APP_VERSION ?? '0.0.0',
    });
  }));
}
