// client/src/test/fixtures/feedbackQueue.ts — steward feedback queue S8 (brief §1.1 "Feedback queue item")
// Session 43 · Build 5 · wave 5-0

import type { FeedbackQueueItem, Paged } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS } from './ids';
import { campaign } from './review';

/** Readmission Rate: 8 / 2 / 3 votes, 5 skips, 3 pending edits, last activity 2 hours ago. */
export const queueReadmissionRate: FeedbackQueueItem = {
  assetId: IDS.assets.readmissionRate,
  displayName: 'Readmission Rate (30-day)',
  assetType: 'measure',
  campaignId: campaign.id,
  votes: { approve: 8, reject: 2, edit: 3 },
  skips: 5,
  pendingEdits: 3,
  lastActivityAt: hoursAgo(2),
};

export const queueDischargeDisposition: FeedbackQueueItem = {
  assetId: IDS.assets.dischargeDisposition,
  displayName: 'Discharge Disposition',
  assetType: 'dimension',
  campaignId: campaign.id,
  votes: { approve: 3, reject: 1, edit: 1 },
  skips: 1,
  pendingEdits: 1,
  lastActivityAt: hoursAgo(26),
};

export const queueLengthOfStay: FeedbackQueueItem = {
  assetId: IDS.assets.lengthOfStay,
  displayName: 'Length of Stay',
  assetType: 'page',
  campaignId: null,
  votes: { approve: 0, reject: 0, edit: 0 },
  skips: 0,
  pendingEdits: 0,
  lastActivityAt: null,
};

/** GET /api/steward/feedback-queue (one page). */
export const feedbackQueue: Paged<FeedbackQueueItem> = {
  items: [queueReadmissionRate, queueDischargeDisposition, queueLengthOfStay],
  total: 3,
  limit: 50,
  offset: 0,
};

/** Empty queue (S8 empty state). */
export const feedbackQueueEmpty: Paged<FeedbackQueueItem> = { items: [], total: 0, limit: 50, offset: 0 };

export const feedbackQueueRoutes = {
  'GET /api/steward/feedback-queue': feedbackQueue,
} satisfies MockHandlers;
