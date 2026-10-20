import type { Response } from 'express';
import { unauthenticated, forbidden } from './errors';

export type Role = 'reviewer' | 'steward' | 'admin';

export interface UserContext {
  userId: string;
  email: string;
  displayName: string;
  accessToken?: string;
  source: 'web' | 'mcp' | 'agent';
  roles: Role[];
}

const ROLE_HIERARCHY: Record<Role, number> = {
  reviewer: 0,
  steward: 1,
  admin: 2,
};

export function getUser(res: Response): UserContext {
  const user = (res.locals as { user?: UserContext }).user;
  if (!user) {
    throw unauthenticated('No authenticated user');
  }
  return user;
}

export function requireRole(user: UserContext, role: Role): void {
  const required = ROLE_HIERARCHY[role];
  const highest = Math.max(...user.roles.map((r) => ROLE_HIERARCHY[r] ?? -1));
  if (highest < required) {
    throw forbidden(`Requires role: ${role}`);
  }
}

export function hasRole(user: UserContext, role: Role): boolean {
  const required = ROLE_HIERARCHY[role];
  const highest = Math.max(...user.roles.map((r) => ROLE_HIERARCHY[r] ?? -1));
  return highest >= required;
}
