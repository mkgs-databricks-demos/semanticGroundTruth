// server/mcp/index.ts — Streamable HTTP MCP endpoint
// Session 11 · Wave 4 · No enum, no namespace, no default export

import type { Application, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Services } from '../services';
import { getUser } from '../lib/context';
import { asyncRoute } from '../lib/http';
import { logger } from '../lib/logger';
import { buildMcpServer } from './server';

const JSON_RPC_METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0' as const,
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
};

interface ActiveMcpSession {
  close: () => Promise<void>;
}

/** In-flight MCP request transports, drained on shutdown. */
const activeSessions = new Set<ActiveMcpSession>();

/** Number of MCP transports currently open. */
export function activeMcpSessionCount(): number {
  return activeSessions.size;
}

/**
 * Close every in-flight MCP transport and server. Called from the graceful
 * shutdown sequence before the HTTP server closes, so streaming responses end
 * and their sockets can drain. Returns how many sessions were closed.
 */
export async function closeMcpSessions(): Promise<number> {
  const open = [...activeSessions];
  activeSessions.clear();
  await Promise.allSettled(open.map((session) => session.close()));
  return open.length;
}

/**
 * Mount the MCP endpoint.
 *
 * - `POST /mcp` — stateless Streamable HTTP: builds a fresh McpServer per
 *   request, bound to the caller's UserContext. The transport has no session
 *   id generator, so every request is self-contained.
 * - `GET /mcp` and `DELETE /mcp` — return a 405 JSON-RPC error.
 */
export function mountMcp(app: Application, services: Services): void {
  app.post(
    '/mcp',
    asyncRoute(async (req: Request, res: Response) => {
      const user = getUser(res);
      const server = buildMcpServer(services, user);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      let closed = false;
      const session: ActiveMcpSession = {
        close: async () => {
          if (closed) return;
          closed = true;
          activeSessions.delete(session);
          await transport.close().catch((err: unknown) => {
            logger.warn('MCP transport close error', { error: String(err) });
          });
          await server.close().catch((err: unknown) => {
            logger.warn('MCP server close error', { error: String(err) });
          });
        },
      };
      activeSessions.add(session);

      res.on('close', () => {
        void session.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    }),
  );

  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json(JSON_RPC_METHOD_NOT_ALLOWED);
  });

  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json(JSON_RPC_METHOD_NOT_ALLOWED);
  });
}
