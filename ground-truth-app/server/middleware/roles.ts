import type { RequestHandler } from 'express';
import type { Role } from '../lib/context';
import { getUser } from '../lib/context';
import type { AppSettings } from '../lib/config';
import { forbidden } from '../lib/errors';
import { sendError } from '../lib/http';

export function resolveRoles(email: string, settings: AppSettings): Role[] {
  const lower = email.toLowerCase();
  const roles: Role[] = ['reviewer'];

  const isAdmin = settings.adminEmails.some(
    (e) => e.toLowerCase() === lower,
  );
  const isSteward =
    isAdmin ||
    settings.stewardEmails.some((e) => e.toLowerCase() === lower);

  if (isSteward) {
    roles.push('steward');
  }
  if (isAdmin) {
    roles.push('admin');
  }

  return roles;
}

export function requireRoleMiddleware(role: Role): RequestHandler {
  return (_req, res, next) => {
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
}
