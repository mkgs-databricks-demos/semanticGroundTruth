import type { RequestHandler } from 'express';
import type { Role } from '../lib/context';
import { getUser } from '../lib/context';
import type { AppSettings } from '../lib/config';
import type { MembershipService } from '../services/membership';
import { forbidden } from '../lib/errors';
import { sendError } from '../lib/http';

/**
 * Resolve the caller’s roles as the union of:
 *   1. `reviewer` (every authenticated caller)
 *   2. roles from app group membership (Lakebase tables)
 *   3. legacy email lists in app_config
 *
 * `admin` implies `steward` (conventions §3).
 */
export async function resolveRoles(
  email: string,
  settings: AppSettings,
  membership: MembershipService,
): Promise<Role[]> {
  const lower = email.toLowerCase();

  // App group roles (primary source)
  const groupRoles = await membership.rolesFor(lower);
  const roles = new Set<Role>(groupRoles);

  // Legacy email list roles (read-only fallback)
  const isAdmin = settings.adminEmails.some(
    (e) => e.toLowerCase() === lower,
  );
  const isSteward =
    isAdmin ||
    settings.stewardEmails.some((e) => e.toLowerCase() === lower);

  if (isSteward) roles.add('steward');
  if (isAdmin) roles.add('admin');

  // admin implies steward
  if (roles.has('admin')) roles.add('steward');

  // reviewer is always present
  roles.add('reviewer');

  return [...roles];
}

/** Role middleware; carries `requiredRole` so route tests can compare it with ROUTE_CONTRACTS. */
export type RoleMiddleware = RequestHandler & { requiredRole: Role };

export function requireRoleMiddleware(role: Role): RoleMiddleware {
  const middleware: RequestHandler = (_req, res, next) => {
    try {
      const user = getUser(res);
      const hierarchy: Record<Role, number> = {
        reviewer: 0,
        steward: 1,
        admin: 2,
      };
      const required = hierarchy[role];
      const highest = Math.max(
        ...user.roles.map((r) => hierarchy[r] ?? -1),
      );
      if (highest < required) {
        throw forbidden(`Requires role: ${role}`);
      }
      next();
    } catch (err) {
      sendError(res, err);
    }
  };
  return Object.assign(middleware, { requiredRole: role });
}
