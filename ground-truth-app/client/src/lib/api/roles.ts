// client/src/lib/api/roles.ts — client-side role hierarchy check
// Session 10 · Wave 3 · No enum, no namespace, no default export

import type { MeResponse } from '../../../../shared/contracts';
import type { Role } from '../../../../shared/contracts';

const ROLE_LEVEL: Record<Role, number> = {
  reviewer: 0,
  steward: 1,
  admin: 2,
};

/**
 * Returns true when the user holds the given role or a higher one.
 * admin > steward > reviewer.
 */
export function hasRole(me: MeResponse | undefined, role: Role): boolean {
  if (!me) return false;
  const required = ROLE_LEVEL[role];
  return me.roles.some((r) => ROLE_LEVEL[r] >= required);
}
