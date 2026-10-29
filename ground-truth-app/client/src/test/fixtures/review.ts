// client/src/test/fixtures/review.ts — review card, votes, skips, stats (brief §1.1)
// Session 43 · Build 5 · wave 5-0
//
// Asset A "Readmission Rate (30-day)" is the card on every review screen;
// assets B and C appear in lists. Values are fictional, not patient data.

import type {
  Asset,
  AssetSynonym,
  Campaign,
  ConfidenceScore,
  ExampleQuestion,
  ReviewCard,
  SkipResponse,
  UserStats,
  Vote,
  VoteResult,
} from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { FIXTURE_NOW, hoursAgo, IDS, TARGET_CATALOG, TARGET_SCHEMA } from './ids';

const A = IDS.assets.readmissionRate;

export const synonyms: AssetSynonym[] = [
  { id: IDS.synonyms.readmits30d, assetId: A, synonym: '30-day readmits', proposedBy: IDS.users.ana, approvals: 4, rejections: 0, createdAt: hoursAgo(72) },
  { id: IDS.synonyms.readmitRate, assetId: A, synonym: 'readmit rate', proposedBy: IDS.users.sam, approvals: 2, rejections: 1, createdAt: hoursAgo(48) },
  { id: IDS.synonyms.bounceBack, assetId: A, synonym: 'bounce-back rate', proposedBy: IDS.users.wei, approvals: 0, rejections: 3, createdAt: hoursAgo(24) },
];

function asset(overrides: Partial<Asset> & Pick<Asset, 'id' | 'assetType' | 'name' | 'displayName'>): Asset {
  return {
    description: null,
    plainEnglishLogic: null,
    yamlContent: null,
    repoUrl: null,
    fixturePath: null,
    branch: null,
    environment: 'dev',
    targetCatalog: TARGET_CATALOG,
    targetSchema: TARGET_SCHEMA,
    status: 'PENDING',
    domain: null,
    subdomain: null,
    synonyms: [],
    sourceId: null,
    sourceMetadata: null,
    createdAt: hoursAgo(24 * 30),
    updatedAt: hoursAgo(24 * 2),
    ...overrides,
  };
}

/** Asset A (measure). */
export const assetReadmissionRate: Asset = asset({
  id: A,
  assetType: 'measure',
  name: 'readmission_rate_30d',
  displayName: 'Readmission Rate (30-day)',
  domain: 'Clinical Quality',
  subdomain: 'Outcomes',
  description: 'Share of inpatient discharges followed by an unplanned readmission within 30 days.',
  plainEnglishLogic:
    'Count discharges with an unplanned inpatient admission within 30 days, divided by all eligible discharges. Excludes planned readmissions and transfers.',
  synonyms,
});

/** Asset B (dimension). */
export const assetDischargeDisposition: Asset = asset({
  id: IDS.assets.dischargeDisposition,
  assetType: 'dimension',
  name: 'discharge_disposition',
  displayName: 'Discharge Disposition',
  domain: 'Clinical Quality',
});

/** Asset C (page). */
export const assetLengthOfStay: Asset = asset({
  id: IDS.assets.lengthOfStay,
  assetType: 'page',
  name: 'length_of_stay',
  displayName: 'Length of Stay',
  domain: 'Operations',
  subdomain: 'Throughput',
});

export const assets: Asset[] = [assetReadmissionRate, assetDischargeDisposition, assetLengthOfStay];

export const examples: ExampleQuestion[] = [
  { id: IDS.examples.heartFailure, assetId: A, questionText: 'What was our 30-day readmission rate for heart failure patients last quarter?', proposedBy: IDS.users.jordan, approved: true, createdAt: hoursAgo(96) },
  { id: IDS.examples.units, assetId: A, questionText: 'Which units have the highest readmission rate this year?', proposedBy: IDS.users.ana, approved: false, createdAt: hoursAgo(30) },
];

/** 11 votes, confidence 0.71 (mid band). */
export const confidence: ConfidenceScore = {
  assetId: A,
  totalVotes: 11,
  approvals: 8,
  rejections: 2,
  edits: 1,
  wilsonLower: 0.43,
  wilsonUpper: 0.9,
  confidence: 0.71,
  lastVoteAt: hoursAgo(2),
  computedAt: hoursAgo(2),
};

export const campaign: Campaign = {
  id: IDS.campaigns.q4ClinicalQuality,
  name: 'Q4 Clinical Quality certification',
  campaignType: 'manual',
  status: 'active',
  completionRule: 'certified',
  scopeDomain: 'Clinical Quality',
  scopeSubdomain: null,
  scopeAssetType: null,
  scopeAssetIds: null,
  rbacGroups: [],
  freshnessIntervalDays: null,
  totalAssets: 120,
  reviewedAssets: 42,
  createdBy: IDS.users.priya,
  createdAt: hoursAgo(24 * 20),
  updatedAt: hoursAgo(2),
  completedAt: null,
};

/** GET /api/review/next: asset A in the Q4 campaign, 42 of 120 reviewed. */
export const reviewCard: ReviewCard = {
  asset: assetReadmissionRate,
  synonyms,
  examples,
  confidence,
  campaign: { campaignId: campaign.id, name: campaign.name },
  reason: 'campaign',
  progress: { reviewed: 42, total: 120 },
};

export const approveVote: Vote = {
  id: IDS.votes.approve,
  assetId: A,
  userId: IDS.users.priya,
  voteType: 'approve',
  source: 'web',
  feedback: null,
  editDescription: null,
  editPlainEnglishLogic: null,
  editDisplayName: null,
  createdAt: FIXTURE_NOW,
};

/** POST /api/review/vote (approve). */
export const voteResult: VoteResult = {
  vote: approveVote,
  confidence: { ...confidence, totalVotes: 12, approvals: 9, confidence: 0.74, lastVoteAt: FIXTURE_NOW, computedAt: FIXTURE_NOW },
  assetStatus: 'PENDING',
};

/** POST /api/review/skip (no reason); stats match "User stats" (3 skipped today). */
export const skipResponse: SkipResponse = {
  skip: {
    id: IDS.skips.first,
    assetId: A,
    campaignId: campaign.id,
    reason: null,
    versionHash: null,
    source: 'web',
    createdAt: FIXTURE_NOW,
  },
  stats: { skippedCount: 14, skippedToday: 3 },
};

/** GET /api/review/stats/me. */
export const userStats: UserStats = {
  totalVotes: 186,
  approvals: 131,
  rejections: 29,
  edits: 26,
  skippedCount: 14,
  skippedToday: 3,
  currentStreakDays: 6,
  rank: 3,
  coveragePct: 35,
};

export const reviewRoutes = {
  'GET /api/review/next': reviewCard,
  'POST /api/review/vote': voteResult,
  'POST /api/review/skip': skipResponse,
  'GET /api/review/stats/me': userStats,
  'GET /api/campaigns': [campaign],
} satisfies MockHandlers;
