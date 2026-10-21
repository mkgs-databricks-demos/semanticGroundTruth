// shared/contracts/mcp.ts — MCP tool names and raw zod input shapes
// Session 01 · Wave 0 · No enum, no namespace, no default export
// Keys are snake_case (LLM-friendly); reuses api.ts field definitions where possible.

import { z } from 'zod';
import {
  ASSET_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  COMPLETION_RULES,
  VOTE_TYPES,
} from './values';

/**
 * Exactly 12 tool names, matching the MCP service selectors in
 * `resources/ground_truth_mcp.mcp_service.yml`.
 * Every name starts with `review_`, `campaign_`, or `metric_view_`.
 */
export const MCP_TOOL_NAMES = [
  'review_get_next',
  'review_submit_vote',
  'review_add_synonym',
  'review_add_example',
  'review_get_stats',
  'review_run_query',
  'campaign_list',
  'campaign_create',
  'campaign_update_status',
  'metric_view_list',
  'metric_view_get',
  'metric_view_validate',
] as const;
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

const uuid = z.string().uuid();

/**
 * Raw zod shape objects for each MCP tool's input.
 * Use `z.object(McpToolShapes.<tool_name>)` to create the runtime schema.
 */
export const McpToolShapes = {
  review_get_next: {
    campaign_id: uuid.optional(),
    asset_type: z.enum(ASSET_TYPES).optional(),
  },
  review_submit_vote: {
    asset_id: uuid,
    vote_type: z.enum(VOTE_TYPES),
    feedback: z.string().max(4000).optional(),
    edits: z.object({
      description: z.string().optional(),
      plain_english_logic: z.string().optional(),
      display_name: z.string().optional(),
    }).optional(),
  },
  review_add_synonym: {
    asset_id: uuid,
    action: z.enum(['add', 'remove', 'approve', 'reject']),
    synonym: z.string().min(1).max(200),
  },
  review_add_example: {
    asset_id: uuid,
    action: z.enum(['add', 'approve', 'reject']),
    question_text: z.string().min(1).optional(),
    question_id: uuid.optional(),
  },
  review_get_stats: {
    period: z.enum(['7d', '30d', 'all']).default('7d'),
  },
  review_run_query: {
    asset_id: uuid,
  },
  campaign_list: {
    status: z.enum(CAMPAIGN_STATUSES).optional(),
  },
  campaign_create: {
    name: z.string().min(1),
    campaign_type: z.enum(CAMPAIGN_TYPES),
    scope_domain: z.string().optional(),
    scope_subdomain: z.string().optional(),
    scope_asset_type: z.enum(ASSET_TYPES).optional(),
    scope_asset_ids: z.array(uuid).optional(),
    rbac_groups: z.array(z.string()).optional(),
    freshness_interval_days: z.number().int().positive().optional(),
    completion_rule: z.enum(COMPLETION_RULES).optional(),
  },
  campaign_update_status: {
    campaign_id: uuid,
    status: z.enum(CAMPAIGN_STATUSES),
  },
  metric_view_list: {
    catalog: z.string().optional(),
    schema: z.string().optional(),
  },
  metric_view_get: {
    full_name: z.string().min(1),
  },
  metric_view_validate: {
    full_name: z.string().min(1),
  },
} as const;
