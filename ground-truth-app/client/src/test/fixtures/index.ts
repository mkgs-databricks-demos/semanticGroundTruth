// client/src/test/fixtures/index.ts — sample data of figma_make_brief.md §1.1, typed with the contracts
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §4)
//
// One module per area. Each exports its fixtures plus a `<area>Routes` map
// keyed by ROUTE_CONTRACTS strings, ready for mockApi():
//
//   mockApi({ ...meRoutes, ...reviewRoutes });
//
// harness.test.tsx validates every entry of FIXTURE_ROUTES against its
// route's response schema, so a contract change breaks the fixture here.

import type { MockHandlers } from '../mockApi';
import { adminRoutes } from './admin';
import { conflictsRoutes } from './conflicts';
import { executiveRoutes } from './executive';
import { feedbackBranchesRoutes } from './feedbackBranches';
import { feedbackQueueRoutes } from './feedbackQueue';
import { leaderboardRoutes } from './leaderboard';
import { meRoutes } from './me';
import { notificationsRoutes } from './notifications';
import { reviewRoutes } from './review';
import { settingsRoutes } from './settings';
import { stewardRoutes } from './steward';

export * from './ids';
export * from './admin';
export * from './conflicts';
export * from './executive';
export * from './feedbackBranches';
export * from './feedbackQueue';
export * from './leaderboard';
export * from './me';
export * from './notifications';
export * from './review';
export * from './settings';
export * from './steward';

/** Every area's route map, by area name (the meta-test iterates this). */
export const FIXTURE_ROUTES: Readonly<Record<string, MockHandlers>> = {
  me: meRoutes,
  review: reviewRoutes,
  leaderboard: leaderboardRoutes,
  steward: stewardRoutes,
  executive: executiveRoutes,
  admin: adminRoutes,
  settings: settingsRoutes,
  feedbackQueue: feedbackQueueRoutes,
  conflicts: conflictsRoutes,
  feedbackBranches: feedbackBranchesRoutes,
  notifications: notificationsRoutes,
};
