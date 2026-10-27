// tests/contract/mcp.contract.test.ts — every MCP_TOOL_CONTRACTS entry + the review card resource
// Session 35 · Wave 4-3 · Vitest, in-memory MCP client against buildMcpServer and the seeded fake
//
// initialize, tools/list (13 tools, _meta.ui.resourceUri on the card tools),
// resources/list + resources/read (MCP Apps MIME type, non-empty HTML), and
// tools/call per tool: structuredContent parses with the contract output
// (no extra fields) and equals the exact expected value; invalid arguments and
// app errors come back as isError results.

import { describe, expect, it } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { buildMcpServer } from '../../server/mcp/server';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { REVIEW_CARD_URI } from '../../server/mcp/tools/define';
import { SkipCardExtraSchema } from '../../server/mcp/tools/review';
import { ALL_MCP_TOOL_NAMES, MCP_TOOL_CONTRACTS } from '../../shared/contracts/schemas';
import type { McpToolContract } from '../../shared/contracts/schemas';
import { connectMcp, newEnv, toolText } from './harness';
import { REVIEWER } from './fixtures';
import { TOOL_CASES } from './toolCases';
import type { ToolCall } from './toolCases';
import { UI_TOOLS } from './manifest';

async function call(t: McpToolContract, input: ToolCall) {
  const env = newEnv();
  input.setup?.(env.store);
  const client = await connectMcp(env.services, input.user ?? REVIEWER);
  const result = await client.callTool({ name: t.name, arguments: input.args });
  return { env, result };
}

/**
 * tools/call over raw JSON-RPC (no SDK Client, so no CallToolResult validation),
 * to inspect a result the client would reject.
 */
async function callRaw(t: McpToolContract, input: ToolCall) {
  const env = newEnv();
  input.setup?.(env.store);
  const server = buildMcpServer(env.services, { ...(input.user ?? REVIEWER), source: 'mcp' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const responses = new Map<unknown, { result?: unknown; error?: unknown }>();
  clientTransport.onmessage = (m: JSONRPCMessage) => {
    if ('id' in m) responses.set(m.id, m as { result?: unknown; error?: unknown });
  };
  await server.connect(serverTransport);
  await clientTransport.start();
  await clientTransport.send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '1.0.0' } },
  });
  await clientTransport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  await clientTransport.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: t.name, arguments: input.args } });
  for (let i = 0; i < 200 && !responses.has(2); i++) await new Promise((r) => setTimeout(r, 5));
  const res = responses.get(2);
  if (!res) throw new Error('raw tools/call: no response');
  return { env, response: res as { result?: unknown; error?: { code: number; message: string } } };
}

/** Parse with the contract output (+ the tool's documented extra fields). */
function parseOutput(t: McpToolContract, data: unknown): unknown {
  const base = t.output!.parse(data) as Record<string, unknown>;
  if (t.name === 'review_skip_card') return { ...base, ...SkipCardExtraSchema.parse(data) };
  return base;
}

describe('MCP protocol', () => {
  it('initialize: server identifies itself', async () => {
    const client = await connectMcp(newEnv().services, REVIEWER);
    expect(client.getServerVersion()?.name).toBeTruthy();
    expect(client.getServerCapabilities()?.tools).toBeDefined();
    expect(client.getServerCapabilities()?.resources).toBeDefined();
  });

  it('tools/list: exactly the 13 contract tools, card tools carry _meta.ui.resourceUri', async () => {
    const client = await connectMcp(newEnv().services, REVIEWER);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_MCP_TOOL_NAMES].sort());
    expect(tools).toHaveLength(13);
    for (const tool of tools) {
      const uri = (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
      expect(uri, tool.name).toBe(UI_TOOLS.includes(tool.name) ? REVIEW_CARD_URI : undefined);
    }
  });

  it('resources/read: review card is MCP Apps HTML', async () => {
    const client = await connectMcp(newEnv().services, REVIEWER);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(REVIEW_CARD_URI);
    const { contents } = await client.readResource({ uri: REVIEW_CARD_URI });
    expect(contents).toHaveLength(1);
    expect(contents[0].mimeType).toBe(RESOURCE_MIME_TYPE);
    const html = String((contents[0] as { text?: string }).text ?? '');
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toMatch(/<html/i);
  });
});

for (const t of MCP_TOOL_CONTRACTS) {
  const tc = TOOL_CASES[t.name];

  describe(`tools/call ${t.name}`, () => {
    if (!tc) {
      it('has a contract case', () => {
        expect.fail(`no TOOL_CASES entry for ${t.name}`);
      });
      return;
    }

    // Known defects (toolCases.ts KNOWN_DEFECTS) run as it.fails: red again once the server is fixed.
    const happyIt = tc.happy.knownDefect ? it.fails : it;
    happyIt(`happy path: structuredContent matches the contract and exact values${tc.happy.knownDefect ? ' [known defect]' : ''}`, async () => {
      const { env, result } = await call(t, tc.happy);
      expect(result.isError, toolText(result)).toBeFalsy();
      expect(toolText(result).length).toBeGreaterThan(0);
      const data = result.structuredContent;
      expect(parseOutput(t, data)).toEqual(data);
      expect(data).toEqual(tc.happy.expected(env.store));
      tc.happy.after?.(env.store);
    });

    // Over raw JSON-RPC (no SDK client) too: structuredContent is an object, so the
    // server's own result validation accepts it (session 36 fixed the bare arrays).
    if (!tc.happy.knownDefect) {
      it('raw JSON-RPC result carries an object structuredContent', async () => {
        const { response } = await callRaw(t, tc.happy);
        expect(response.error).toBeUndefined();
        const structured = (response.result as { structuredContent?: unknown } | undefined)?.structuredContent;
        if (structured !== undefined) {
          expect(typeof structured).toBe('object');
          expect(Array.isArray(structured)).toBe(false);
        }
      });
    }

    if (!('na' in tc.invalid)) {
      const args = tc.invalid;
      it('invalid arguments are rejected by the contract input schema', async () => {
        expect(t.input.safeParse(args).success).toBe(false);
        const { env, result } = await call(t, { args });
        expect(result.isError).toBe(true);
        expect(env.store.votes).toHaveLength(5);
        expect(env.store.skips).toHaveLength(0);
      });
    }

    for (const e of tc.errors ?? []) {
      const errorIt = e.knownDefect ? it.fails : it;
      errorIt(`error ${e.code}${e.message ? `: ${e.message}` : ''}${e.user?.accessToken || !t.name.startsWith('metric_view') ? '' : ' (no OBO token)'}${e.knownDefect ? ' [known defect]' : ''}`, async () => {
        const { result } = await call(t, e);
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toBeUndefined();
        const text = toolText(result);
        expect(text.startsWith(`Error [${e.code}]: `), text).toBe(true);
        if (e.message) expect(text).toBe(`Error [${e.code}]: ${e.message}`);
      });
    }

    if (tc.empty) {
      const empty = tc.empty;
      it(`empty result is text only: "${t.emptyText}"`, async () => {
        const { result } = await call(t, empty);
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toBeUndefined();
        expect(toolText(result)).toBe(t.emptyText);
      });
    }
  });
}
