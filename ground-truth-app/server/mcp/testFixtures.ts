// server/mcp/testFixtures.ts — contract-valid fixtures shared by the MCP tests (test-only)
// Session 34 · Wave 4-2 · No enum, no namespace, no default export

import type { ReviewCard, SkipResponse } from '../../shared/contracts/review';
import type { VoteResult } from '../../shared/contracts/api';
import type { UserStats } from '../../shared/contracts/entities';

export const ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';
export const NEXT_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
export const CAMPAIGN_ID = '550e8400-e29b-41d4-a716-4466554400c1';
const TS = '2026-10-25T12:00:00.000Z';

export function makeCard(id: string = ASSET_ID, overrides: Partial<ReviewCard['asset']> = {}): ReviewCard {
  const synonyms = [
    { id: `syn-${id}`, assetId: id, synonym: 'gross revenue', proposedBy: 'u1', approvals: 2, rejections: 0, createdAt: TS },
  ];
  return {
    asset: {
      id,
      assetType: 'measure',
      name: 'total_revenue',
      displayName: id === ASSET_ID ? 'Total Revenue' : 'Net Margin',
      description: 'Sum of all revenue line items',
      plainEnglishLogic: 'SUM(revenue) grouped by period',
      yamlContent: null,
      repoUrl: null,
      fixturePath: null,
      branch: null,
      environment: 'dev',
      targetCatalog: 'main',
      targetSchema: 'ground_truth',
      status: 'PENDING',
      domain: 'Finance',
      subdomain: 'Revenue',
      synonyms,
      sourceId: null,
      sourceMetadata: null,
      createdAt: TS,
      updatedAt: TS,
      ...overrides,
    },
    synonyms,
    examples: [
      { id: `ex-${id}`, assetId: id, questionText: 'What was total revenue last quarter?', proposedBy: 'u1', approved: true, createdAt: TS },
    ],
    confidence: {
      assetId: id,
      totalVotes: 10,
      approvals: 7,
      rejections: 2,
      edits: 1,
      wilsonLower: 0.4,
      wilsonUpper: 0.9,
      confidence: 0.72,
      lastVoteAt: TS,
      computedAt: TS,
    },
    campaign: { campaignId: CAMPAIGN_ID, name: 'Q4 Finance review' },
    reason: 'low_confidence',
    progress: { reviewed: 5, total: 20 },
  };
}

export function makeVoteResult(next: ReviewCard | null, voteType: 'approve' | 'reject' | 'edit' = 'approve'): VoteResult {
  return {
    vote: {
      id: 'vote-1',
      assetId: ASSET_ID,
      userId: 'u1',
      voteType,
      source: 'mcp',
      feedback: null,
      editDescription: null,
      editPlainEnglishLogic: null,
      editDisplayName: null,
      createdAt: TS,
    },
    confidence: { ...makeCard().confidence!, totalVotes: 11, approvals: 8, confidence: 0.75 },
    assetStatus: 'REVIEWED',
    next,
  };
}

export function makeSkipResponse(assetId: string = ASSET_ID): SkipResponse {
  return {
    skip: {
      id: 'skip-1',
      assetId,
      campaignId: CAMPAIGN_ID,
      reason: 'not_sure',
      versionHash: 'h1',
      source: 'mcp',
      createdAt: TS,
    },
    stats: { skippedCount: 3, skippedToday: 1 },
  };
}

export const USER_STATS: UserStats = {
  totalVotes: 42,
  approvals: 30,
  rejections: 8,
  edits: 4,
  skippedCount: 3,
  skippedToday: 1,
  currentStreakDays: 7,
  rank: 3,
  coveragePct: 65.5,
};
