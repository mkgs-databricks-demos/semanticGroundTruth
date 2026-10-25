// server/mcp/server.ts — builds a per-request MCP server with all 12 tools
// Session 11 · Wave 4 · No enum, no namespace, no default export

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Services } from '../services';
import type { UserContext } from '../lib/context';
import { registerReviewTools } from './tools/review';
import { registerCampaignTools } from './tools/campaign';
import { registerMetricViewTools } from './tools/metricView';
import { renderCardHtml } from './views/cardHtml';

const SERVER_NAME = 'semantic-ground-truth';
const SERVER_VERSION = '0.1.0';

/**
 * Build a fresh MCP server bound to the calling user.
 * The server is stateless (one per HTTP request), so all 12 tools
 * close over the caller's `UserContext` and the shared `Services`.
 */
export function buildMcpServer(
  services: Services,
  user: UserContext,
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register the review-card HTML resource (best-effort MCP Apps rendering)
  server.resource(
    'review-card',
    'ui://ground-truth/review-card',
    { mimeType: 'text/html' },
    async () => ({
      contents: [
        {
          uri: 'ui://ground-truth/review-card',
          mimeType: 'text/html',
          text: renderCardHtml({
            asset: {
              id: '',
              assetType: 'measure',
              name: 'placeholder',
              displayName: 'Review Card',
              description: 'Use review_get_next to load a real card.',
              plainEnglishLogic: null,
              yamlContent: null,
              repoUrl: null,
              fixturePath: null,
              branch: null,
              environment: 'dev',
              targetCatalog: '',
              targetSchema: '',
              status: 'PENDING',
              domain: null,
              subdomain: null,
              sourceId: null,
              sourceMetadata: null,
              createdAt: '',
              updatedAt: '',
              synonyms: [],
            },
            synonyms: [],
            examples: [],
            confidence: null,
            reason: 'random',
            progress: { reviewed: 0, total: 0 },
          }),
        },
      ],
    }),
  );

  // Register all 12 tools across the three domains
  registerReviewTools(server, services, user);
  registerCampaignTools(server, services, user);
  registerMetricViewTools(server, services, user);

  return server;
}
