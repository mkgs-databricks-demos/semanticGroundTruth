# L300-11 — MCP Server (TypeScript SDK, Tool Definitions, MCP Apps View)

## Implementation Spec

**Phase:** 2 (Bundle 2 — App)
**Type:** Genie Code session + manual coding
**Prerequisites:** L300-10 complete (Review Engine API exists)
**References:** L200-C4

---

### Step 1: Create the MCP server module

**Type:** Genie Code session

Prompt:
```
Create the MCP server in bundle-app/src/mcp/:

1. mcpServer.ts — Initialize McpServer from @modelcontextprotocol/server v2
   - Register all 6 tools (get_next_review_card, submit_vote, add_synonym, 
     add_example_question, get_review_stats, run_validation_query)
   - Each tool delegates to the Review Engine REST API (localhost)
   - Include comprehensive tool descriptions for agent discovery

2. mcpTransport.ts — Set up NodeStreamableHTTPServerTransport
   - Mount at /mcp path on the Express app
   - Handle session management (conversation_id tracking)
   - Forward OBO auth context from MCP client to Review Engine

3. mcpAppsView.ts — MCP Apps interactive View rendering
   - For get_next_review_card: return structured card View with:
     - Asset badge, name, description
     - Synonym chips (interactive)
     - Approve/Reject action buttons
     - Accordion toggle for advanced view
   - For get_review_stats: return stats summary View
   - Fallback: plain text for non-MCP-Apps clients
```

### Step 2: Mount MCP server on the Express app

**Type:** Manual (editor)

Update `server.js` to mount the MCP transport:

```javascript
import { createMcpHandler } from './src/mcp/mcpTransport.js';

// Mount MCP server at /mcp
app.use('/mcp', createMcpHandler(reviewEngine));
```

### Step 3: Test MCP tools locally

**Type:** Manual (terminal)

```bash
# Start the app locally
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:8000/mcp
```

Verify:
- [ ] `list_tools()` returns all 6 tools
- [ ] `get_next_review_card` returns a card
- [ ] `submit_vote` records a vote
- [ ] `get_review_stats` returns stats

---

### Open Questions

1. **TypeScript in Node.js AppKit:** Does the AppKit scaffold support TypeScript natively, or do we need to add a build step? The MCP SDK is TypeScript-first.
