# Session 34: MCP: `review_skip_card` tool + interactive review card as an MCP App

**Build 4 · wave `4-2` · edit · app**

## Scope

Implement session 31's design (`docs/design/L300-17_mcp_app_review_card.md`): add the `review_skip_card` tool, validate every MCP tool input/output with the plan 25 schemas, and turn `ui://ground-truth/review-card` into an MCP App built with `@modelcontextprotocol/ext-apps@1.7.5` so reviewers can vote, edit and skip inside an MCP host. Text fallback stays for hosts without MCP Apps.

## Context

* Design + numbered acceptance list: `docs/design/L300-17_mcp_app_review_card.md` (session 31). If it is missing or its version decision is not 1.7.5, stop as `blocked`.
* Server: `ground-truth-app/server/mcp/{server.ts,session.ts,errors.ts}`, tools `server/mcp/tools/{review,campaign,metricView}.ts` (12), views `server/mcp/views/{cardHtml.ts,markdown.ts}`. Services from session 33: `services/review` `skip(...)`, settings, steward APIs.
* Contracts: `MCP_TOOL_CONTRACTS` in `shared/contracts/schemas.ts` (13 tools including `review_skip_card`).
* Package `@modelcontextprotocol/ext-apps@1.7.5` added by session 26. Local reference clone: `/Workspace/Users/matthew.giglia@databricks.com/mcp-ext-apps` (`examples/basic-server-react`, `basic-server-vanillajs`, `docs/patterns.md`).
* Brand tokens: `client/src/theme/tokens.ts`, `docs/plans/ui_brand_plan.md`; fonts are committed under `client/public/fonts/` (no CDN).

## Tasks

1. `review_skip_card` tool in `tools/review.ts`: input `{assetId, campaignId?, reason?}`, calls `reviewService.skip(user, ..., 'mcp')`, returns the next card (same shape as `review_get_next`) plus `skippedCount`. Model-visible description says skipping does not count as a vote.
2. Wrap every tool handler with input validation and output validation against `MCP_TOOL_CONTRACTS` (`structuredContent` and JSON text). Invalid input returns an MCP tool error with `isError: true` and the zod issues.
3. MCP App per the design: register the UI resource with the ext-apps server helpers, the spec MIME type, CSP and size settings from the design; add `_meta.ui.resourceUri` to the tools the design lists; ship the view as a single self-contained HTML (inline JS/CSS/fonts or data URIs) under `server/mcp/views/app/` (no network fetches at render time). If the view needs bundling (ext-apps `App` client), add a script `server/mcp/views/app/build.ts`, run it in the temp copy, and commit its output as a generated TS string module (`reviewCardApp.generated.ts`) plus a vitest that fails when the output is stale. Do not change `package.json` scripts (session 26 owns it; record a request if a script is truly needed). The view uses the `App` client to read tool results and call `review_submit_vote`, `review_skip_card`, `review_add_synonym`, `review_get_next` via `callServerTool`; supports A/R/E/S keys, focus management, reduced motion, light/dark from host context mapped to brand tokens.
4. Keep `views/markdown.ts` text output for every tool; it must say the same thing as the card (asset, logic, scores, actions available).
5. Tests (vitest): `tools/list` returns 13 tools with the design's `_meta`; `resources/read` for the card returns the spec MIME type and HTML that loads nothing external (no `src=`/`href=`/`url(`/`fetch(` pointing at `http(s)://`; XML namespace strings are fine); every tool rejects invalid input; `review_skip_card` leaves votes untouched (mocked service); snapshot of the text fallback.
6. Run in `/tmp/gt-34/`: frozen install, `vitest run`, both `tsc -b`.

## Acceptance Criteria

- [ ] Every item in the design's session-34 acceptance list is met or listed as not met with the reason.
- [ ] 13 MCP tools; each validates input and output against `MCP_TOOL_CONTRACTS`.
- [ ] Card HTML is self-contained (test asserts no external origins).
- [ ] `vitest run` and both `tsc -b` pass in the temp copy.

## Owned Paths

- `ground-truth-app/server/mcp/**`

## Dependencies

- 25 (contracts), 26 (ext-apps package), 31 (design), 33 (services)
