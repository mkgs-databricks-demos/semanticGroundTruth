// server/mcp/errors.ts — MCP tool error mapper
// Session 11 · Wave 4 · No enum, no namespace, no default export

import { toAppError } from '../lib/errors';

export interface ToolError {
  [key: string]: unknown;
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Maps any thrown error into an MCP-compatible tool error.
 * Uses `toAppError` for classification; never includes stack traces or tokens.
 */
export function toToolError(err: unknown): ToolError {
  const appErr = toAppError(err);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Error [${appErr.code}]: ${appErr.message}`,
      },
    ],
  };
}
