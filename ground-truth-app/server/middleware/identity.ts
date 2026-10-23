import type { RequestHandler } from 'express';
import type { ConfigStore } from '../lib/config';
import type { MembershipService } from '../services/membership';
import type { UserContext, Role } from '../lib/context';
import { sendError } from '../lib/http';
import { unauthenticated } from '../lib/errors';
import { resolveRoles } from './roles';
import { addSpanAttributes } from './otel';

/**
 * Extract identity from Databricks Apps forwarded headers and set
 * `res.locals.user`. Scoped to `/api` and `/mcp` by `registerMiddleware`.
 *
 * - Dev mode (no headers + `NODE_ENV=development`): fall back to
 *   `DEV_USER_EMAIL` with all roles.
 * - Production `/api` without headers: 401 UNAUTHENTICATED.
 * - Production `/mcp` without headers: pass through without user
 *   (MCP handlers decide; SPN identity TBD — Decision 4).
 */
export function identityMiddleware(
  config: ConfigStore,
  membership: MembershipService,
): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        const email =
          req.headers['x-forwarded-email'] as string | undefined;
        const userId =
          req.headers['x-forwarded-user'] as string | undefined;
        const displayName =
          req.headers['x-forwarded-preferred-username'] as string | undefined;
        const accessToken =
          req.headers['x-forwarded-access-token'] as string | undefined;

        // req.baseUrl reflects the mount point ('/api' or '/mcp')
        const source: UserContext['source'] =
          req.baseUrl === '/mcp' ? 'mcp' : 'web';

        if (!email && !userId) {
          if (process.env.NODE_ENV === 'development') {
            const devEmail =
              process.env.DEV_USER_EMAIL ?? 'local-dev@example.com';
            const user: UserContext = {
              userId: devEmail,
              email: devEmail,
              displayName: 'Local Developer',
              source,
              roles: ['reviewer', 'steward', 'admin'] as Role[],
            };
            res.locals.user = user;
            addSpanAttributes(res, {
              'gt.user_id': user.userId,
              'gt.source': user.source,
            });
            next();
            return;
          }

          // Production: 401 for /api; pass-through for /mcp (Decision 4)
          if (req.baseUrl === '/api') {
            sendError(res, unauthenticated('Authentication required'));
            return;
          }
          next();
          return;
        }

        const userEmail = email ?? userId ?? '';
        const settings = await config.get();
        const roles = await resolveRoles(userEmail, settings, membership);

        const user: UserContext = {
          userId: userId ?? userEmail,
          email: userEmail,
          displayName: displayName ?? userEmail,
          accessToken: accessToken || undefined,
          source,
          roles,
        };

        res.locals.user = user;
        addSpanAttributes(res, {
          'gt.user_id': user.userId,
          'gt.source': user.source,
        });
        next();
      } catch (err: unknown) {
        sendError(res, err);
      }
    })();
  };
}
