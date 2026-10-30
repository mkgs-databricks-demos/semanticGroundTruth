// server/mcp/server.test.ts — MCP server over an in-memory transport: tools/list, MCP App resource,
// contract input/output validation for all 13 tools, review_skip_card, text fallback
// Session 34 · Wave 4-2 · Vitest with mocked Services

import { describe, it, expect, vi } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { Services } from '../services';
import type { UserContext } from '../lib/context';
import {
  ALL_MCP_TOOL_NAMES,
  MCP_TOOL_CONTRACTS,
  ReviewCardSchema,
  SkipResponseSchema,
  UserStatsSchema,
  VoteResultSchema,
} from '../../shared/contracts/schemas';
import { buildMcpServer } from './server';
import { REVIEW_CARD_URI } from './tools/define';
import { SkipCardExtraSchema } from './tools/review';
import { renderCardMarkdown } from './views/markdown';
import { REVIEW_CARD_APP_HTML } from './views/app/reviewCardApp.generated';
import {
  ASSET_ID,
  CAMPAIGN_ID,
  NEXT_ASSET_ID,
  USER_STATS,
  makeCard,
  makeSkipResponse,
  makeVoteResult,
} from './testFixtures';

const USER: UserContext = {
  userId: 'u1',
  email: 'u1@example.com',
  displayName: 'U1',
  source: 'mcp',
  roles: ['reviewer'],
};

const UI_TOOLS = ['review_get_next', 'review_submit_vote', 'review_skip_card', 'review_get_stats'];

type Mock = ReturnType<typeof vi.fn>;

function makeServices(session: Record<string, unknown> | null = null) {
  const db = {
    one: vi.fn(() => Promise.resolve(session)),
    query: vi.fn((..._args: unknown[]) => Promise.resolve([])),
  };
  const review = {
    getNext: vi.fn(() => Promise.resolve(makeCard())),
    submitVote: vi.fn(() => Promise.resolve(makeVoteResult(makeCard(NEXT_ASSET_ID)))),
    skip: vi.fn(() => Promise.resolve(makeSkipResponse())),
    getUserStats: vi.fn((): Promise<unknown> => Promise.resolve(USER_STATS)),
    runQuery: vi.fn(() => Promise.resolve({ columns: ['n'], rows: [[1]], truncated: false })),
  };
  const assets = {
    addSynonym: vi.fn(() => Promise.resolve()),
    removeSynonym: vi.fn(() => Promise.resolve()),
    voteSynonym: vi.fn(() => Promise.resolve()),
    listSynonyms: vi.fn(() => Promise.resolve(makeCard().synonyms)),
    addExample: vi.fn(() => Promise.resolve()),
    voteExample: vi.fn(() => Promise.resolve()),
    listExamples: vi.fn(() => Promise.resolve(makeCard().examples)),
  };
  const campaigns = { list: vi.fn(() => Promise.resolve([])), create: vi.fn(), updateStatus: vi.fn() };
  const metricViews = { list: vi.fn(() => Promise.resolve([])), get: vi.fn(), validate: vi.fn() };
  const services = { db, review, assets, campaigns, metricViews } as unknown as Services;
  const allMocks: Mock[] = [
    ...Object.values(review),
    ...Object.values(assets),
    ...Object.values(campaigns),
    ...Object.values(metricViews),
  ];
  return { services, db, review, assets, allMocks };
}

async function connect(services: Services, user: UserContext = USER) {
  const server = buildMcpServer(services, user);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-host', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function textOf(result: unknown): string {
  const content = ((result as { content?: unknown }).content ?? []) as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? '').join('\n');
}

describe('tools/list', () => {
  it('lists exactly the 13 contract tools', async () => {
    const client = await connect(makeServices().services);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(13);
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_MCP_TOOL_NAMES].sort());
    expect(tools.map((t) => t.name)).toContain('review_skip_card');
  });

  it('declares _meta.ui.resourceUri on the 4 review card tools only', async () => {
    const client = await connect(makeServices().services);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const ui = (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
      if (UI_TOOLS.includes(tool.name)) {
        expect(ui?.resourceUri, tool.name).toBe(REVIEW_CARD_URI);
        // registerAppTool also sets the legacy flat key for older hosts.
        expect((tool._meta as Record<string, unknown>)['ui/resourceUri'], tool.name).toBe(REVIEW_CARD_URI);
      } else {
        expect(ui, tool.name).toBeUndefined();
      }
    }
  });

  it('publishes each contract input as the tool inputSchema', async () => {
    const client = await connect(makeServices().services);
    const { tools } = await client.listTools();
    for (const contract of MCP_TOOL_CONTRACTS) {
      const tool = tools.find((t) => t.name === contract.name)!;
      expect(tool.inputSchema.type, contract.name).toBe('object');
      expect(Object.keys(tool.inputSchema.properties ?? {}).sort(), contract.name).toEqual(
        Object.keys(contract.input.shape).sort(),
      );
    }
  });

  it('tells the model that a skip is not a vote', async () => {
    const client = await connect(makeServices().services);
    const { tools } = await client.listTools();
    const skip = tools.find((t) => t.name === 'review_skip_card')!;
    expect(skip.description).toMatch(/does not count as a vote/);
  });
});

describe('review card resource', () => {
  it('is listed with the MCP Apps MIME type and prefersBorder', async () => {
    const client = await connect(makeServices().services);
    const { resources } = await client.listResources();
    const card = resources.find((r) => r.uri === REVIEW_CARD_URI)!;
    expect(card).toBeDefined();
    expect(card.mimeType).toBe('text/html;profile=mcp-app');
    expect(card._meta).toEqual({ ui: { prefersBorder: true } });
  });

  it('resources/read returns the self-contained MCP App HTML with no CSP domains', async () => {
    const client = await connect(makeServices().services);
    const { contents } = await client.readResource({ uri: REVIEW_CARD_URI });
    expect(contents).toHaveLength(1);
    const item = contents[0] as { uri: string; mimeType?: string; text?: string; _meta?: Record<string, unknown> };
    expect(RESOURCE_MIME_TYPE).toBe('text/html;profile=mcp-app');
    expect(item.mimeType).toBe(RESOURCE_MIME_TYPE);
    expect(item.text).toBe(REVIEW_CARD_APP_HTML);
    expect(item.text).toContain('<script>');
    const ui = item._meta?.ui as Record<string, unknown>;
    expect(ui.prefersBorder).toBe(true);
    expect(ui).not.toHaveProperty('csp');
    expect(ui).not.toHaveProperty('domain');
  });
});

describe('input validation (every tool)', () => {
  it.each(MCP_TOOL_CONTRACTS.map((c) => [c.name, c] as const))(
    '%s rejects invalid input with isError and the zod issue',
    async (name, contract) => {
      const { services, allMocks } = makeServices();
      const client = await connect(services);
      const field = Object.keys(contract.input.shape)[0];
      const result = await client.callTool({ name, arguments: { [field]: 12345 } });
      expect(result.isError).toBe(true);
      const text = textOf(result);
      expect(text).toContain('Input validation error');
      expect(text).toContain(field);
      for (const m of allMocks) expect(m).not.toHaveBeenCalled();
    },
  );
});

describe('output validation', () => {
  it('returns a tool error when the service output breaks the contract', async () => {
    const { services, review } = makeServices();
    review.getUserStats.mockResolvedValueOnce({ ...USER_STATS, totalVotes: 'many' });
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_get_stats', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/review_get_stats returned output that does not match its contract \(totalVotes: /);
    expect(result.structuredContent).toBeUndefined();
  });

  it('valid outputs pass through as structuredContent', async () => {
    const client = await connect(makeServices().services);
    const stats = await client.callTool({ name: 'review_get_stats', arguments: {} });
    expect(UserStatsSchema.parse(stats.structuredContent)).toEqual(USER_STATS);
  });
});

describe('review_get_next', () => {
  it('returns the card as structuredContent and markdown text, and remembers it', async () => {
    const { services, db } = makeServices();
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_get_next', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(ReviewCardSchema.parse(result.structuredContent).asset.id).toBe(ASSET_ID);
    expect(textOf(result)).toBe(renderCardMarkdown(makeCard()));
    const upsert = db.query.mock.calls.find((c) => /INSERT INTO app\.mcp_sessions/.test(String(c[0])));
    expect(upsert?.[1]).toEqual(['user:u1', 'u1', ASSET_ID, CAMPAIGN_ID]);
  });

  it('empty queue: text only, equal to the contract emptyText', async () => {
    const { services, review } = makeServices();
    review.getNext.mockResolvedValueOnce(null as never);
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_get_next', arguments: {} });
    const contract = MCP_TOOL_CONTRACTS.find((c) => c.name === 'review_get_next')!;
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    expect(textOf(result)).toBe(contract.emptyText);
  });

  it('text fallback snapshot: says what the card shows (asset, logic, scores, actions)', async () => {
    const client = await connect(makeServices().services);
    const result = await client.callTool({ name: 'review_get_next', arguments: {} });
    expect(textOf(result)).toBe(
      [
        '## Total Revenue',
        '**Type:** measure · **Status:** PENDING',
        '**Domain:** Finance / Revenue',
        '',
        '> Sum of all revenue line items',
        '',
        '**Logic:** SUM(revenue) grouped by period',
        '',
        '**Synonyms:** gross revenue',
        '',
        '**Example questions:**',
        '- What was total revenue last quarter?',
        '',
        '**Confidence:** 72.0% (10 votes: 7✓ 2✗ 1✎)',
        '**Campaign:** Q4 Finance review',
        '',
        '**Reason:** low_confidence · **Progress:** 5/20',
        '',
        '**Actions:** approve, reject or edit with `review_submit_vote` (vote_type approve | reject | edit); ' +
          'skip with `review_skip_card` (a skip is not a vote); add synonyms with `review_add_synonym`.',
      ].join('\n'),
    );
  });
});

describe('review_submit_vote', () => {
  it('returns the vote result with the next card in text and structuredContent', async () => {
    const { services, review } = makeServices();
    const client = await connect(services);
    const result = await client.callTool({
      name: 'review_submit_vote',
      arguments: { asset_id: ASSET_ID, vote_type: 'approve' },
    });
    expect(review.submitVote).toHaveBeenCalledWith(USER, expect.objectContaining({ assetId: ASSET_ID, voteType: 'approve' }));
    const parsed = VoteResultSchema.parse(result.structuredContent);
    expect(parsed.next?.asset.id).toBe(NEXT_ASSET_ID);
    expect(textOf(result)).toContain('Vote recorded: **approve**');
    expect(textOf(result)).toContain('**Next card:**');
    expect(textOf(result)).toContain('## Net Margin');
  });

  it('rejects vote_type skip (skips go through review_skip_card)', async () => {
    const { services, review } = makeServices();
    const client = await connect(services);
    const result = await client.callTool({
      name: 'review_submit_vote',
      arguments: { asset_id: ASSET_ID, vote_type: 'skip' },
    });
    expect(result.isError).toBe(true);
    expect(review.submitVote).not.toHaveBeenCalled();
  });
});

describe('review_skip_card', () => {
  it('records a skip as source mcp and never votes', async () => {
    const { services, review, db } = makeServices();
    const client = await connect(services);
    const result = await client.callTool({
      name: 'review_skip_card',
      arguments: { asset_id: ASSET_ID, reason: 'not_sure' },
    });
    expect(result.isError).toBeFalsy();
    expect(review.skip).toHaveBeenCalledWith(USER, { assetId: ASSET_ID, campaignId: undefined, reason: 'not_sure' }, 'mcp');
    expect(review.submitVote).not.toHaveBeenCalled();
    const sql = db.query.mock.calls.map((c) => String(c[0]));
    expect(sql.some((s) => /app\.(votes|confidence_scores)/i.test(s))).toBe(false);

    const data = result.structuredContent;
    expect(SkipResponseSchema.safeParse(data).success).toBe(true);
    expect(SkipCardExtraSchema.safeParse(data).success).toBe(true);
    expect((data as { next: { asset: { id: string } } }).next.asset.id).toBe(ASSET_ID);
    expect((data as { stats: unknown }).stats).toEqual({ skippedCount: 3, skippedToday: 1 });
  });

  it('text fallback snapshot', async () => {
    const { services, review } = makeServices();
    review.getNext.mockResolvedValueOnce(null as never);
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_skip_card', arguments: { asset_id: ASSET_ID, reason: 'not_sure' } });
    expect(textOf(result)).toBe(
      `Skipped asset ${ASSET_ID} (reason: not_sure). A skip is not a vote: confidence and certification are unchanged. ` +
        'Skipped 3 in total, 1 today.\n\nNo more assets to review.',
    );
    expect((result.structuredContent as { next: unknown }).next).toBeNull();
  });

  it('defaults asset_id and campaign_id to the current MCP review session', async () => {
    const session = { session_id: 'user:u1', current_asset_id: ASSET_ID, campaign_id: CAMPAIGN_ID, updated_at: 'x' };
    const { services, review } = makeServices(session);
    const client = await connect(services);
    await client.callTool({ name: 'review_skip_card', arguments: {} });
    expect(review.skip).toHaveBeenCalledWith(USER, { assetId: ASSET_ID, campaignId: CAMPAIGN_ID, reason: undefined }, 'mcp');
    expect(review.getNext).toHaveBeenCalledWith(USER, { campaignId: CAMPAIGN_ID });
  });

  it('without asset_id or session asset returns a BAD_REQUEST tool error', async () => {
    const { services, review } = makeServices(null);
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_skip_card', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('BAD_REQUEST');
    expect(review.skip).not.toHaveBeenCalled();
  });

  it('rejects an unknown skip reason', async () => {
    const { services, review } = makeServices();
    const client = await connect(services);
    const result = await client.callTool({ name: 'review_skip_card', arguments: { asset_id: ASSET_ID, reason: 'bored' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('reason');
    expect(review.skip).not.toHaveBeenCalled();
  });
});
