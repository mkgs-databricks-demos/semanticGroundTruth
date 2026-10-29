// server/services/notification/destinations/slackMcp.test.ts — Slack MCP JSON-RPC client (mocked fetch)
// Build 5 · Session 50

import { describe, expect, it } from 'vitest';
import { AppError } from '../../../lib/errors';
import {
  SLACK_LOGIN_REQUIRED_CODE,
  SLACK_MCP_PATH,
  SlackLoginRequiredError,
  SlackMcpClient,
  extractPermalink,
  loginUrlFromError,
  parseChannels,
  parseRetryAfter,
  parseRpcBody,
} from './slackMcp';
import type { FetchLike } from './slackMcp';

const HOST = 'https://example.cloud.databricks.com';
const TOKEN = 'obo-token-value';
const PERMALINK = 'https://acme.slack.com/archives/C0123ABCD/p1761600000000100';
const LOGIN_URL = 'https://example.cloud.databricks.com/login/slack?state=abc';

interface Call {
  url: string;
  headers: Record<string, string>;
  body: { id?: number; method: string; params?: { name?: string; arguments?: Record<string, unknown> } };
}

type ToolReply = (call: Call) => Response;

const json = (payload: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...headers } });

const sse = (payload: unknown) =>
  new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });

const toolOk = (id: number | undefined, result: unknown) => ({ jsonrpc: '2.0', id, result });

/** Fake MCP server: initialize -> session id, initialized -> 202, tools/call -> `onTool`. */
function fakeServer(onTool: ToolReply): { fetchImpl: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call: Call = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    calls.push(call);
    if (call.body.method === 'initialize') {
      return json(toolOk(call.body.id, { protocolVersion: '2025-06-18', serverInfo: { name: 'slack' }, capabilities: {} }), 200, { 'mcp-session-id': 'sess-1' });
    }
    if (call.body.method === 'notifications/initialized') return new Response(null, { status: 202 });
    return onTool(call);
  };
  return { fetchImpl, calls };
}

const client = (fetchImpl: FetchLike) => new SlackMcpClient({ token: TOKEN, host: HOST, fetchImpl, timeoutMs: 1000 });

async function caught(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (err) {
    return err;
  }
  throw new Error('expected a rejection');
}

describe('SlackMcpClient', () => {
  it('send: handshake, then tools/call slack_send_message with the user token; permalink from an SSE reply', async () => {
    const { fetchImpl, calls } = fakeServer((call) =>
      sse(toolOk(call.body.id, { content: [{ type: 'text', text: `Message sent: ${PERMALINK}` }] })));
    const result = await client(fetchImpl).send('C0123ABCD', 'hello');

    expect(result).toEqual({ permalink: PERMALINK });
    expect(calls.map((c) => c.body.method)).toEqual(['initialize', 'notifications/initialized', 'tools/call']);
    for (const c of calls) {
      expect(c.url).toBe(`${HOST}${SLACK_MCP_PATH}`);
      expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.headers.Accept).toContain('text/event-stream');
    }
    expect(calls[0].headers['Mcp-Session-Id']).toBeUndefined();
    expect(calls[2].headers['Mcp-Session-Id']).toBe('sess-1');
    expect(calls[2].body.params).toEqual({ name: 'slack_send_message', arguments: { channel_id: 'C0123ABCD', message: 'hello' } });
  });

  it('draft: calls slack_send_message_draft; no permalink is fine', async () => {
    const { fetchImpl, calls } = fakeServer((call) => json(toolOk(call.body.id, { content: [{ type: 'text', text: 'Draft saved' }] })));
    expect(await client(fetchImpl).draft('U0123ABCD', 'hi')).toEqual({ permalink: undefined });
    expect(calls[2].body.params?.name).toBe('slack_send_message_draft');
  });

  it('searchChannels: slack_search_channels with the query; channels from a JSON text block', async () => {
    const { fetchImpl, calls } = fakeServer((call) => json(toolOk(call.body.id, {
      content: [{ type: 'text', text: JSON.stringify({ channels: [{ id: 'C0123ABCD', name: 'data-stewards' }, { id: 'C0999ZZZZ', name: '#metrics' }] }) }],
    })));
    expect(await client(fetchImpl).searchChannels('data')).toEqual([
      { id: 'C0123ABCD', name: 'data-stewards' },
      { id: 'C0999ZZZZ', name: 'metrics' },
    ]);
    expect(calls[2].body.params).toEqual({ name: 'slack_search_channels', arguments: { query: 'data' } });
  });

  it('the handshake runs once per client', async () => {
    const { fetchImpl, calls } = fakeServer((call) => json(toolOk(call.body.id, { content: [{ type: 'text', text: 'ok' }] })));
    const c = client(fetchImpl);
    await c.draft('C0123ABCD', 'a');
    await c.draft('C0123ABCD', 'b');
    expect(calls.filter((x) => x.body.method === 'initialize')).toHaveLength(1);
  });

  it(`JSON-RPC ${SLACK_LOGIN_REQUIRED_CODE} -> SlackLoginRequiredError with the elicitation URL`, async () => {
    const { fetchImpl } = fakeServer((call) => json({
      jsonrpc: '2.0',
      id: call.body.id,
      error: { code: SLACK_LOGIN_REQUIRED_CODE, message: 'Login required', data: { elicitations: [{ mode: 'url', url: LOGIN_URL }] } },
    }));
    const err = await caught(client(fetchImpl).send('C0123ABCD', 'x'));
    expect(err).toBeInstanceOf(SlackLoginRequiredError);
    expect((err as SlackLoginRequiredError).loginUrl).toBe(LOGIN_URL);
  });

  it('HTTP 401 -> SlackLoginRequiredError', async () => {
    const { fetchImpl } = fakeServer(() => json({ error: 'unauthorized' }, 401));
    expect(await caught(client(fetchImpl).draft('C0123ABCD', 'x'))).toBeInstanceOf(SlackLoginRequiredError);
  });

  it('HTTP 429 -> RATE_LIMITED with retryAfterSeconds', async () => {
    const { fetchImpl } = fakeServer(() => json({ error: 'slow down' }, 429, { 'retry-after': '30' }));
    const err = await caught(client(fetchImpl).send('C0123ABCD', 'x'));
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('RATE_LIMITED');
    expect((err as AppError).status).toBe(429);
    expect((err as AppError).details).toMatchObject({ retryAfterSeconds: 30 });
  });

  it('HTTP 403 (no EXECUTE on system.ai.slack) -> FORBIDDEN', async () => {
    const { fetchImpl } = fakeServer(() => json({ error_code: 'PERMISSION_DENIED' }, 403));
    const err = await caught(client(fetchImpl).searchChannels('x'));
    expect((err as AppError).code).toBe('FORBIDDEN');
    expect((err as AppError).message).toContain('EXECUTE');
  });

  it('other HTTP errors, tool errors and JSON-RPC errors -> UPSTREAM_ERROR', async () => {
    const http500 = fakeServer(() => json({}, 500));
    expect(((await caught(client(http500.fetchImpl).send('C1234567', 'x'))) as AppError).code).toBe('UPSTREAM_ERROR');
    const toolError = fakeServer((call) => json(toolOk(call.body.id, { isError: true, content: [{ type: 'text', text: 'channel_not_found' }] })));
    expect(((await caught(client(toolError.fetchImpl).send('C1234567', 'x'))) as AppError).code).toBe('UPSTREAM_ERROR');
    const rpcError = fakeServer((call) => json({ jsonrpc: '2.0', id: call.body.id, error: { code: -32601, message: 'Method not found' } }));
    expect(((await caught(client(rpcError.fetchImpl).send('C1234567', 'x'))) as AppError).code).toBe('UPSTREAM_ERROR');
  });

  it('a network failure or timeout -> UPSTREAM_ERROR', async () => {
    const timeout: FetchLike = async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); };
    const err = await caught(client(timeout).send('C1234567', 'x'));
    expect((err as AppError).code).toBe('UPSTREAM_ERROR');
    expect((err as AppError).message).toContain('timed out');
  });

  it('needs a token (never falls back to the app SPN)', () => {
    expect(() => new SlackMcpClient({ token: '', host: HOST })).toThrow(AppError);
  });
});

describe('slackMcp helpers', () => {
  it('parseRpcBody reads JSON and multi-line SSE data', () => {
    expect(parseRpcBody('{"id":1,"result":{}}', 'application/json')).toEqual([{ id: 1, result: {} }]);
    expect(parseRpcBody('event: message\ndata: {"id":2,\ndata: "result":{}}\n\n', 'text/event-stream; charset=utf-8')).toEqual([{ id: 2, result: {} }]);
    expect(parseRpcBody('<html>oops</html>', 'text/html')).toEqual([]);
  });

  it('loginUrlFromError accepts url or params.url and only https', () => {
    expect(loginUrlFromError({ code: -32042, data: { elicitations: [{ params: { url: LOGIN_URL } }] } })).toBe(LOGIN_URL);
    expect(loginUrlFromError({ code: -32042, data: { elicitations: [{ url: 'javascript:alert(1)' }] } })).toBeUndefined();
    expect(loginUrlFromError(undefined)).toBeUndefined();
  });

  it('parseRetryAfter handles seconds, dates and junk', () => {
    expect(parseRetryAfter('12')).toBe(12);
    expect(parseRetryAfter(new Date(10_000 + 5_000).toUTCString(), 10_000)).toBe(5);
    expect(parseRetryAfter('soon')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it('extractPermalink checks structured content then text', () => {
    expect(extractPermalink({ structuredContent: { permalink: PERMALINK } })).toBe(PERMALINK);
    expect(extractPermalink({ content: [{ type: 'text', text: 'no link' }] })).toBeUndefined();
  });

  it('parseChannels reads structured content and text lines, de-duplicated', () => {
    expect(parseChannels({ structuredContent: [{ channel_id: 'C0123ABCD', channel_name: 'stewards' }] })).toEqual([{ id: 'C0123ABCD', name: 'stewards' }]);
    expect(parseChannels({ content: [{ type: 'text', text: '1. #data-stewards (C0123ABCD)\n2. Name: metrics ID: C0999ZZZZ\n3. #data-stewards (C0123ABCD)' }] })).toEqual([
      { id: 'C0123ABCD', name: 'data-stewards' },
      { id: 'C0999ZZZZ', name: 'metrics' },
    ]);
  });

  // Shapes copied from live system.ai.slack responses (2026-10-28); channel text is made up.
  it('parseChannels reads the live slack_search_channels shape ({"results": markdown}, id only in the permalink)', () => {
    const md = [
      '# Search Results for: data',
      '',
      '## Channels (2 results)',
      '### Result 1 of 2',
      'Name: #data-stewards',
      'Creator: Someone',
      'Purpose: Steward chat. See also <#C0BOGUS99> and <@U0123ABCD>',
      'Permalink: [link](https://example.slack.com/archives/C0123ABCD)',
      'Is Archived: false',
      '',
      '---',
      '### Result 2 of 2',
      'Name: #metrics',
      'Permalink: [link](https://example.slack.com/archives/G0999ZZZZ)',
      '',
      '---',
    ].join('\n');
    expect(parseChannels({ content: [{ type: 'text', text: JSON.stringify({ results: md }) }] })).toEqual([
      { id: 'C0123ABCD', name: 'data-stewards' },
      { id: 'G0999ZZZZ', name: 'metrics' },
    ]);
  });

  it('parseChannels reads the live slack_list_user_channels shape (### #name / - **ID:**)', () => {
    const md = '## My Channels (showing 2)\n\n### #general\n- **ID:** C0123ABCD\n- **Purpose:** Use <#C0BOGUS99> for other topics.\n\n### #random\n- **ID:** C0999ZZZZ\n\n---\nPagination: none';
    expect(parseChannels({ content: [{ type: 'text', text: JSON.stringify({ result: md }) }] })).toEqual([
      { id: 'C0123ABCD', name: 'general' },
      { id: 'C0999ZZZZ', name: 'random' },
    ]);
  });
});
