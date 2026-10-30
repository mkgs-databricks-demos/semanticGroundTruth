// server/mcp/http.test.ts — /mcp over real HTTP: both protocol eras, MCP App resource, no sessions
// MCP SDK v2 upgrade (2026-10-30) · Vitest, node:http server in front of mountMcp + toNodeHandler
//
// mountMcp is driven through a minimal Express-shaped app (only `all`), so the
// test exercises the real route: getUser(res) -> userAuthInfo -> toNodeHandler
// -> createMcpHandler(factory, { legacy: 'stateless' }) -> buildMcpServer.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Application, Request, RequestHandler, Response } from 'express';
import { Client, StreamableHTTPClientTransport, UnsupportedProtocolVersionError } from '@modelcontextprotocol/client';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { Services } from '../services';
import type { UserContext } from '../lib/context';
import { ALL_MCP_TOOL_NAMES } from '../../shared/contracts/schemas';
import { closeMcpSessions, describeMcpRequest, mountMcp } from './index';
import { MCP_OBO_CLIENT_ID, userAuthInfo, userFromRequestContext } from './identity';
import { REVIEW_CARD_URI } from './tools/define';
import { USER_STATS } from './testFixtures';

const MODERN = '2026-07-28';

const USER: UserContext = {
  userId: 'u-http',
  email: 'u-http@example.com',
  displayName: 'U HTTP',
  source: 'mcp',
  roles: ['reviewer'],
};

const getUserStats = vi.fn((): Promise<unknown> => Promise.resolve(USER_STATS));
const services = {
  db: { one: vi.fn(() => Promise.resolve(null)), query: vi.fn(() => Promise.resolve([])) },
  review: { getUserStats },
} as unknown as Services;

/** Mcp-Session-Id (or its absence) on every response the server wrote. */
const sessionIdHeaders: Array<string | number | string[] | undefined> = [];

let httpServer: Server;
let url: URL;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

beforeAll(async () => {
  let route: RequestHandler | undefined;
  const app = {
    all: (path: string, handler: RequestHandler) => {
      expect(path).toBe('/mcp');
      route = handler;
    },
  } as unknown as Application;
  mountMcp(app, services);
  expect(route).toBeDefined();

  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.on('finish', () => sessionIdHeaders.push(res.getHeader('mcp-session-id')));
    void (async () => {
      // What express.json() + the auth middleware leave behind.
      const body = req.method === 'POST' ? await readJson(req) : undefined;
      Object.assign(req, { body });
      Object.assign(res, { locals: { user: USER } });
      route!(req as unknown as Request, res as unknown as Response, () => undefined);
    })();
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = new URL(`http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/mcp`);
});

afterAll(async () => {
  await closeMcpSessions();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  // Checked last, so it covers every response written by this file.
  expect(sessionIdHeaders.length).toBeGreaterThan(0);
  expect(sessionIdHeaders.filter((h) => h !== undefined)).toEqual([]);
});

/** POST one JSON-RPC message with no MCP headers (a 2025-era client that skips initialize). */
async function postLegacy(body: unknown): Promise<{ status: number; sessionId: string | null; message: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Stateless legacy serving answers over SSE (`data: {...}`) or plain JSON.
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  const message = JSON.parse(dataLine ? dataLine.slice('data: '.length) : text) as Record<string, unknown>;
  return { status: res.status, sessionId: res.headers.get('mcp-session-id'), message };
}

async function connectClient(mode?: 'auto' | { pin: string }): Promise<Client> {
  const client = new Client(
    { name: 'http-test', version: '1.0.0' },
    mode ? { versionNegotiation: { mode } } : undefined,
  );
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

describe('2025-era clients (legacy: stateless)', () => {
  it('answers tools/list without initialize with the 13 contract tools', async () => {
    const { status, sessionId, message } = await postLegacy({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(status).toBe(200);
    expect(sessionId).toBeNull();
    const tools = (message.result as { tools: Array<{ name: string }> }).tools;
    expect(tools).toHaveLength(13);
    expect(tools.map((t) => t.name).sort()).toEqual([...ALL_MCP_TOOL_NAMES].sort());
  });

  it('answers a 2025-06-18 initialize with that version and no session id', async () => {
    const { sessionId, message } = await postLegacy({
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gateway-like', version: '1' } },
    });
    expect(sessionId).toBeNull();
    expect((message.result as { protocolVersion: string }).protocolVersion).toBe('2025-06-18');
  });

  it('serves the default (legacy) v2 client: initialize, tools/list, resources/read', async () => {
    const client = await connectClient();
    expect(client.getNegotiatedProtocolVersion()).not.toBe(MODERN);
    expect((await client.listTools()).tools).toHaveLength(13);
    const read = await client.readResource({ uri: REVIEW_CARD_URI });
    expect(read.contents[0]?.mimeType).toBe(RESOURCE_MIME_TYPE);
    await client.close();
  });

  it('returns 405 for GET and DELETE (no 2025 session operations)', async () => {
    for (const method of ['GET', 'DELETE']) {
      const res = await fetch(url, { method, headers: { accept: 'text/event-stream' } });
      expect(res.status, method).toBe(405);
      const body = (await res.json()) as { error?: { message?: string } };
      expect(body.error?.message, method).toBe('Method not allowed.');
      expect(res.headers.get('mcp-session-id'), method).toBeNull();
    }
  });
});

describe('2026-07-28 clients', () => {
  it('negotiates with server/discover, then lists the 13 tools', async () => {
    const client = await connectClient({ pin: MODERN });
    expect(client.getNegotiatedProtocolVersion()).toBe(MODERN);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(13);
    const card = tools.find((t) => t.name === 'review_get_next');
    expect((card?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri).toBe(REVIEW_CARD_URI);
    await client.close();
  });

  it("auto negotiation picks 2026-07-28", async () => {
    const client = await connectClient('auto');
    expect(client.getNegotiatedProtocolVersion()).toBe(MODERN);
    await client.close();
  });

  it('reads ui://ground-truth/review-card as text/html;profile=mcp-app', async () => {
    const client = await connectClient({ pin: MODERN });
    const read = await client.readResource({ uri: REVIEW_CARD_URI });
    expect(RESOURCE_MIME_TYPE).toBe('text/html;profile=mcp-app');
    expect(read.contents[0]?.mimeType).toBe(RESOURCE_MIME_TYPE);
    expect((read.contents[0] as { text?: string }).text?.startsWith('<!DOCTYPE html>')).toBe(true);
    await client.close();
  });

  it('runs tools as the OBO user from the route, with the text fallback', async () => {
    getUserStats.mockClear();
    const client = await connectClient({ pin: MODERN });
    const result = await client.callTool({ name: 'review_get_stats', arguments: {} });
    expect(getUserStats).toHaveBeenCalledWith(USER.userId);
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0]?.type).toBe('text');
    expect(content[0]?.text?.length).toBeGreaterThan(0);
    expect(result.structuredContent).toBeDefined();
    await client.close();
  });

  it('rejects an unsupported protocol version with UnsupportedProtocolVersionError', async () => {
    await expect(connectClient({ pin: '2099-01-01' })).rejects.toBeInstanceOf(UnsupportedProtocolVersionError);
  });
});

describe('identity (pass-through authInfo)', () => {
  it('round-trips the route UserContext', () => {
    const info = userAuthInfo(USER);
    expect(info.clientId).toBe(MCP_OBO_CLIENT_ID);
    expect(info.token).toBe('');
    expect(userFromRequestContext({ authInfo: info })).toEqual(USER);
  });

  it('fails closed without the app-built authInfo', () => {
    expect(() => userFromRequestContext({})).toThrow(/no authenticated user/);
    expect(() =>
      userFromRequestContext({ authInfo: { token: 't', clientId: 'someone-else', scopes: [], extra: { sgtUser: USER } } }),
    ).toThrow(/no authenticated user/);
  });

  it('describes the era and MCP headers without secret header values', () => {
    const line = describeMcpRequest({
      method: 'POST',
      headers: { 'mcp-protocol-version': MODERN, 'x-forwarded-access-token': 'secret', 'user-agent': 'ua' },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN, 'io.modelcontextprotocol/clientInfo': { name: 'c', version: '2' } } },
      },
    } as unknown as Request);
    expect(line).toMatchObject({
      check: 'mcp_request',
      rpcMethod: 'tools/list',
      era: 'modern',
      envelopeProtocolVersion: MODERN,
      clientName: 'c',
      headers: { 'mcp-protocol-version': MODERN, 'user-agent': 'ua' },
    });
    expect(JSON.stringify(line)).not.toContain('secret');
    expect(line.headerNames).toContain('x-forwarded-access-token');
  });
});
