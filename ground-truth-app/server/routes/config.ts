// server/routes/config.ts — GET /api/config (runtime configuration)
// Session 20 · Wave 0 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { asyncRoute } from '../lib/http';
import { validate } from '../lib/validate';
import { requireRoleMiddleware } from '../middleware';
import type { AppRuntimeConfig } from '../../shared/contracts/config';

/**
 * Resolve the executive dashboard URL from environment.
 * Returns null for empty, missing, or non-https values.
 */
export function resolveExecDashboardUrl(): string | null {
  const raw = process.env.GT_EXEC_DASHBOARD_URL?.trim() ?? '';
  if (!raw) return null;
  if (!raw.startsWith('https://')) return null;
  return raw;
}

export function registerConfigRoutes(app: Application, _services: Services): void {
  app.get('/api/config', requireRoleMiddleware('reviewer'), validate({}), asyncRoute(async (_req, res) => {
    const config: AppRuntimeConfig = {
      executive_dashboard_url: resolveExecDashboardUrl(),
    };
    res.json(config);
  }));
}
