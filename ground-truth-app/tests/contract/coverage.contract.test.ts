// tests/contract/coverage.contract.test.ts — every contract has a test, and manifest.json is current
// Session 35 · Wave 4-3 · Vitest
//
// Fails when a ROUTE_CONTRACTS or MCP_TOOL_CONTRACTS entry has no contract
// case, when a case exists for a contract that does not, when a listed error
// status has no case / generator / `na` reason, and when the committed
// tests/contract/manifest.json differs from renderContractManifest().

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { REVIEW_CARD_URI as SERVER_REVIEW_CARD_URI } from '../../server/mcp/tools/define';
import { MCP_TOOL_CONTRACTS, ROUTE_CONTRACTS, routeKey } from '../../shared/contracts/schemas';
import { ROUTE_CASES, errorPlan } from './routeCases';
import { TOOL_CASES } from './toolCases';
import { REVIEW_CARD_MIME_TYPE, REVIEW_CARD_URI, buildContractManifest, renderContractManifest } from './manifest';

const routeKeys = ROUTE_CONTRACTS.map(routeKey);
const toolNames = MCP_TOOL_CONTRACTS.map((t) => t.name as string);

describe('route contract coverage', () => {
  it('every ROUTE_CONTRACTS entry has a ROUTE_CASES entry', () => {
    expect(routeKeys.filter((k) => !ROUTE_CASES[k])).toEqual([]);
  });

  it('no ROUTE_CASES entry without a contract', () => {
    expect(Object.keys(ROUTE_CASES).filter((k) => !routeKeys.includes(k))).toEqual([]);
  });

  it('route keys are unique', () => {
    expect(new Set(routeKeys).size).toBe(routeKeys.length);
  });

  it('every listed error status has a case, a generator or an na reason', () => {
    const missing: string[] = [];
    for (const c of ROUTE_CONTRACTS) {
      const plan = errorPlan(c, ROUTE_CASES[routeKey(c)]);
      for (const status of c.errors) {
        const e = plan[status];
        if (e.kind === 'missing' || (e.kind === 'na' && !e.reason)) missing.push(`${routeKey(c)} ${status}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('explicit error cases only use statuses the contract lists', () => {
    const extra: string[] = [];
    for (const c of ROUTE_CONTRACTS) {
      for (const s of Object.keys(ROUTE_CASES[routeKey(c)]?.errors ?? {})) {
        if (!c.errors.includes(Number(s))) extra.push(`${routeKey(c)} ${s}`);
      }
    }
    expect(extra).toEqual([]);
  });
});

describe('MCP tool contract coverage', () => {
  it('every MCP_TOOL_CONTRACTS entry has a TOOL_CASES entry', () => {
    expect(toolNames.filter((n) => !TOOL_CASES[n])).toEqual([]);
  });

  it('no TOOL_CASES entry without a contract', () => {
    expect(Object.keys(TOOL_CASES).filter((n) => !toolNames.includes(n))).toEqual([]);
  });

  it('there are 13 tools', () => {
    expect(toolNames).toHaveLength(13);
  });

  it('every tool with emptyText has an empty-result case', () => {
    const missing = MCP_TOOL_CONTRACTS.filter((t) => t.emptyText && !TOOL_CASES[t.name]?.empty).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('every tool has invalid-argument coverage or an na reason', () => {
    const missing = toolNames.filter((n) => {
      const inv = TOOL_CASES[n]?.invalid;
      return !inv || ('na' in inv && !inv.na);
    });
    expect(missing).toEqual([]);
  });
});

describe('tests/contract/manifest.json', () => {
  it('covers every route and tool exactly once', () => {
    const m = buildContractManifest();
    expect(m.routes.map((r) => r.key)).toEqual(routeKeys);
    expect(m.mcpTools.map((t) => t.name)).toEqual(toolNames);
    for (const r of m.routes) expect(r.response.$ref).toMatch(/^#\/\$defs\//);
  });

  it('review card URI and MIME type match the MCP server', () => {
    expect(REVIEW_CARD_URI).toBe(SERVER_REVIEW_CARD_URI);
    expect(REVIEW_CARD_MIME_TYPE).toBe(RESOURCE_MIME_TYPE);
  });

  it('is up to date (regenerate: pnpm exec tsx tests/contract/generate-manifest.ts > tests/contract/manifest.json)', async () => {
    const file = path.join(process.cwd(), 'tests', 'contract', 'manifest.json');
    const committed = await readFile(file, 'utf8');
    expect(JSON.parse(committed)).toEqual(JSON.parse(renderContractManifest()));
    expect(committed.trimEnd()).toBe(renderContractManifest().trimEnd());
  });
});
