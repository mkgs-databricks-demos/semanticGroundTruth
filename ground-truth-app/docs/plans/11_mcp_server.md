# Session 11: MCP Server at `/mcp` (Phase H)

## Scope
Replace session 09's stub `server/mcp/index.ts` with a real MCP server: stateless Streamable HTTP transport at `POST /mcp`, the 12 tools named in `shared/contracts/mcp.ts`, per-user review session state in `app.mcp_sessions`, and markdown + optional MCP Apps HTML card rendering. Do not edit `server/server.ts` — it already calls `mountMcp(app, services)`.

## Context
* `../docs/design/L200-C4_mcp_server.md` (behaviour; **ignore its tool names**), `L300-12_mcp_server_implementation.md`, `build_conventions.md` §4 (MCP identity: `res.locals.user`, `source: 'mcp'`) and §5.3.
* Unity Gateway MCP service `semantic-ground-truth-mcp` (see `resources/ground_truth_mcp.mcp_service.yml`) forwards to `<app_url>/mcp` and only exposes tools matching `review_*`, `campaign_*`, `metric_view_*`.
* `Services` from `server/services/index.ts` (session 09) — read session 09's summary for exact method names.
* SDK: `@modelcontextprotocol/sdk` ^1.23 (added by session 02):
  * `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'`
  * `import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'`
  * `server.registerTool(name, { title, description, inputSchema: <zod raw shape> }, async (args) => ({ content: [{ type: 'text', text }], structuredContent }))`
  * Stateless: new `McpServer` + `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` per request; `await server.connect(transport); await transport.handleRequest(req, res, req.body)`; close both on `res.on('close')`.
  * If the installed SDK's zod peer is v3 and conflicts with zod v4, the controller resolves it at deploy time — still pass the shapes from `McpToolShapes` and note the risk under `assumptions`.

## Tasks
1. `server/mcp/index.ts` — `mountMcp(app: Application, services: Services): void`: `app.post('/mcp', asyncRoute(...))` building a per-request server with the caller's `UserContext` (`getUser(res)`); `app.get('/mcp')` and `app.delete('/mcp')` -> 405 JSON-RPC error `{ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }`.
2. `server/mcp/server.ts` — `buildMcpServer(services: Services, user: UserContext): McpServer` (name `semantic-ground-truth`, version from `package.json` `version` or `'0.1.0'`); registers all tools.
3. `server/mcp/tools/review.ts` — `review_get_next`, `review_submit_vote`, `review_add_synonym`, `review_add_example`, `review_get_stats`, `review_run_query`. `review_submit_vote` defaults `asset_id` to the session's `current_asset_id` when omitted.
4. `server/mcp/tools/campaign.ts` — `campaign_list`, `campaign_create` (steward), `campaign_update_status` (steward).
5. `server/mcp/tools/metricView.ts` — `metric_view_list`, `metric_view_get`, `metric_view_validate`. These need `user.accessToken`; if absent (M2M via gateway may not forward an OBO token), return a tool error explaining OBO is unavailable over MCP and record this under `assumptions`.
6. `server/mcp/session.ts` — `McpSessionStore` over `app.mcp_sessions` keyed `session_id = 'user:' + userId`: `get(userId)`, `setCurrent(userId, assetId, campaignId?)`.
7. `server/mcp/views/markdown.ts` (pure) — `renderCardMarkdown(card: ReviewCard): string`, `renderStatsMarkdown(stats: UserStats): string`, `renderCampaignsMarkdown(c: Campaign[])`, `renderQueryResultMarkdown(r: QueryResult)` (max 20 rows as a markdown table).
8. `server/mcp/views/cardHtml.ts` (pure) — `renderCardHtml(card: ReviewCard): string` (self-contained HTML, inline CSS, escaped text, Databricks brand colours Lava 600 `#FF3621` / Navy 800 `#1B3139`). Register it as an MCP resource `ui://ground-truth/review-card` (`mimeType: 'text/html'`) and reference it from `review_get_next` results via `_meta` — best effort; the markdown text content is always returned.
9. `server/mcp/errors.ts` — `toToolError(err: unknown)` -> `{ isError: true, content: [{ type: 'text', text }] }` (uses `toAppError`; never includes stack traces or tokens).
10. Every tool: `structuredContent` = the DTO; `content[0].text` = markdown; role checks via `hasRole`.

## Acceptance Criteria
- [ ] Exactly the 12 tool names from `MCP_TOOL_NAMES` are registered (iterate the constant or assert in a unit test) and all match `review_*|campaign_*|metric_view_*`.
- [ ] `POST /mcp` mounted; GET/DELETE return 405; no stub 503 remains.
- [ ] Votes created via MCP carry `source = 'mcp'`.
- [ ] `server/mcp/views/markdown.test.ts` (written, not run) covers card + table rendering and HTML escaping in `cardHtml`.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/mcp/**`

## Dependencies
- Waves 0-3 (sessions 01-10). Parallel with 12, 13, 14.
