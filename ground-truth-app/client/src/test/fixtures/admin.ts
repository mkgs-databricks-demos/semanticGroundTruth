// client/src/test/fixtures/admin.ts — admin page S6: scoring config and app groups
// Session 43 · Build 5 · wave 5-0

import type { AppGroup, ScoringConfig } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS } from './ids';

/** GET /api/admin/config (skip cooldown at its 24 h default). */
export const scoringConfig: ScoringConfig = {
  wilsonZ: 1.96,
  industryPrior: 0.7,
  priorWeight: 5,
  priorDecayThreshold: 20,
  certificationThreshold: 0.8,
  minVotesForCertification: 10,
  stalenessDays: 90,
  freshnessIntervalDays: 30,
  skipCooldownHours: 24,
  adminEmails: [],
  stewardEmails: [],
  seedSampleAssets: false,
  bootstrapAdminIds: [],
};

const created = hoursAgo(24 * 60);

/** GET /api/admin/groups: the three app groups, one member each except users (empty). */
export const appGroups: AppGroup[] = [
  {
    name: 'semantic-ground-truth-admins',
    role: 'admin',
    description: 'Configure scoring and manage members',
    members: [{ groupName: 'semantic-ground-truth-admins', memberId: IDS.users.jordan, addedBy: IDS.users.jordan, addedAt: created }],
    createdAt: created,
  },
  {
    name: 'semantic-ground-truth-stewards',
    role: 'steward',
    description: 'Run campaigns and triage feedback',
    members: [{ groupName: 'semantic-ground-truth-stewards', memberId: IDS.users.priya, addedBy: IDS.users.jordan, addedAt: hoursAgo(24 * 10) }],
    createdAt: created,
  },
  {
    name: 'semantic-ground-truth-users',
    role: 'reviewer',
    description: 'Review assets',
    members: [],
    createdAt: created,
  },
];

export const adminRoutes = {
  'GET /api/admin/config': scoringConfig,
  'PUT /api/admin/config': scoringConfig,
  'GET /api/admin/groups': appGroups,
} satisfies MockHandlers;
