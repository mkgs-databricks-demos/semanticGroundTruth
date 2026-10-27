# Session 34 (wave 4-2): MCP review_skip_card + interactive review card as an MCP App

Run: 110489694161084 · Branch: mg-genie-build-4 · Mode: edit · Owned: `ground-truth-app/server/mcp/**`

## Scope
Implement `docs/design/L300-17_mcp_app_review_card.md`: `review_skip_card`, input/output validation for all 13 tools, a self-contained MCP App review card (ext-apps 1.7.5) with a text fallback, and vitest coverage.

## Changes
* `tools/define.ts` (new): `registerContractTool` registers every tool from `MCP_TOOL_CONTRACTS`. The contract's zod input is the tool's `inputSchema` (the SDK rejects bad args with an `isError` result). Handler output is checked against `contract.output` (plus an optional `extraOutput`) before it is returned as `structuredContent`; a mismatch returns `Error [INTERNAL]` and is logged. UI tools go through `registerAppTool` with `_meta.ui.resourceUri = ui://ground-truth/review-card`.
* `tools/review.ts`: all 7 review tools use `registerContractTool`. New `review_skip_card` calls `ReviewEngine.skip(..., 'mcp')`. `asset_id`/`campaign_id` default to the MCP session's current asset. It returns `SkipResponse` plus `next` (the next card). `review_get_next`, `review_submit_vote`, `review_skip_card` and `review_get_stats` declare the card UI.
* `tools/campaign.ts`, `tools/metricView.ts`: moved onto `registerContractTool`; handler logic unchanged.
* `server.ts`: the card resource is registered with `registerAppResource` (`RESOURCE_MIME_TYPE` = `text/html;profile=mcp-app`, `prefersBorder: true`, no connect/resource domains).
* `views/markdown.ts`: `EMPTY_QUEUE_TEXT`, `renderVoteMarkdown`, `renderSkipMarkdown` and `SkipCardResult` for the text fallback.
* `views/app/*` (new): a DOM-only `ReviewCardView` (approve/reject/edit/skip, keyboard shortcuts A/R/E/S, skip reason, synonyms, stats, narrow layout, no innerHTML, no fetch). Also `main.ts` (ext-apps `App` wiring and host theme/fonts), `template.ts` (brand CSS, light/dark, reduced motion) and `build.ts`, a Vite IIFE bundle that writes `reviewCardApp.generated.ts`. The HTML size budget is enforced at 100 KB gzip / 400 KB raw.
* Tests: `server.test.ts`, `testFixtures.ts`, `views/app/{view,main,build}.test.ts` (new); `toolNames.test.ts` (13 tools); `views/markdown.test.ts`.

## Decisions
* `cardHtml.ts` is kept unchanged as the static, non-interactive fallback.
* The generated HTML is committed. `build.test.ts` fails if it is stale, and the regeneration command is `pnpm exec tsx server/mcp/views/app/build.ts`.
* `package.json` was not changed (session 26 owns it). No new dependencies.

## Checks (temp copy, Node 22.16.0, pnpm 11.0.8)
* `tsc -b tsconfig.server.json`: pass. `tsc -b tsconfig.client.json`: pass.
* `vitest run`: 32 files, 599 tests passed. The baseline was 28 files, 528 tests. `server/mcp` alone: 7 files, 104 tests.
* `eslint server/mcp`: pass.
* Independent check over an in-memory MCP client:
  * `tools/list` returns 13 tools, including `review_skip_card`.
  * 4 tools carry `_meta.ui.resourceUri`.
  * The resource MIME type is `text/html;profile=mcp-app`, and the card has no external `src`/`href`.
  * An invalid `asset_id` returns `isError` with the zod message.
* `prettier --check`: reports issues in 21 files under `server/mcp`, including pre-existing files this session did not touch (e.g. `cardHtml.ts`). The repo is not prettier-clean and this is not an acceptance criterion, so it is recorded as skipped.

## Requests
None.
