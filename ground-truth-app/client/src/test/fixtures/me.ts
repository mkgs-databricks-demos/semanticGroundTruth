// client/src/test/fixtures/me.ts — current user (figma_make_brief.md §1.1 "Current user")
// Session 43 · Build 5 · wave 5-0

import type { MeResponse, Role } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { IDS } from './ids';

/** Priya Raman, reviewer + steward (the brief's default user). */
export const me: MeResponse = {
  userId: IDS.users.priya,
  email: 'priya.raman@example.com',
  displayName: 'Priya Raman',
  roles: ['reviewer', 'steward'],
};

/** The same user with a different role set (S0 nav per role, S4-S6 forbidden states). */
export function meWithRoles(roles: Role[]): MeResponse {
  return { ...me, roles: [...roles] };
}

export const meReviewer = meWithRoles(['reviewer']);
export const meSteward = meWithRoles(['reviewer', 'steward']);
export const meAdmin = meWithRoles(['reviewer', 'steward', 'admin']);

export const meRoutes = {
  'GET /api/me': me,
} satisfies MockHandlers;
