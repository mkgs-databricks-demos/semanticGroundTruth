// server/mcp/tools/campaign.ts — campaign_* MCP tool registrations
// Session 11 · Wave 4 · No enum, no namespace, no default export
// Session 34 · Wave 4-2: registered through registerContractTool (input + output validation)

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Services } from '../../services';
import type { UserContext } from '../../lib/context';
import { requireRole } from '../../lib/context';
import { renderCampaignsMarkdown } from '../views/markdown';
import { registerContractTool } from './define';

export function registerCampaignTools(
  server: McpServer,
  services: Services,
  user: UserContext,
): void {
  // ---- campaign_list ----
  registerContractTool(server, 'campaign_list', {
    description: 'List review campaigns. Optionally filter by status.',
    handler: async (args) => {
      const campaigns = await services.campaigns.list(user, { status: args.status });
      return { text: renderCampaignsMarkdown(campaigns), data: campaigns };
    },
  });

  // ---- campaign_create ----
  registerContractTool(server, 'campaign_create', {
    description: 'Create a new review campaign. Requires steward role.',
    handler: async (args) => {
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
      return { text, data: campaign };
    },
  });

  // ---- campaign_update_status ----
  registerContractTool(server, 'campaign_update_status', {
    description: 'Update a campaign status (active, paused, completed, archived). Requires steward role.',
    handler: async (args) => {
      requireRole(user, 'steward');
      const campaign = await services.campaigns.updateStatus(args.campaign_id, args.status, user.userId);
      const text = `Campaign **${campaign.name}** status updated to **${campaign.status}**.`;
      return { text, data: campaign };
    },
  });
}
