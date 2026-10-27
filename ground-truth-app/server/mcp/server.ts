// server/mcp/server.ts — builds a per-request MCP server with all 13 tools + the review card MCP App
// Session 11 · Wave 4 · No enum, no namespace, no default export
// Session 34 · Wave 4-2: review card is an MCP App (ext-apps 1.7.5, design L300-17)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import type { Services } from '../services';
import type { UserContext } from '../lib/context';
import { registerReviewTools } from './tools/review';
import { registerCampaignTools } from './tools/campaign';
import { registerMetricViewTools } from './tools/metricView';
import { REVIEW_CARD_URI } from './tools/define';
import { REVIEW_CARD_APP_HTML } from './views/app/reviewCardApp.generated';

const SERVER_NAME = 'semantic-ground-truth';
const SERVER_VERSION = '0.1.0';

/**
 * Resource _meta.ui: no connectDomains / resourceDomains (the view loads
 * nothing and talks to the server only through the host), so hosts apply
 * their strictest default CSP. prefersBorder per design §2.
 */
export const REVIEW_CARD_RESOURCE_UI: McpUiResourceMeta = { prefersBorder: true };

/**
 * Build a fresh MCP server bound to the calling user.
 * The server is stateless (one per HTTP request), so all 13 tools
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

  // The interactive review card (single self-contained HTML, see views/app/build.ts).
  registerAppResource(
    server,
    'Review card',
    REVIEW_CARD_URI,
    {
      description: 'Interactive review card: approve, reject, edit or skip the current asset.',
      _meta: { ui: REVIEW_CARD_RESOURCE_UI },
    },
    () =>
      Promise.resolve({
        contents: [
          {
            uri: REVIEW_CARD_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: REVIEW_CARD_APP_HTML,
            _meta: { ui: REVIEW_CARD_RESOURCE_UI },
          },
        ],
      }),
  );

  // Register all 13 tools across the three domains
  registerReviewTools(server, services, user);
  registerCampaignTools(server, services, user);
  registerMetricViewTools(server, services, user);

  return server;
}
