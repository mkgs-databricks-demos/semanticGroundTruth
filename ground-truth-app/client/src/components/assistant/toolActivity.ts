// @a11y-strict
// client/src/components/assistant/toolActivity.ts — reviewer-facing tool activity lines (S3, F10)
// Session 53 · Build 5 · wave 5-2. Tool calls from the agents stream render
// as "Looked up: leaderboard (7 days)" instead of the tool name and raw JSON
// arguments (screen_inventory S3 "Missing today"). Tool names are the
// read-only tools of server/agents/review-worker/agent.ts; the sub-agent
// delegation shows up as the `agent-review-worker` tool.

const TOOL_LABELS: Readonly<Record<string, string>> = {
  get_asset: 'Looked up: asset details',
  search_assets: 'Searched: semantic assets',
  explain_confidence: 'Looked up: confidence score',
  get_leaderboard: 'Looked up: leaderboard',
  get_campaigns: 'Looked up: campaigns',
  get_coverage_summary: 'Looked up: coverage summary',
  'agent-review-worker': 'Looked up: review data',
};

const PERIOD_LABELS: Readonly<Record<string, string>> = {
  '7d': '7 days',
  '30d': '30 days',
  all: 'all time',
};

/** Fallback for a tool this page does not know yet (never the raw name). */
export const GENERIC_TOOL_LABEL = 'Looked up: review data';

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    // Arguments can arrive partial while streaming; the label does not need them.
    return {};
  }
}

/** One plain-language line for a tool call, e.g. "Looked up: leaderboard (30 days)". */
export function toolActivityLabel(name: string | undefined, rawArgs?: string): string {
  const base = (name && TOOL_LABELS[name]) || GENERIC_TOOL_LABEL;
  if (name === 'get_leaderboard') {
    const period = parseArgs(rawArgs).period;
    const label = typeof period === 'string' ? PERIOD_LABELS[period] : undefined;
    if (label) return `${base} (${label})`;
  }
  return base;
}
