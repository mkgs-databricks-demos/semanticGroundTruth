// server/mcp/index.ts — stub (replaced by session 11)
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';

export function mountMcp(app: Application, _services: Services): void {
  app.post('/mcp', (_req, res) => {
    res.status(503).json({
      error: { code: 'UPSTREAM_ERROR', message: 'MCP not yet implemented' },
    });
  });
}
