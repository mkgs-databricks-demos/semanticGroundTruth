// shared/contracts/schemas.test.ts — ROUTE_CONTRACTS / MCP_TOOL_CONTRACTS coverage + generated schema staleness
// Session 25 · Wave 4-0

import { describe, expect, it } from 'vitest';
import {
  ALL_MCP_TOOL_NAMES,
  AssetSchema,
  MCP_TOOL_CONTRACTS,
  ReviewCardSchema,
  ROUTE_CONTRACTS,
  SkipResponseSchema,
  UserSettingsSchema,
  renderContractSchemas,
  routeKey,
  toJsonSchemas,
} from './schemas';
import { MCP_TOOL_NAMES } from './mcp';

// node:fs / node:path through a non-literal specifier: this file is also
// type-checked by tsconfig.client.json, which has no Node types.
const FS = 'node:fs';
const PATH = 'node:path';
const PROCESS = 'node:process';

async function nodeModules() {
  const [fs, path, proc] = await Promise.all([import(FS), import(PATH), import(PROCESS)]);
  return { fs, path, cwd: String(proc.cwd()) };
}

/** `app.<method>('<path>'` registrations in server/routes/*.ts (excluding tests). */
async function registeredRoutes(): Promise<string[]> {
  const { fs, path, cwd } = await nodeModules();
  const dir = path.join(cwd, 'server', 'routes');
  const files: string[] = fs.readdirSync(dir)
    .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const keys: string[] = [];
  const re = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  for (const f of files) {
    const src: string = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(re)) {
      keys.push(`${m[1].toUpperCase()} ${m[2]}`);
    }
  }
  return keys.sort();
}

const ID = '550e8400-e29b-41d4-a716-446655440000';
const NOW = '2026-10-24T18:00:00.000Z';

describe('ROUTE_CONTRACTS', () => {
  // Plan 25 says "49 (41 + 8 new)" but lists 9 new method+path pairs
  // (GET|PUT /api/me/settings are two routes), so the contract has 50.
  it('covers 50 routes (41 registered today + 9 planned for session 33)', () => {
    expect(ROUTE_CONTRACTS).toHaveLength(50);
    expect(ROUTE_CONTRACTS.filter((c) => !c.plannedIn)).toHaveLength(41);
    expect(ROUTE_CONTRACTS.filter((c) => c.plannedIn === 'session 33').map(routeKey).sort()).toEqual([
      'GET /api/me/settings',
      'GET /api/steward/conflicts',
      'GET /api/steward/feedback-branches',
      'GET /api/steward/feedback-queue',
      'POST /api/review/skip',
      'POST /api/steward/conflicts/:assetId/resolve',
      'POST /api/steward/feedback-branches',
      'POST /api/steward/feedback-branches/:batchId/status',
      'PUT /api/me/settings',
    ]);
  });

  it('has unique method + path keys', () => {
    const keys = ROUTE_CONTRACTS.map(routeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('includes every app.<method>(path) registration in server/routes/*.ts', async () => {
    const registered = await registeredRoutes();
    expect(registered.length).toBeGreaterThanOrEqual(41);
    const contracted = new Set(ROUTE_CONTRACTS.map(routeKey));
    const missing = registered.filter((k) => !contracted.has(k));
    expect(missing, `routes without a contract: ${missing.join(', ')}`).toEqual([]);
  });

  it('every contract not marked plannedIn is registered in server/routes', async () => {
    const registered = new Set(await registeredRoutes());
    const unregistered = ROUTE_CONTRACTS
      .filter((c) => !c.plannedIn)
      .map(routeKey)
      .filter((k) => !registered.has(k));
    expect(unregistered, `contracts without a route: ${unregistered.join(', ')}`).toEqual([]);
  });

  it('every route has a response schema, a success status and error statuses', () => {
    for (const c of ROUTE_CONTRACTS) {
      expect(c.response, routeKey(c)).toBeDefined();
      expect(c.status, routeKey(c)).toBeGreaterThanOrEqual(200);
      expect(c.status, routeKey(c)).toBeLessThan(300);
      expect(c.errors.length, routeKey(c)).toBeGreaterThan(0);
    }
  });

  it('every path parameter has a params schema', () => {
    for (const c of ROUTE_CONTRACTS) {
      if (c.path.includes('/:')) {
        expect(c.params, routeKey(c)).toBeDefined();
      }
    }
  });
});

describe('MCP_TOOL_CONTRACTS', () => {
  it('covers the 12 deployed tools + review_skip_card', () => {
    expect(MCP_TOOL_CONTRACTS).toHaveLength(13);
    expect(MCP_TOOL_CONTRACTS.map((t) => t.name).sort()).toEqual([...ALL_MCP_TOOL_NAMES].sort());
    expect(ALL_MCP_TOOL_NAMES).toEqual([...MCP_TOOL_NAMES, 'review_skip_card']);
  });

  it('review_submit_vote rejects vote_type skip; review_skip_card accepts a reason', () => {
    const vote = MCP_TOOL_CONTRACTS.find((t) => t.name === 'review_submit_vote')!;
    const skip = MCP_TOOL_CONTRACTS.find((t) => t.name === 'review_skip_card')!;
    expect(vote.input.safeParse({ asset_id: ID, vote_type: 'skip' }).success).toBe(false);
    expect(vote.input.safeParse({ vote_type: 'approve' }).success).toBe(true);
    expect(skip.input.safeParse({ reason: 'need_context' }).success).toBe(true);
    expect(skip.input.safeParse({ reason: 'later' }).success).toBe(false);
  });
});

describe('response schemas', () => {
  const asset = {
    id: ID, assetType: 'measure', name: 'revenue', displayName: 'Revenue',
    description: null, plainEnglishLogic: null, yamlContent: null, repoUrl: null,
    fixturePath: null, branch: null, environment: 'dev', targetCatalog: 'c',
    targetSchema: 's', status: 'PENDING', domain: null, subdomain: null,
    synonyms: [], sourceId: null, sourceMetadata: null, createdAt: NOW, updatedAt: NOW,
  };

  it('Asset requires synonyms (array of AssetSynonym)', () => {
    expect(AssetSchema.safeParse(asset).success).toBe(true);
    const { synonyms: _omit, ...withoutSynonyms } = asset;
    expect(AssetSchema.safeParse(withoutSynonyms).success).toBe(false);
    expect(AssetSchema.safeParse({ ...asset, synonyms: ['rev'] }).success).toBe(false);
  });

  it('ReviewCard accepts a card without a campaign', () => {
    const card = {
      asset, synonyms: [], examples: [], confidence: null, reason: 'random',
      progress: { reviewed: 0, total: 1 },
    };
    expect(ReviewCardSchema.safeParse(card).success).toBe(true);
  });

  it('SkipResponse and UserSettings validate representative payloads', () => {
    expect(SkipResponseSchema.safeParse({
      skip: { id: ID, assetId: ID, campaignId: null, reason: null, versionHash: null, source: 'web', createdAt: NOW },
      stats: { skippedCount: 3, skippedToday: 1 },
    }).success).toBe(true);
    expect(UserSettingsSchema.safeParse({
      theme: 'system', density: 'comfortable', motion: 'system', defaultCampaignId: null,
      defaultAssetType: null, showKeyboardHints: true, cardsPerSession: 20, updatedAt: null,
    }).success).toBe(true);
  });
});

describe('generated/contracts.schema.json', () => {
  it('has an entry for every route and tool', () => {
    const json = toJsonSchemas();
    expect(Object.keys(json.routes)).toHaveLength(50);
    expect(Object.keys(json.mcpTools)).toHaveLength(13);
  });

  it('is up to date (regenerate: pnpm exec tsx shared/contracts/generate-schemas.ts > shared/contracts/generated/contracts.schema.json)', async () => {
    const { fs, path, cwd } = await nodeModules();
    const file = path.join(cwd, 'shared', 'contracts', 'generated', 'contracts.schema.json');
    const committed: string = fs.readFileSync(file, 'utf8');
    expect(committed).toBe(renderContractSchemas());
  });
});
