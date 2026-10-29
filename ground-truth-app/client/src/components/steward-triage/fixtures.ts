// @a11y-strict
// client/src/components/steward-triage/fixtures.ts — S8-S10 test fixtures that the shared set lacks
// Session 55 · Build 5 · wave 5-3
//
// Test-only (imported by the *.test.tsx files next to it). Built on the
// session-43 fixtures (client/src/test/fixtures, not edited here) and typed
// with the contracts, so mockApi validates every one against its schema.
//   * a queue row that earns "Often skipped" (skips >= total votes);
//   * a second conflict group (display_name, other authors) for J/K and
//     "next group" after a resolve;
//   * feedback branches with and without `htmlUrl` (session 44), a merged one
//     and a failed one with a failure reason.

import type { Asset, ConflictGroup, FeedbackBranch, FeedbackQueueItem, Paged } from '../../../../shared/contracts';
import {
  assetDischargeDisposition,
  assetLengthOfStay,
  assetReadmissionRate,
  branchFailed,
  branchInReview,
  branchLink,
  branchProposed,
  conflictReadmissionRate,
  feedbackQueue,
  hoursAgo,
  IDS,
  runtimeConfig,
} from '../../test/fixtures';
import type { MockRequest } from '../../test/mockApi';

// ── S8 ───────────────────────────────────────────────────────────────────────────

export const ED_BOARDING_ID = '0b0e7c1a-5d2f-4a8e-9c3b-1a2b3c4d5e04';

/** 2 votes, 4 skips: skips >= total votes, so the row gets "Often skipped". */
export const queueOftenSkipped: FeedbackQueueItem = {
  assetId: ED_BOARDING_ID,
  displayName: 'ED Boarding Hours',
  assetType: 'measure',
  campaignId: null,
  votes: { approve: 1, reject: 1, edit: 0 },
  skips: 4,
  pendingEdits: 0,
  lastActivityAt: hoursAgo(6),
};

export const queueWithOftenSkipped: Paged<FeedbackQueueItem> = {
  ...feedbackQueue,
  items: [...feedbackQueue.items, queueOftenSkipped],
  total: feedbackQueue.items.length + 1,
};

/** GET /api/assets/:assetId for the fixture assets (detail sheet, conflict current values). */
export function assetById(req: MockRequest): Asset {
  const all = [assetReadmissionRate, assetDischargeDisposition, assetLengthOfStay];
  const found = all.find((a) => a.id === req.params.assetId);
  if (!found) throw new Error(`fixtures: no asset ${req.params.assetId}`);
  return found;
}

export const assetDetailRoutes = {
  'GET /api/assets/:assetId': assetById,
  'GET /api/assets/:assetId/versions': [],
  // The sheet's Share to Slack action asks for the runtime config (plan 44).
  'GET /api/config': runtimeConfig,
};

// ── S9 ──────────────────────────────────────────────────────────────────────────

export const VOTE_EDIT_WEI = '9f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b11';
export const VOTE_EDIT_JORDAN = '9f4a5b6c-7d8e-4f9a-8b1c-2d3e4f5a6b12';

/** Discharge Disposition, field display_name: Wei Chen vs Jordan Lee. */
export const conflictDischargeDisposition: ConflictGroup = {
  assetId: IDS.assets.dischargeDisposition,
  displayName: 'Discharge Disposition',
  edits: [
    { voteId: VOTE_EDIT_WEI, userId: IDS.users.wei, field: 'display_name', value: 'Discharge Disposition Code', createdAt: hoursAgo(9) },
    { voteId: VOTE_EDIT_JORDAN, userId: IDS.users.jordan, field: 'display_name', value: 'Disposition at Discharge', createdAt: hoursAgo(8) },
  ],
  rejectCount: 1,
  approveCount: 3,
};

export const twoConflicts: ConflictGroup[] = [conflictReadmissionRate, conflictDischargeDisposition];

// ── S10 ────────────────────────────────────────────────────────────────────────

/** Proposed, with a Git link (htmlUrl from the server). */
export const branchWithLink: FeedbackBranch = { ...branchProposed, ...branchLink(branchProposed.branchName) };

/** In review, repo URL unknown on the server: htmlUrl null, copy only. */
export const branchNoLink: FeedbackBranch = { ...branchInReview, htmlUrl: null };

export const FAILURE_REASON = 'git push failed: the app service principal has no write access to the feedback repo.';

/** Failed, with the failure reason in `summary`. */
export const branchFailedWithReason: FeedbackBranch = { ...branchFailed, summary: FAILURE_REASON };

/** Merged, linked; no status actions (the server only reviews proposed / in_review). */
export const branchMerged: FeedbackBranch = {
  ...branchLink('mg-genie-feedback-20261018'),
  batchId: 'b16c7d8e-9f0a-4b1c-8d3e-4f5a6b7c8d04',
  branchName: 'mg-genie-feedback-20261018',
  status: 'merged',
  assetCount: 3,
  files: ['ground-truth-infra/fixtures/semantics/operations/length_of_stay.md'],
  summary: 'Plain English logic for Length of Stay.',
  createdAt: hoursAgo(24 * 6),
  completedAt: hoursAgo(24 * 6 - 1),
  reviewedBy: IDS.users.priya,
};

/** GET /api/steward/feedback-branches for the S10 tests. */
export const triageBranches: FeedbackBranch[] = [branchWithLink, branchNoLink, branchFailedWithReason];

export { branchFailed };
