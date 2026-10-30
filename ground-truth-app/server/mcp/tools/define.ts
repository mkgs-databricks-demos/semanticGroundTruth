// server/mcp/tools/define.ts — registers MCP tools from MCP_TOOL_CONTRACTS with input + output validation
// Session 34 · Wave 4-2 · No enum, no namespace, no default export
//
// Every tool goes through registerContractTool:
//   * input  — the contract's zod schema (a z.object, i.e. a Standard Schema;
//              SDK v2 no longer takes raw shapes) is the tool's inputSchema, so the MCP
//              SDK rejects invalid arguments before the handler runs and returns
//              a tool error (isError: true) whose text carries the zod issues.
//   * output — the handler's data is checked against the contract's output
//              schema (plus an optional extension) before it is returned as
//              structuredContent; the same reply supplies the markdown text.
// Tools with `ui` are registered with registerAppTool (MCP Apps _meta.ui, the
// non-deprecated Standard Schema overload of ext-apps 2.x).

import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { McpUiToolMeta } from '@modelcontextprotocol/ext-apps';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { z } from 'zod';
import type { McpToolName, McpToolNameBuild4, McpToolShapes } from '../../../shared/contracts/mcp';
import { MCP_TOOL_CONTRACTS, type McpToolContract } from '../../../shared/contracts/schemas';
import { logger } from '../../lib/logger';
import { toToolError } from '../errors';

export const REVIEW_CARD_URI = 'ui://ground-truth/review-card';

/** _meta.ui for the tools that render the review card (design L300-17 §3). */
export const REVIEW_CARD_UI: McpUiToolMeta = { resourceUri: REVIEW_CARD_URI };

export type ContractToolName = McpToolName | McpToolNameBuild4;

type Shapes = typeof McpToolShapes;
type ArgsOf<N extends keyof Shapes> = z.output<z.ZodObject<Shapes[N]>>;

/** Parsed arguments for a tool, as validated by its MCP_TOOL_CONTRACTS input. */
export type ToolArgs<N extends ContractToolName> = N extends 'review_submit_vote'
  ? Omit<ArgsOf<N>, 'asset_id'> & { asset_id?: string }
  : N extends keyof Shapes
    ? ArgsOf<N>
    : never;

/** What a handler returns: markdown text, and the structuredContent data. */
export interface ToolReply {
  text: string;
  /** Omit only for the contract's text-only reply (emptyText). */
  data?: unknown;
}

export interface ContractToolSpec<N extends ContractToolName> {
  description: string;
  ui?: McpUiToolMeta;
  /** Extra fields beyond the contract output (validated in addition to it). */
  extraOutput?: z.ZodType;
  handler: (args: ToolArgs<N>) => Promise<ToolReply>;
}

export function getToolContract(name: ContractToolName): McpToolContract {
  const contract = MCP_TOOL_CONTRACTS.find((t) => t.name === name);
  if (!contract) throw new Error(`No MCP_TOOL_CONTRACTS entry for tool ${name}`);
  return contract;
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.length > 0 ? i.path.map(String).join('.') : '(root)'}: ${i.message}`)
    .join('; ');
}

function outputError(name: string, detail: string): CallToolResult {
  logger.error('MCP tool output failed its contract', { tool: name, detail });
  return {
    isError: true,
    content: [
      { type: 'text', text: `Error [INTERNAL]: ${name} returned output that does not match its contract (${detail}).` },
    ],
  };
}

/** Run a handler and turn its reply into a validated CallToolResult. */
export async function runContractTool<N extends ContractToolName>(
  contract: McpToolContract,
  spec: ContractToolSpec<N>,
  args: ToolArgs<N>,
): Promise<CallToolResult> {
  let reply: ToolReply;
  try {
    reply = await spec.handler(args);
  } catch (err) {
    return toToolError(err);
  }
  const content = [{ type: 'text' as const, text: reply.text }];

  if (reply.data === undefined) {
    if (contract.output !== null && reply.text !== contract.emptyText) {
      return outputError(contract.name, 'structuredContent is missing');
    }
    return { content };
  }
  if (contract.output === null) {
    return outputError(contract.name, 'the contract has no structuredContent');
  }
  for (const schema of [contract.output, spec.extraOutput]) {
    if (!schema) continue;
    const parsed = schema.safeParse(reply.data);
    if (!parsed.success) return outputError(contract.name, formatZodIssues(parsed.error));
  }
  return { content, structuredContent: reply.data as Record<string, unknown> };
}

/** Register one tool with its contract's input schema and output validation. */
export function registerContractTool<N extends ContractToolName>(
  server: McpServer,
  name: N,
  spec: ContractToolSpec<N>,
): void {
  const contract = getToolContract(name);
  // The SDK has already parsed args with contract.input before this runs.
  const callback = (args: Record<string, unknown>): Promise<CallToolResult> =>
    runContractTool(contract, spec, args as unknown as ToolArgs<N>);
  if (spec.ui) {
    registerAppTool(
      server,
      name,
      { description: spec.description, inputSchema: contract.input, _meta: { ui: spec.ui } },
      callback,
    );
  } else {
    server.registerTool(name, { description: spec.description, inputSchema: contract.input }, callback);
  }
}
