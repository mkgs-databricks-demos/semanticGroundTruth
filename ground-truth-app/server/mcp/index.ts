// server/mcp/index.ts — MCP endpoint (MCP spec 2026-07-28 + 2025-era stateless fallback)
// Session 11 · Wave 4 · No enum, no namespace, no default export
// MCP SDK v2 upgrade (2026-10-30): @modelcontextprotocol/server createMcpHandler,
// mounted on Express with @modelcontextprotocol/node toNodeHandler.

import type { Application, Request, Response } from 'express';
import { createMcpHandler, type AuthInfo, type McpHttpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Services } from '../services';
import { getUser } from '../lib/context';
import { asyncRoute } from '../lib/http';
import { logger } from '../lib/logger';
import { buildMcpServer } from './server';
import { userAuthInfo, userFromRequestContext } from './identity';

/** MCP HTTP handlers created by mountMcp, closed on shutdown. */
const handlers = new Set<McpHttpHandler>();

/** Number of MCP HTTP handlers currently mounted (one per mountMcp call). */
export function activeMcpHandlerCount(): number {
  return handlers.size;
}

/**
 * The MCP HTTP handler: one fresh McpServer per request (the factory), bound
 * to the UserContext the Express route resolved.
 *
 * - 2026-07-28 traffic (per-request `_meta` envelope, `server/discover`) is
 *   served by the modern path.
 * - `legacy: 'stateless'`: 2025-era traffic (`initialize`, or a bare
 *   `tools/list` with no envelope — what Unity Gateway / Genie One send today)
 *   gets a fresh instance per request over a stateless streamable HTTP
 *   transport. No response carries `Mcp-Session-Id`, and the SDK answers
 *   GET / DELETE (2025 session operations) with 405.
 */
export function createMcpHttpHandler(services: Services): McpHttpHandler {
  return createMcpHandler((ctx) => buildMcpServer(services, userFromRequestContext(ctx)), {
    legacy: 'stateless',
    onerror: (err) => {
      logger.warn('MCP request rejected', { error: err.message });
    },
  });
}

/**
 * Close the modern leg of every MCP handler (aborts in-flight 2026-07-28
 * exchanges and their per-request servers). Legacy requests are per-request by
 * construction and hold nothing between exchanges; their sockets drain with
 * the HTTP server. Called from the graceful shutdown sequence before the HTTP
 * server closes. Returns how many handlers were closed.
 */
export async function closeMcpSessions(): Promise<number> {
  const open = [...handlers];
  handlers.clear();
  await Promise.allSettled(
    open.map((h) =>
      h.close().catch((err: unknown) => {
        logger.warn('MCP handler close error', { error: String(err) });
      }),
    ),
  );
  return open.length;
}

const ENVELOPE_VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';

/** Header names worth recording (values of auth/cookie headers are never logged). */
const LOGGED_HEADERS = ['mcp-protocol-version', 'mcp-session-id', 'accept', 'content-type', 'user-agent'];

/**
 * What era and headers a client used, for the `check=mcp_request` log line
 * (which client era Unity Gateway / Genie One actually speak). Logs header
 * NAMES for everything and VALUES only for the non-secret MCP headers above.
 */
export function describeMcpRequest(req: Pick<Request, 'method' | 'headers' | 'body'>): Record<string, unknown> {
  const body = (req.body ?? {}) as { method?: unknown; params?: Record<string, unknown> };
  const params = body.params ?? {};
  const meta = (params._meta ?? {}) as Record<string, unknown>;
  const clientInfo = (params.clientInfo ?? meta['io.modelcontextprotocol/clientInfo']) as
    | { name?: unknown; version?: unknown }
    | undefined;
  const envelopeVersion = meta[ENVELOPE_VERSION_KEY];
  const headers: Record<string, unknown> = {};
  for (const name of LOGGED_HEADERS) {
    if (req.headers[name] !== undefined) headers[name] = req.headers[name];
  }
  return {
    check: 'mcp_request',
    httpMethod: req.method,
    rpcMethod: typeof body.method === 'string' ? body.method : Array.isArray(req.body) ? 'batch' : null,
    era: typeof envelopeVersion === 'string' ? 'modern' : 'legacy',
    envelopeProtocolVersion: typeof envelopeVersion === 'string' ? envelopeVersion : null,
    initializeProtocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : null,
    clientName: typeof clientInfo?.name === 'string' ? clientInfo.name : null,
    clientVersion: typeof clientInfo?.version === 'string' ? clientInfo.version : null,
    headers,
    headerNames: Object.keys(req.headers).sort(),
  };
}

/**
 * Mount the MCP endpoint at `/mcp` (all methods; the SDK owns method
 * handling). Authentication is unchanged: `getUser(res)` (OBO user from
 * lib/context) runs first, and its UserContext is handed to the factory as the
 * pass-through `authInfo` (see identity.ts). Role checks stay in the tools.
 */
export function mountMcp(app: Application, services: Services): void {
  const handler = createMcpHttpHandler(services);
  handlers.add(handler);
  const nodeHandler = toNodeHandler(handler, {
    onerror: (err) => {
      logger.error('MCP adapter error', { error: err.message });
    },
  });

  app.all(
    '/mcp',
    asyncRoute(async (req: Request, res: Response) => {
      const user = getUser(res);
      logger.info('MCP request', describeMcpRequest(req));
      // Always overwrite: req.auth is never taken from the client.
      (req as Request & { auth?: AuthInfo }).auth = userAuthInfo(user);
      await nodeHandler(req, res, req.body);
    }),
  );
}
