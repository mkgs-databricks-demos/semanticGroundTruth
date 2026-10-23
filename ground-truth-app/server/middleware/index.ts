import type { Application } from 'express';
import type { ConfigStore } from '../lib/config';
import type { MembershipService } from '../services/membership';
import { requestLogMiddleware } from './requestLog';
import { otelAttributesMiddleware, addSpanAttributes } from './otel';
import { identityMiddleware } from './identity';
import { resolveRoles, requireRoleMiddleware } from './roles';

export function registerMiddleware(
  app: Application,
  deps: { config: ConfigStore; membership: MembershipService },
): void {
  // Request log and otel apply to all routes
  app.use(requestLogMiddleware());
  app.use(otelAttributesMiddleware());

  // Identity applies to /api and /mcp paths
  const identity = identityMiddleware(deps.config, deps.membership);
  app.use('/api', identity);
  app.use('/mcp', identity);
}

export {
  identityMiddleware,
  resolveRoles,
  requireRoleMiddleware,
  requestLogMiddleware,
  otelAttributesMiddleware,
  addSpanAttributes,
};
