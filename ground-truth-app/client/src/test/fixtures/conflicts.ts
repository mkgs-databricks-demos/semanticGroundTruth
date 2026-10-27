// client/src/test/fixtures/conflicts.ts — steward conflicts S9 (brief §1.1 "Conflict")
// Session 43 · Build 5 · wave 5-0

import type { ConflictGroup, ConflictResolutionResult } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { FIXTURE_NOW, hoursAgo, IDS } from './ids';

/** Readmission Rate, field description: proposal 1 (Ana Duarte) vs proposal 2 (Sam Okafor). */
export const conflictReadmissionRate: ConflictGroup = {
  assetId: IDS.assets.readmissionRate,
  displayName: 'Readmission Rate (30-day)',
  edits: [
    {
      voteId: IDS.votes.editAna,
      userId: IDS.users.ana,
      field: 'description',
      value:
        'Share of inpatient discharges followed by an unplanned inpatient readmission to any facility within 30 days.',
      createdAt: hoursAgo(5),
    },
    {
      voteId: IDS.votes.editSam,
      userId: IDS.users.sam,
      field: 'description',
      value: 'Percent of discharges with a readmission within 30 days, excluding planned admissions.',
      createdAt: hoursAgo(3),
    },
  ],
  rejectCount: 2,
  approveCount: 8,
};

export const conflicts: ConflictGroup[] = [conflictReadmissionRate];

/** POST /api/steward/conflicts/:assetId/resolve with accept_edit of proposal 2. */
export const resolutionAcceptEdit: ConflictResolutionResult = {
  assetId: IDS.assets.readmissionRate,
  resolution: 'accept_edit',
  resolvedVotes: 2,
  resolvedBy: IDS.users.priya,
  resolvedAt: FIXTURE_NOW,
};

export const conflictsRoutes = {
  'GET /api/steward/conflicts': conflicts,
  'POST /api/steward/conflicts/:assetId/resolve': resolutionAcceptEdit,
} satisfies MockHandlers;
