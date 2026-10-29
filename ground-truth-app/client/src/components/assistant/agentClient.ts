// @a11y-strict
// client/src/components/assistant/agentClient.ts — the one place the Assistant reads the agents plugin
// Session 53 · Build 5 · wave 5-2. Re-exports AppKit's agents hooks unchanged
// (useAgentChat streams AgentChatEvents; usePluginClientConfig('agents')
// reads the boot-time agent registry). Tests mock this module at module
// level (ui_test_strategy §8 S3), so no test has to stub all of
// @databricks/appkit-ui. Traces are recorded server-side (session 45).

export { useAgentChat, usePluginClientConfig } from '@databricks/appkit-ui/react';
export type { AgentChatEvent, UseAgentChatOptions, UseAgentChatResult } from '@databricks/appkit-ui/react';

/**
 * Shape of the agents plugin's `clientConfig()` payload, inlined into the
 * boot HTML via `<script id="__appkit__">`.
 */
export interface AgentsClientConfig {
  agents: string[];
  /** null only when no agent is registered (the no-agent state). */
  defaultAgent: string | null;
  /** Per-agent skill catalog (name + description) for the skill picker. */
  skills?: Record<string, { name: string; description: string }[]>;
}

export const AGENTS_PLUGIN = 'agents';
