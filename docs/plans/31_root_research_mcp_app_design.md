# Session 31: MCP App design for the review card (research + design doc)

**Build 4 · wave `4-0` · edit (design, docs only) · root**

## Scope

Design the interactive review experience the app's MCP server returns to MCP hosts (Genie One, Genie Code, Claude, others) using the **MCP Apps** extension, so a reviewer can approve / reject / edit / skip a card inside the host chat. Output a design doc precise enough for session 34 to implement without further decisions. No code.

## Context

* Local clone of the extension: `/Workspace/Users/matthew.giglia@databricks.com/mcp-ext-apps` (package `@modelcontextprotocol/ext-apps` **1.7.5**). Read: `README.md`, `docs/overview.md`, `docs/patterns.md` (+ `patterns.tsx`), `docs/quickstart.md`, `docs/authorization.md`, `docs/csp-cors.md`, `docs/testing-mcp-apps.md`, `docs/mcp-theme.css`, `specification/`, `plugins/mcp-apps/skills/{create-mcp-app,add-app-to-server,convert-web-app}/`, examples `basic-server-react`, `basic-server-vanillajs`, `integration-server`, `lazy-auth-server`, `debug-server`, `examples/basic-host`.
* Version decision (planner, 2026-10-24): pin **1.7.5**, which pairs with the app's `@modelcontextprotocol/sdk` 1.32.1. 2.x needs the SDK v2 split packages. Only recommend 2.x if you find a 1.7.5 limitation that blocks Genie One; then say exactly what breaks.
* The workspace has the MCP Apps preview enabled (owner, 2026-10-24). Genie One rendering of today's card is unverified (G9).
* Current server: `ground-truth-app/server/mcp/{server.ts,session.ts,errors.ts}`, tools in `server/mcp/tools/{review,campaign,metricView}.ts` (12 tools), card resource `ui://ground-truth/review-card` built by `server/mcp/views/cardHtml.ts` (static branded HTML), text fallback `views/markdown.ts`. Stateless StreamableHTTP at `POST /mcp`, M2M/OBO auth via the Apps proxy. Design docs: `docs/design/L200-C3_card_ui.md`, `docs/design/L200-C4_mcp_server.md`, `docs/design/L300-11_mcp_server_implementation.md`, brand `docs/plans/ui_brand_plan.md`.
* Skip is not a vote (plan 25); new tool `review_skip_card` (session 34).

## Deliverable: `docs/design/L300-17_mcp_app_review_card.md`

Cover, with file/line references into the ext-apps repo for every API you rely on:

1. **Host compatibility matrix:** Genie One / Genie Code / Claude / basic-host: does the host render `ui://` resources, which `_meta.ui` fields it reads, CSP behaviour, how a host without MCP Apps support degrades (text fallback stays mandatory).
2. **Resource:** URI(s), MIME type (`text/html;profile=mcp-app` per spec), how the HTML bundle is produced (single-file inline vs built asset), size budget, CSP declarations (`_meta.ui.csp`: no external origins; fonts inlined), `prefersBorder`, sizing (`containerDimensions` / auto-resize).
3. **Tool wiring:** which tools carry `_meta.ui.resourceUri` (`review_get_next`, `review_submit_vote`, `review_skip_card`, `review_get_stats`?), visibility (`app`-only helper tools vs model-visible), `structuredContent` shape for the view (reuse plan 25 zod schemas), what `content[].text` says for non-UI hosts.
4. **View behaviour:** the `App` client lifecycle (connect, `ontoolresult`, `ontoolinput`, host context, theme), actions calling `app.callServerTool(...)` for vote/skip/edit and loading the next card, optimistic UI and error states, keyboard shortcuts (A/R/E/S) and focus order, reduced motion, light/dark from host theme variables mapped to brand tokens.
5. **Auth:** which identity each tool call runs as through the Apps proxy and the UC connection; whether the view can call tools directly (no extra auth) and what it must never do (no tokens in HTML, no fetch to the app origin unless the CSP and auth allow it).
6. **Testing plan:** unit tests for the resource and tool `_meta` (vitest), a headless test with the ext-apps test utilities if 1.7.5 ships them, the `basic-host` manual check, and the live MCP checks the contract job (session 35) should add (resource read returns the MIME type and a non-empty HTML; `tools/list` exposes `_meta.ui.resourceUri`).
7. **Acceptance list for session 34** (numbered, testable) and **open questions** for the owner.

## Acceptance Criteria

- [ ] Design doc exists with all 7 sections; every SDK API it names is cited to a file in the local ext-apps clone.
- [ ] Version decision stated (1.7.5 confirmed or a justified exception).
- [ ] Session 34 acceptance list is numbered and testable.

## Owned Paths

- `docs/design/L300-17_mcp_app_review_card.md`

## Dependencies

- None (wave `4-0`). Session 34 implements it.
