// server/services/campaign/lifecycle.ts — pure campaign state machine
// Session 07 · Wave 2 · No enum, no namespace, no default export

import type { CampaignStatus } from '../../../shared/contracts/values';
import { conflict } from '../../lib/errors';

/**
 * Allowed status transitions for campaigns.
 * active  → paused | completed | archived
 * paused  → active | archived
 * completed → archived
 * archived → (none)
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

/**
 * Assert that a campaign status transition is valid.
 * Throws a `conflict` AppError if the transition is not allowed.
 */
export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw conflict(`Cannot transition campaign from '${from}' to '${to}'`);
  }
}
