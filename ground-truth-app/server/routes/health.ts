// server/routes/health.ts — GET /health (exempt from identity middleware)
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { logger } from '../lib/logger';
import { validate } from '../lib/validate';

interface RouterLayer {
  route?: { path?: unknown; methods?: Record<string, boolean> };
}

/**
 * AppKit's server plugin registers its own `GET /health` ({ status: 'ok' })
 * before `appkit.server.extend()` callbacks run, so it would shadow this route
 * and the contract fields (db, migrations, version) would never be served.
 * Remove any earlier GET /health route so the contract handler below answers.
 * Express 4 keeps the route stack on `app._router.stack`.
 */
export function removeEarlierHealthRoutes(app: Application): number {
  const router = (app as unknown as { _router?: { stack?: RouterLayer[] } })._router;
  const stack = router?.stack;
  if (!Array.isArray(stack)) return 0;
  const before = stack.length;
  const kept = stack.filter((layer) => !(layer.route?.path === '/health' && layer.route.methods?.get));
  stack.splice(0, stack.length, ...kept);
  return before - kept.length;
}

export function registerHealthRoutes(app: Application, services: Services): void {
  removeEarlierHealthRoutes(app);
  // Public (no role middleware); no request input.
  app.get('/health', validate({}), asyncRoute(async (_req, res) => {
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
