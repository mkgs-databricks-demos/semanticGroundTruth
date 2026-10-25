// server/mcp/views/markdown.test.ts — vitest tests for markdown + HTML renderers
// Session 11 · Wave 4 · Written, not run (no Node toolchain in sessions)

import { describe, it, expect } from 'vitest';
import {
  CARD_ACTIONS_TEXT,
  EMPTY_QUEUE_TEXT,
  renderCardMarkdown,
  renderStatsMarkdown,
  renderCampaignsMarkdown,
  renderQueryResultMarkdown,
  renderSkipMarkdown,
  renderVoteMarkdown,
} from './markdown';
import { NEXT_ASSET_ID, makeCard, makeSkipResponse, makeVoteResult } from '../testFixtures';
import { renderCardHtml } from './cardHtml';
import type { ReviewCard } from '../../../shared/contracts/review';
import type { UserStats, Campaign, QueryResult } from '../../../shared/contracts/entities';

const mockCard: ReviewCard = {
  asset: {
    id: '00000000-0000-0000-0000-000000000001',
    assetType: 'measure',
    name: 'total_revenue',
    displayName: 'Total Revenue',
    description: 'Sum of all revenue line items',
    plainEnglishLogic: 'SUM(revenue) grouped by period',
    yamlContent: null,
    repoUrl: null,
    fixturePath: null,
    branch: null,
    environment: 'production',
    targetCatalog: 'main',
    targetSchema: 'finance',
    status: 'PENDING',
    domain: 'Finance',
    subdomain: 'Revenue',
    sourceId: null,
    sourceMetadata: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    synonyms: [],
  },
  synonyms: [
    {
      id: 's1',
      assetId: '00000000-0000-0000-0000-000000000001',
      synonym: 'gross revenue',
      proposedBy: 'user1',
      approvals: 1,
      rejections: 0,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  examples: [
    {
      id: 'e1',
      assetId: '00000000-0000-0000-0000-000000000001',
      questionText: 'What was total revenue last quarter?',
      proposedBy: 'user1',
      approved: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  confidence: {
    assetId: '00000000-0000-0000-0000-000000000001',
    totalVotes: 10,
    approvals: 7,
    rejections: 2,
    edits: 1,
    wilsonLower: 0.45,
    wilsonUpper: 0.85,
    confidence: 0.45,
    lastVoteAt: '2026-01-10T00:00:00Z',
    computedAt: '2026-01-10T00:00:00Z',
  },
  campaign: { campaignId: 'c1', name: 'Q1 Review' },
  reason: 'low_confidence',
  progress: { reviewed: 5, total: 20 },
};

const mockStats: UserStats = {
  totalVotes: 42,
  approvals: 30,
  rejections: 8,
  edits: 4,
  currentStreakDays: 7,
  rank: 3,
  coveragePct: 65.5,
  skippedCount: 0,
  skippedToday: 0,
};

const mockCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Q1 Review',
    campaignType: 'manual',
    status: 'active',
    completionRule: 'reviewed_once',
    scopeDomain: null,
    scopeSubdomain: null,
    scopeAssetType: null,
    scopeAssetIds: null,
    rbacGroups: [],
    freshnessIntervalDays: null,
    totalAssets: 50,
    reviewedAssets: 20,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    completedAt: null,
  },
];

const mockQueryResult: QueryResult = {
  columns: ['name', 'value'],
  rows: [
    ['revenue', 1000000],
    ['cost', 500000],
  ],
  truncated: false,
};

describe('renderCardMarkdown', () => {
  it('includes asset name, type, status, and domain', () => {
    const md = renderCardMarkdown(mockCard);
    expect(md).toContain('Total Revenue');
    expect(md).toContain('measure');
    expect(md).toContain('PENDING');
    expect(md).toContain('Finance');
    expect(md).toContain('Revenue');
  });

  it('includes description and logic', () => {
    const md = renderCardMarkdown(mockCard);
    expect(md).toContain('Sum of all revenue line items');
    expect(md).toContain('SUM(revenue) grouped by period');
  });

  it('includes synonyms and examples', () => {
    const md = renderCardMarkdown(mockCard);
    expect(md).toContain('gross revenue');
    expect(md).toContain('What was total revenue last quarter?');
  });

  it('includes confidence and progress', () => {
    const md = renderCardMarkdown(mockCard);
    expect(md).toContain('45.0%');
    expect(md).toContain('10 votes');
    expect(md).toContain('5/20');
  });

  it('includes campaign name and reason', () => {
    const md = renderCardMarkdown(mockCard);
    expect(md).toContain('Q1 Review');
    expect(md).toContain('low_confidence');
  });

  it('escapes pipe characters in text', () => {
    const card: ReviewCard = {
      ...mockCard,
      asset: { ...mockCard.asset, displayName: 'Name | With Pipes' },
    };
    const md = renderCardMarkdown(card);
    expect(md).toContain('Name \\| With Pipes');
    expect(md).not.toContain('Name | With Pipes');
  });
});

describe('renderStatsMarkdown', () => {
  it('renders a markdown table with all stat fields', () => {
    const md = renderStatsMarkdown(mockStats);
    expect(md).toContain('42');
    expect(md).toContain('30');
    expect(md).toContain('8');
    expect(md).toContain('4');
    expect(md).toContain('7 days');
    expect(md).toContain('#3');
    expect(md).toContain('65.5%');
  });
});

describe('renderCampaignsMarkdown', () => {
  it('renders campaigns as a markdown table', () => {
    const md = renderCampaignsMarkdown(mockCampaigns);
    expect(md).toContain('Q1 Review');
    expect(md).toContain('manual');
    expect(md).toContain('active');
    expect(md).toContain('20/50');
    expect(md).toContain('40%');
  });

  it('returns a message when no campaigns', () => {
    const md = renderCampaignsMarkdown([]);
    expect(md).toContain('No campaigns found');
  });
});

describe('renderQueryResultMarkdown', () => {
  it('renders columns and rows', () => {
    const md = renderQueryResultMarkdown(mockQueryResult);
    expect(md).toContain('name');
    expect(md).toContain('value');
    expect(md).toContain('revenue');
    expect(md).toContain('1000000');
  });

  it('limits to 20 rows', () => {
    const bigResult: QueryResult = {
      columns: ['n'],
      rows: Array.from({ length: 25 }, (_, i) => [i]),
      truncated: false,
    };
    const md = renderQueryResultMarkdown(bigResult);
    expect(md).toContain('Showing 20 of 25 rows');
    // Rows 0–19 shown, row 20+ omitted
    expect(md).toContain('| 19 |');
    expect(md).not.toContain('| 20 |');
  });

  it('notes when result was truncated by server', () => {
    const truncated: QueryResult = { columns: ['x'], rows: [[1]], truncated: true };
    const md = renderQueryResultMarkdown(truncated);
    expect(md).toContain('truncated by the server');
  });

  it('returns message for empty results', () => {
    const md = renderQueryResultMarkdown({ columns: [], rows: [], truncated: false });
    expect(md).toBe('No results.');
  });
});

describe('renderCardHtml', () => {
  it('produces valid self-contained HTML with Databricks brand colours', () => {
    const html = renderCardHtml(mockCard);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('#FF3621');
    expect(html).toContain('#1B3139');
  });

  it('escapes HTML special characters', () => {
    const card: ReviewCard = {
      ...mockCard,
      asset: {
        ...mockCard.asset,
        displayName: '<script>alert("xss")</script>',
      },
    };
    const html = renderCardHtml(card);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes asset details', () => {
    const html = renderCardHtml(mockCard);
    expect(html).toContain('Total Revenue');
    expect(html).toContain('Sum of all revenue line items');
    expect(html).toContain('gross revenue');
  });
});

// Session 34 · Wave 4-2: the text fallback names the card's actions; vote/skip replies.
describe('session 34 text fallback', () => {
  it('card markdown ends with the available actions', () => {
    expect(renderCardMarkdown(mockCard).endsWith(CARD_ACTIONS_TEXT)).toBe(true);
    expect(CARD_ACTIONS_TEXT).toContain('review_skip_card');
    expect(CARD_ACTIONS_TEXT).toContain('a skip is not a vote');
  });

  it('query results render object cells as JSON', () => {
    const md = renderQueryResultMarkdown({ columns: ['k', 'v'], rows: [[{ a: 1 }, null]], truncated: false });
    expect(md).toContain('| {"a":1} |  |');
    expect(md).not.toContain('[object Object]');
  });

  it('stats show skips separately from votes', () => {
    const md = renderStatsMarkdown({ ...mockStats, skippedCount: 4, skippedToday: 2 });
    expect(md).toContain('| Skipped (not votes) | 4 (2 today) |');
  });

  it('vote markdown includes the next card, or the empty-queue text', () => {
    const result = makeVoteResult(makeCard(NEXT_ASSET_ID));
    const md = renderVoteMarkdown(result);
    expect(md.startsWith('Vote recorded: **approve**')).toBe(true);
    expect(md).toContain('**Next card:**');
    expect(md).toContain('## Net Margin');
    expect(renderVoteMarkdown(makeVoteResult(null)).endsWith(EMPTY_QUEUE_TEXT)).toBe(true);
  });

  it('skip markdown says a skip is not a vote and includes the next card', () => {
    const md = renderSkipMarkdown({ ...makeSkipResponse(), next: makeCard(NEXT_ASSET_ID) });
    expect(md).toContain('(reason: not_sure)');
    expect(md).toContain('A skip is not a vote');
    expect(md).toContain('Skipped 3 in total, 1 today.');
    expect(md).toContain('## Net Margin');
    const noReason = renderSkipMarkdown({ skip: { ...makeSkipResponse().skip, reason: null }, stats: makeSkipResponse().stats, next: null });
    expect(noReason).not.toContain('reason:');
    expect(noReason.endsWith(EMPTY_QUEUE_TEXT)).toBe(true);
  });
});
