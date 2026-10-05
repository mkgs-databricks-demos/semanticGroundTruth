# L200-C4 — MCP Server

## Component Design Document

**Component:** C4 — MCP Server
**Type:** MCP TypeScript SDK v2 + MCP Apps
**Owner:** TBD
**References:** L100 § Dual Interface Architecture, § MCP Server (Conversational), § Technology Decisions

---

### Overview

The MCP Server exposes the Ground Truth App's review functionality over the Model Context Protocol, enabling users to review UC semantic assets conversationally from within Genie One or any MCP-compatible client. On MCP Apps-capable clients, it renders an interactive card-swipe View directly in the chat. It is co-hosted in the same Databricks App as the standalone UI and registered as a Unity Gateway MCP Service.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C2 Review Engine | API | All review logic delegated to the Review Engine REST API |
| `@modelcontextprotocol/server` v2 | Library | MCP TypeScript SDK for tool registration |
| `@modelcontextprotocol/node` | Library | Streamable HTTP transport for Node.js |
| Unity Gateway (Bundle 1) | Infrastructure | Connection registration + MCP Service serving |
| MCP Apps (pre-private preview) | Platform | Interactive View rendering in Genie One |

### Design

#### MCP Tool Definitions

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import * as z from "zod/v4";

const server = new McpServer({
  name: "ground-truth",
  version: "1.0.0",
});

// Tool 1: Get next review card
server.registerTool("get_next_review_card", {
  description: "Get the next UC semantic asset to review. Returns a card with name, description, synonyms, and optionally logic and example queries.",
  inputSchema: z.object({
    asset_type: z.enum(["measure", "dimension", "page", "domain", "subdomain"]).optional()
      .describe("Filter by asset type"),
    campaign_id: z.string().optional()
      .describe("Scope to a specific campaign"),
  }),
}, async ({ asset_type, campaign_id }) => {
  // Delegate to Review Engine API
  const card = await reviewEngine.getNext({ userId, asset_type, campaign_id });
  return { content: [{ type: "text", text: JSON.stringify(card) }] };
  // MCP Apps: return interactive View with card-swipe UI
});

// Tool 2: Submit a vote
server.registerTool("submit_vote", {
  description: "Approve or reject a UC semantic asset definition. Provide feedback when rejecting.",
  inputSchema: z.object({
    asset_id: z.string().describe("The asset to vote on"),
    vote: z.enum(["approve", "reject"]).describe("Your vote"),
    feedback: z.string().optional().describe("Required when rejecting — explain why"),
  }),
}, async ({ asset_id, vote, feedback }) => {
  const result = await reviewEngine.vote({ asset_id, vote, feedback, userId });
  return { content: [{ type: "text", text: `Vote recorded. Confidence: ${result.new_confidence_score}` }] };
});

// Tool 3: Add or remove a synonym
server.registerTool("add_synonym", {
  description: "Add a new synonym for a UC semantic asset, or remove an existing one.",
  inputSchema: z.object({
    asset_id: z.string(),
    action: z.enum(["add", "remove"]),
    synonym: z.string().describe("The synonym text"),
  }),
}, async ({ asset_id, action, synonym }) => {
  const result = await reviewEngine.synonym({ asset_id, action, synonym, userId });
  return { content: [{ type: "text", text: `Synonym ${action}ed: "${synonym}"` }] };
});

// Tool 4: Add or vote on an example question
server.registerTool("add_example_question", {
  description: "Add a natural language example question that uses this measure/dimension, or approve/reject an existing example.",
  inputSchema: z.object({
    asset_id: z.string(),
    action: z.enum(["add", "approve", "reject"]),
    question_text: z.string().optional().describe("Required when adding a new example"),
    question_id: z.string().optional().describe("Required when approving/rejecting an existing example"),
  }),
}, async ({ asset_id, action, question_text, question_id }) => {
  const result = await reviewEngine.example({ asset_id, action, question_text, question_id, userId });
  return { content: [{ type: "text", text: `Example question ${action}ed.` }] };
});

// Tool 5: Get review stats
server.registerTool("get_review_stats", {
  description: "Get your review statistics, the leaderboard, and overall coverage metrics.",
  inputSchema: z.object({}),
}, async () => {
  const stats = await reviewEngine.getStats({ userId });
  return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
});

// Tool 6: Run a validation query
server.registerTool("run_validation_query", {
  description: "Run a sample aggregation query to see what this measure/dimension produces with real data.",
  inputSchema: z.object({
    asset_id: z.string().describe("The asset to query"),
  }),
}, async ({ asset_id }) => {
  const result = await reviewEngine.runQuery({ asset_id, userId });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});
```

#### MCP Apps Interactive View

On MCP Apps-capable clients (including Genie One with pre-private preview), the server returns an interactive View instead of plain text for `get_next_review_card`:

- The View renders the full card-swipe UI: asset badge, name, description, synonym chips, accordion, example questions
- Approve/reject buttons in the View trigger `submit_vote` tool calls
- The View updates in real-time as the user interacts
- Fallback: clients without MCP Apps support receive a text-formatted card with instructions to call `submit_vote`

#### Unity Gateway Registration

The MCP Server is registered as:
1. A **Unity Gateway connection** in the target `catalog.schema` (same as Lakebase CDF tables)
2. Served as a **Unity Gateway MCP Service** — discoverable via Unity Gateway, governed by UC grants and service policies

No `mcp-` prefix naming required.

#### Authentication

- **OBO auth** is preserved through the MCP protocol — the user's identity is forwarded from the MCP client (Genie One) to the MCP Server, then to the Review Engine
- Votes are attributed to the actual user, not the app's service principal
- UC permissions are enforced on sample query execution

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Tool call latency | < 500ms p95 | Excluding run_validation_query |
| MCP Apps View render | < 2s p95 | Includes MCP round-trip |
| Concurrent MCP sessions | 50+ | Multiple users in Genie One simultaneously |
| Fallback reliability | 100% | Text mode always works even if MCP Apps fails |

### Testing

- **Tool contract tests:** Each of the 6 tools with valid/invalid inputs
- **MCP Apps View tests:** Interactive View renders correctly, buttons trigger correct tool calls
- **Fallback tests:** Verify text-mode works when MCP Apps is unavailable
- **Auth tests:** OBO identity correctly forwarded through MCP → Review Engine → SQL Warehouse
- **Unity Gateway tests:** Service discoverable, policies enforced, audit logged

### Deployment

- Co-hosted in Bundle 2 (App) — same Node.js process as the standalone app
- MCP endpoint exposed at `/mcp` path on the app URL
- Unity Gateway connection created in Bundle 1 (Infra) post-deploy
- MCP Service registration verified in Bundle 2 post-deploy validation

### Resolved Questions

1. ✅ **MCP Apps View: start conservative for V1.** Design for structured content rendering (text, buttons, lists, cards) with action buttons triggering tool calls. Assume HTML/CSS-level rendering, not arbitrary React. Enhance if pre-private preview reveals richer capabilities. The platform likely supports the latest, but conservative design ensures reliability.
2. ✅ **Stateless Views, state in Lakebase.** Each tool call returns a fresh View. Session state (current card, accordion state) tracked in a lightweight Lakebase session table. Simpler and more resilient than client-side state across MCP tool calls.
3. ✅ **Design for proactive surfacing, defer to V2.** MCP is request-response; server-initiated messages aren't native. Genie One could periodically check for pending reviews — this is a Genie One integration question. For V1, user initiates by asking.
4. ✅ **Natural multi-turn via conversation_id.** MCP Server maintains a session across tool calls. After each vote, agent auto-calls `get_next_review_card`. User controls flow naturally ("review 10 more" or "that's enough").

> See [docs/diagrams/mermaid/08_dual_interface_architecture.md] for the dual interface architecture.
