// server/mcp/tools/campaign.ts — campaign_* MCP tool registrations
// Session 11 · Wave 4 · No enum, no namespace, no default export

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Services } from '../../services';
import type { UserContext } from '../../lib/context';
import { requireRole } from '../../lib/context';
import { McpToolShapes } from '../../../shared/contracts/mcp';
import { toToolError } from '../errors';
import { renderCampaignsMarkdown } from '../views/markdown';

export function registerCampaignTools(
  server: McpServer,
  services: Services,
  user: UserContext,
): void {
  // ---- campaign_list ----
  server.tool(
    'campaign_list',
    'List review campaigns. Optionally filter by status.',
    McpToolShapes.campaign_list,
    async (args) => {
      try {
        const campaigns = await services.campaigns.list(user, {
          status: args.status,
        });
        const md = renderCampaignsMarkdown(campaigns);
        return {
          content: [{ type: 'text', text: md }],
          structuredContent: campaigns as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- campaign_create ----
  server.tool(
    'campaign_create',
    'Create a new review campaign. Requires steward role.',
    McpToolShapes.campaign_create,
    async (args) => {
      try {
        requireRole(user, 'steward');
        const campaign = await services.campaigns.create(
          {
            name: args.name,
            campaignType: args.campaign_type,
            scopeDomain: args.scope_domain,
            scopeSubdomain: args.scope_subdomain,
            scopeAssetType: args.scope_asset_type,
            scopeAssetIds: args.scope_asset_ids,
            rbacGroups: args.rbac_groups,
            freshnessIntervalDays: args.freshness_interval_days,
            completionRule: args.completion_rule,
          },
          user.userId,
        );
        const text = `Campaign **${campaign.name}** created (id: ${campaign.id}, ` +
          `type: ${campaign.campaignType}, assets: ${campaign.totalAssets}).`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: campaign as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- campaign_update_status ----
  server.tool(
    'campaign_update_status',
    'Update a campaign status (active, paused, completed, archived). Requires steward role.',
    McpToolShapes.campaign_update_status,
    async (args) => {
      try {
        requireRole(user, 'steward');
        const campaign = await services.campaigns.updateStatus(
          args.campaign_id,
          args.status,
          user.userId,
        );
        const text = `Campaign **${campaign.name}** status updated to **${campaign.status}**.`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: campaign as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );
}
