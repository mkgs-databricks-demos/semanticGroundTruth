// server/mcp/toolNames.test.ts — MCP tool name invariant tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)
// Session 34 · Wave 4-2: 13 registered tools (12 deployed names + review_skip_card)

import { describe, expect, it } from 'vitest';
import { MCP_TOOL_NAMES, MCP_TOOL_NAMES_BUILD_4 } from '../../shared/contracts/mcp';
import { ALL_MCP_TOOL_NAMES } from '../../shared/contracts/schemas';

describe('ALL_MCP_TOOL_NAMES (registered by server/mcp/server.ts)', () => {
  it('contains exactly 13 tool names: the 12 deployed + review_skip_card', () => {
    expect(ALL_MCP_TOOL_NAMES).toHaveLength(13);
    expect(ALL_MCP_TOOL_NAMES).toEqual([...MCP_TOOL_NAMES, ...MCP_TOOL_NAMES_BUILD_4]);
    expect(ALL_MCP_TOOL_NAMES).toContain('review_skip_card');
  });

  it('has 7 review tools', () => {
    expect(ALL_MCP_TOOL_NAMES.filter((n) => n.startsWith('review_'))).toHaveLength(7);
  });

  it('all names are unique', () => {
    expect(new Set(ALL_MCP_TOOL_NAMES).size).toBe(ALL_MCP_TOOL_NAMES.length);
  });
});

describe('MCP_TOOL_NAMES', () => {
  it('contains exactly 12 tool names', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(12);
  });

  it('every name matches /^(review|campaign|metric_view)_/', () => {
    for (const name of MCP_TOOL_NAMES) {
      expect(
        /^(review|campaign|metric_view)_/.test(name),
        `"${name}" does not start with review_, campaign_, or metric_view_`,
      ).toBe(true);
    }
  });

  it('all names are unique', () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
  });

  it('names are non-empty strings', () => {
    for (const name of MCP_TOOL_NAMES) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('includes the expected review tools', () => {
    const reviewTools = MCP_TOOL_NAMES.filter((n) => n.startsWith('review_'));
    expect(reviewTools).toHaveLength(6);
    expect(reviewTools).toContain('review_get_next');
    expect(reviewTools).toContain('review_submit_vote');
  });

  it('includes the expected campaign tools', () => {
    const campaignTools = MCP_TOOL_NAMES.filter((n) => n.startsWith('campaign_'));
    expect(campaignTools).toHaveLength(3);
  });

  it('includes the expected metric_view tools', () => {
    const metricViewTools = MCP_TOOL_NAMES.filter((n) => n.startsWith('metric_view_'));
    expect(metricViewTools).toHaveLength(3);
  });
});
