// client/src/test/fixtures/feedbackBranches.ts — steward feedback branches S10 (brief §1.1 "Feedback branch")
// Session 43 · Build 5 · wave 5-0
//
// Session 44 (same wave) adds the required field `htmlUrl: string | null` to
// FeedbackBranch (plan 44 step 1). It is spread in from `branchLink()` so these
// fixtures compile and validate both before and after that contract lands
// (spread properties are not excess-property checked, and zod strips unknown
// keys on the old schema). Screen tests that assert on the link add their own
// variants next to their tests (plan 43).

import type { FeedbackBranch } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS } from './ids';

/** Fictional remote of the feedback Git folder (plan 44: `<repo>/tree/<branch>`). */
export const FEEDBACK_REPO_URL = 'https://github.com/example-org/semantic-layer';

/** The `htmlUrl` field of plan 44: null when there is no branch to link. */
export function branchLink(branchName: string | null): { htmlUrl: string | null } {
  return { htmlUrl: branchName ? `${FEEDBACK_REPO_URL}/tree/${branchName}` : null };
}

const FILES = [
  'ground-truth-infra/fixtures/metric_views/mv_clinical_quality.yaml',
  'ground-truth-infra/fixtures/semantics/clinical_quality/readmission_rate_30d.md',
];

/** mg-genie-feedback-20261024, proposed, 4 assets, created Oct 24, 2026 06:00. */
export const branchProposed: FeedbackBranch = {
  ...branchLink('mg-genie-feedback-20261024'),
  batchId: IDS.batches.proposed,
  branchName: 'mg-genie-feedback-20261024',
  status: 'proposed',
  assetCount: 4,
  files: FILES,
  summary: 'Description and synonym updates for 4 Clinical Quality assets.',
  createdAt: '2026-10-24T06:00:00.000Z',
  completedAt: '2026-10-24T06:04:00.000Z',
  reviewedBy: null,
};

export const branchInReview: FeedbackBranch = {
  ...branchLink('mg-genie-feedback-20261022'),
  batchId: IDS.batches.inReview,
  branchName: 'mg-genie-feedback-20261022',
  status: 'in_review',
  assetCount: 2,
  files: [FILES[0]],
  summary: 'Display name fix for Discharge Disposition.',
  createdAt: hoursAgo(50),
  completedAt: hoursAgo(49),
  reviewedBy: IDS.users.priya,
};

/** Failed before a branch was pushed, so there is nothing to link. */
export const branchFailed: FeedbackBranch = {
  ...branchLink(null),
  batchId: IDS.batches.failed,
  branchName: 'mg-genie-feedback-20261021',
  status: 'failed',
  assetCount: 1,
  files: [],
  summary: null,
  createdAt: hoursAgo(74),
  completedAt: null,
  reviewedBy: null,
};

/** GET /api/steward/feedback-branches: 3 cards. */
export const feedbackBranches: FeedbackBranch[] = [branchProposed, branchInReview, branchFailed];

export const feedbackBranchesRoutes = {
  'GET /api/steward/feedback-branches': feedbackBranches,
  'POST /api/steward/feedback-branches/:batchId/status': { ...branchProposed, status: 'in_review', reviewedBy: IDS.users.priya },
} satisfies MockHandlers;
