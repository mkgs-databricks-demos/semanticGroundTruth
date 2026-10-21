// server/mcp/tools/metricView.ts — metric_view_* MCP tool registrations
// Session 11 · Wave 4 · No enum, no namespace, no default export
//
// These tools require user.accessToken (OBO). If absent (M2M via gateway
// without token forwarding), they return a tool error explaining the
// limitation. See assumptions in the status file.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Services } from '../../services';
import type { UserContext } from '../../lib/context';
import { McpToolShapes } from '../../../shared/contracts/mcp';
import { toToolError } from '../errors';

function requireObo(user: UserContext): void {
  if (!user.accessToken) {
    throw Object.assign(
      new Error(
        'OBO token unavailable. Metric view tools require a user access token, ' +
        'which is not forwarded over M2M MCP connections. Use the web UI or a ' +
        'direct MCP client with user authentication.',
      ),
      { code: 'FORBIDDEN', status: 403 },
    );
  }
}

export function registerMetricViewTools(
  server: McpServer,
  services: Services,
  user: UserContext,
): void {
  // ---- metric_view_list ----
  server.tool(
    'metric_view_list',
    'List metric views in a Unity Catalog schema. Requires OBO token.',
    McpToolShapes.metric_view_list,
    async (args) => {
      try {
        requireObo(user);
        const views = await services.metricViews.list(user, {
          catalog: args.catalog,
          schema: args.schema,
        });
        const text = views.length > 0
          ? views.map((v) => `- **${v.fullName}**${v.comment ? `: ${v.comment}` : ''}`).join('\n')
          : 'No metric views found.';
        return {
          content: [{ type: 'text', text }],
          structuredContent: views as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- metric_view_get ----
  server.tool(
    'metric_view_get',
    'Get detailed information about a metric view including measures and dimensions. Requires OBO token.',
    McpToolShapes.metric_view_get,
    async (args) => {
      try {
        requireObo(user);
        const detail = await services.metricViews.get(user, args.full_name);
        const lines: string[] = [
          `## ${detail.fullName}`,
          detail.comment ? `> ${detail.comment}` : '',
          `**Measures:** ${detail.measureCount} \u00b7 **Dimensions:** ${detail.dimensionCount}`,
        ];
        if (detail.measures.length > 0) {
          lines.push('', '### Measures');
          for (const m of detail.measures) {
            lines.push(`- **${m.name}**: \`${m.expr}\`${m.comment ? ` — ${m.comment}` : ''}`);
          }
        }
        if (detail.dimensions.length > 0) {
          lines.push('', '### Dimensions');
          for (const d of detail.dimensions) {
            lines.push(`- **${d.name}**: \`${d.expr}\`${d.comment ? ` — ${d.comment}` : ''}`);
          }
        }
        return {
          content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }],
          structuredContent: detail as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- metric_view_validate ----
  server.tool(
    'metric_view_validate',
    'Validate that a metric view is accessible and parseable. Requires OBO token.',
    McpToolShapes.metric_view_validate,
    async (args) => {
      try {
        requireObo(user);
        const result = await services.metricViews.validate(user, args.full_name);
        const text = result.valid
          ? `\u2705 Metric view **${args.full_name}** is valid.`
          : `\u274c Metric view **${args.full_name}** validation failed: ${result.error ?? 'unknown error'}`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );
}
