// tests/contract/toolCases.ts — one contract case per MCP_TOOL_CONTRACTS entry
// Session 35 · Wave 4-3 · test-only · No enum, no namespace, no default export
//
// happy: tools/call arguments and the exact structuredContent expected (after
// the call). invalid: arguments the contract input rejects. errors: app errors
// the tool must return as `isError` with `Error [<CODE>]: ...` text.

import type { UserContext } from '../../server/lib/context';
import type { ErrorCode } from '../../shared/contracts/errors';
import type { FakeStore } from './fakeStore';
import {
  BROKEN_METRIC_VIEW_FQN,
  CAMPAIGNS,
  EXAMPLES,
  IDS,
  METRIC_VIEW,
  METRIC_VIEW_FQN,
  NOW,
  QUERY_RESULT,
  REVIEWER,
  STEWARD,
  SYNONYMS,
} from './fixtures';
import { GEN } from './routeCases';

export interface ToolCall {
  user?: UserContext;
  args: Record<string, unknown>;
  setup?: (store: FakeStore) => void;
}

export interface ToolHappy extends ToolCall {
  expected: (store: FakeStore) => unknown;
  after?: (store: FakeStore) => void;
  /** Known server defect (request filed): the test runs as it.fails until fixed. */
  knownDefect?: string;
}

export interface ToolError extends ToolCall {
  code: ErrorCode;
  /** Exact error text after `Error [CODE]: ` when it matters. */
  message?: string;
  knownDefect?: string;
}

/**
 * Defects found by this suite in server code. Each test marked with one runs as
 * `it.fails`, so it turns red (and must be unmarked) the moment the server is
 * fixed. None open: session 36 fixed bareArrayStructuredContent (list tools now
 * return { items }) and oboErrorIsInternal (requireObo throws forbidden()).
 */
export const KNOWN_DEFECTS: Readonly<Record<string, string>> = {};

/** Reviewer with an OBO token (the metric view tools require one). */
export const REVIEWER_OBO: UserContext = { ...REVIEWER, accessToken: 'obo-token-reviewer' };

export interface ToolCase {
  happy: ToolHappy;
  /** Arguments the contract input schema rejects (SDK returns isError). */
  invalid: Record<string, unknown> | { na: string };
  errors?: ToolError[];
  /** Text-only result case for tools with `emptyText`. */
  empty?: ToolCall;
}

const SESSION_A3 = (s: FakeStore) => {
  s.mcpSessions.set(`user:${REVIEWER.userId}`, { current_asset_id: IDS.A3, campaign_id: IDS.C1, updated_at: NOW });
};
const summary = {
  fullName: METRIC_VIEW.fullName,
  comment: METRIC_VIEW.comment,
  measureCount: METRIC_VIEW.measureCount,
  dimensionCount: METRIC_VIEW.dimensionCount,
};

export const TOOL_CASES: Record<string, ToolCase> = {
  review_get_next: {
    happy: {
      args: {},
      expected: (s) => ({
        asset: s.asset(IDS.A3), synonyms: [], examples: [], confidence: null, reason: 'low_confidence', progress: { reviewed: 2, total: 5 },
      }),
      after: (s) => {
        if (s.mcpSessions.get(`user:${REVIEWER.userId}`)?.current_asset_id !== IDS.A3) throw new Error('session not set to A3');
      },
    },
    invalid: { campaign_id: 'c1' },
    errors: [{ args: { campaign_id: IDS.UNKNOWN }, code: 'NOT_FOUND' }],
    empty: { args: { asset_type: 'subdomain' } },
  },
  review_submit_vote: {
    // asset_id defaults to the MCP session's current asset (A3).
    happy: {
      args: { vote_type: 'edit', edits: { description: 'Sales region of the booking (ISO 3166).' } },
      setup: SESSION_A3,
      expected: (s) => ({
        vote: {
          id: GEN(1), assetId: IDS.A3, userId: REVIEWER.userId, voteType: 'edit', source: 'mcp', feedback: null,
          editDescription: 'Sales region of the booking (ISO 3166).', editPlainEnglishLogic: null, editDisplayName: null, createdAt: NOW,
        },
        confidence: s.confidence(IDS.A3),
        assetStatus: 'REVIEWED',
        next: {
          asset: s.asset(IDS.A4), synonyms: [], examples: [], confidence: null, reason: 'low_confidence', progress: { reviewed: 3, total: 5 },
        },
      }),
    },
    invalid: { asset_id: IDS.A3, vote_type: 'skip' },
    errors: [
      { args: { asset_id: IDS.UNKNOWN, vote_type: 'approve' }, code: 'NOT_FOUND' },
      { args: { vote_type: 'approve' }, code: 'BAD_REQUEST', message: 'No asset_id provided and no current review session asset.' },
    ],
  },
  review_add_synonym: {
    happy: {
      args: { asset_id: IDS.A1, action: 'approve', synonym: 'sales' },
      expected: () => ({ items: [SYNONYMS[0], { ...SYNONYMS[1], approvals: 2 }] }),
    },
    invalid: { asset_id: IDS.A1, action: 'merge', synonym: 'sales' },
    errors: [
      { args: { asset_id: IDS.A1, action: 'remove', synonym: 'sales' }, code: 'BAD_REQUEST', message: 'Removing synonyms requires steward role.' },
      { args: { asset_id: IDS.UNKNOWN, action: 'add', synonym: 'x' }, code: 'NOT_FOUND' },
    ],
  },
  review_add_example: {
    happy: {
      args: { asset_id: IDS.A1, action: 'add', question_text: 'Revenue by region this year?' },
      expected: () => ({
        items: [
          ...EXAMPLES,
          { id: GEN(1), assetId: IDS.A1, questionText: 'Revenue by region this year?', proposedBy: REVIEWER.userId, approved: false, createdAt: NOW },
        ],
      }),
    },
    invalid: { asset_id: IDS.A1, action: 'add', question_text: '' },
    errors: [{ args: { asset_id: IDS.A1, action: 'reject', question_id: IDS.UNKNOWN }, code: 'NOT_FOUND' }],
  },
  review_get_stats: {
    happy: {
      args: {},
      expected: () => ({
        totalVotes: 2, approvals: 1, rejections: 0, edits: 1, skippedCount: 0, skippedToday: 0, currentStreakDays: 2, rank: 1, coveragePct: 40,
      }),
    },
    invalid: { period: '1y' },
  },
  review_run_query: {
    happy: { args: { asset_id: IDS.A1 }, expected: () => QUERY_RESULT },
    invalid: { asset_id: 'a1' },
    errors: [
      { args: { asset_id: IDS.UNKNOWN }, code: 'NOT_FOUND' },
      { args: { asset_id: IDS.A1 }, setup: (s) => { s.upstreamDown = true; }, code: 'UPSTREAM_ERROR' },
    ],
  },
  campaign_list: {
    happy: { args: { status: 'paused' }, expected: () => ({ items: [CAMPAIGNS[1]] }) },
    invalid: { status: 'live' },
  },
  campaign_create: {
    happy: {
      user: STEWARD,
      args: { name: 'Customer pages', campaign_type: 'manual', scope_domain: 'Customer', scope_asset_type: 'page' },
      expected: () => ({
        id: GEN(1), name: 'Customer pages', campaignType: 'manual', status: 'active', completionRule: 'reviewed_once',
        scopeDomain: 'Customer', scopeSubdomain: null, scopeAssetType: 'page', scopeAssetIds: [IDS.A4], rbacGroups: [],
        freshnessIntervalDays: null, totalAssets: 1, reviewedAssets: 0, createdBy: STEWARD.userId, createdAt: NOW, updatedAt: NOW, completedAt: null,
      }),
    },
    invalid: { name: 'x', campaign_type: 'weekly' },
    errors: [{ user: REVIEWER, args: { name: 'x', campaign_type: 'manual' }, code: 'FORBIDDEN', message: 'Requires role: steward' }],
  },
  campaign_update_status: {
    happy: {
      user: STEWARD,
      args: { campaign_id: IDS.C2, status: 'active' },
      expected: () => ({ ...CAMPAIGNS[1], status: 'active', updatedAt: NOW, completedAt: null }),
    },
    invalid: { campaign_id: IDS.C2, status: 'done' },
    errors: [
      { user: REVIEWER, args: { campaign_id: IDS.C2, status: 'active' }, code: 'FORBIDDEN', message: 'Requires role: steward' },
      { user: STEWARD, args: { campaign_id: IDS.UNKNOWN, status: 'active' }, code: 'NOT_FOUND' },
      { user: STEWARD, args: { campaign_id: IDS.C1, status: 'active' }, code: 'CONFLICT', message: "Cannot transition campaign from 'active' to 'active'" },
    ],
  },
  metric_view_list: {
    happy: {
      user: REVIEWER_OBO,
      args: { catalog: 'hls_fde_dev', schema: 'ground_truth' },
      expected: () => ({ items: [summary] }),
    },
    invalid: { catalog: 42 },
    errors: [
      { user: REVIEWER_OBO, args: {}, setup: (s) => { s.upstreamDown = true; }, code: 'UPSTREAM_ERROR' },
      { args: {}, code: 'FORBIDDEN' },
    ],
  },
  metric_view_get: {
    happy: { user: REVIEWER_OBO, args: { full_name: METRIC_VIEW_FQN }, expected: () => METRIC_VIEW },
    invalid: { full_name: '' },
    errors: [
      { user: REVIEWER_OBO, args: { full_name: 'hls_fde_dev.ground_truth.mv_missing' }, code: 'NOT_FOUND' },
      { args: { full_name: METRIC_VIEW_FQN }, code: 'FORBIDDEN' },
    ],
  },
  metric_view_validate: {
    happy: {
      user: REVIEWER_OBO,
      args: { full_name: BROKEN_METRIC_VIEW_FQN },
      expected: () => ({ valid: false, error: '[UNRESOLVED_COLUMN] revenue_usd' }),
    },
    invalid: {},
    errors: [
      { user: REVIEWER_OBO, args: { full_name: 'hls_fde_dev.ground_truth.mv_missing' }, code: 'NOT_FOUND' },
      { args: { full_name: METRIC_VIEW_FQN }, code: 'FORBIDDEN' },
    ],
  },
  review_skip_card: {
    // asset_id and campaign_id default to the session (A3 in C1). A3 is the only
    // unvoted C1 asset, so the next card resurfaces it after the cooldown check.
    happy: {
      args: { reason: 'not_sure' },
      setup: SESSION_A3,
      expected: (s) => ({
        skip: { id: GEN(1), assetId: IDS.A3, campaignId: IDS.C1, reason: 'not_sure', versionHash: null, source: 'mcp', createdAt: NOW },
        stats: { skippedCount: 1, skippedToday: 1 },
        next: {
          asset: s.asset(IDS.A3), synonyms: [], examples: [], confidence: null,
          campaign: { campaignId: IDS.C1, name: 'Q4 Finance review' }, reason: 'campaign', progress: { reviewed: 2, total: 3 },
        },
      }),
      after: (s) => {
        if (s.votes.length !== 5) throw new Error('skip wrote a vote');
      },
    },
    invalid: { asset_id: IDS.A3, reason: 'bored' },
    errors: [
      { args: { asset_id: IDS.UNKNOWN }, code: 'NOT_FOUND' },
      { args: {}, code: 'BAD_REQUEST', message: 'No asset_id provided and no current review session asset.' },
    ],
  },
};
