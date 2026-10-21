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

      res.on('close', () => {
        transport.close().catch((err: unknown) => {
          logger.warn('MCP transport close error', { error: String(err) });
        });
        server.close().catch((err: unknown) => {
          logger.warn('MCP server close error', { error: String(err) });
        });
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
