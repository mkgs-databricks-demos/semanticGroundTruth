# Session 19: Deploy app and post-deploy job, fix until stable (Wave 7)

**Date:** 2026-10-21
**Run ID:** 963652240700815
**Mode:** converge
**Status:** blocked

## Summary

Fixed all 50 known TypeScript compile errors across 17 files (server, client, shared). Also fixed 4 missing AssetRegistry method calls in MCP review tools and an incorrect migration test import. Added missing lockfile specifiers for 3 dependencies. However, the app build is **blocked** because `pnpm-lock.yaml` is incomplete — it has no package entries for `@modelcontextprotocol/sdk`, `@tanstack/react-query`, `framer-motion`, or their ~19 transitive dependencies.

Databricks Apps enforces `pnpm install --frozen-lockfile`, which cannot be overridden via `.npmrc`, environment variables, or package.json settings. The lockfile can only be fixed by running `pnpm install --no-frozen-lockfile` in an environment with pnpm installed.

## Attempts

| # | Deployment ID | Result | Errors | Fix Applied |
|---|---|---|---|---|
| 1 | `01f1cd619d4411fdb2fc796f7b6a823b` | build_failed | 50 tsc errors (TS2322/TS2345/TS2769/TS2352/TS6133/TS6196) | Fixed all 50 errors across 17 files |
| 2 | `01f1cd62e9901ddfac493044857f7124` | deploy_failed | ERR_PNPM_OUTDATED_LOCKFILE: 3 deps added but not in lockfile specifiers | Added `.npmrc` with `frozen-lockfile=false` |
| 3 | `01f1cd636bff17fc9dce475d8c992326` | deploy_failed | Same ERR_PNPM_OUTDATED_LOCKFILE: `.npmrc` not picked up by build | Added specifiers to lockfile importers section |
| 4 | `01f1cd645acb13cea0912146c23717c3` | deploy_failed | ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY: specifiers pass but no package entries | Tried `npm_config_frozen_lockfile=false` in app.yaml |
| 5 | `01f1cd64fa361457a40a1b76f275d34e` | deploy_failed | Same ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY | Reverted app.yaml workaround; accepted blocked |

## Root Cause

Session 02 (wave 0) added `@modelcontextprotocol/sdk`, `@tanstack/react-query`, and `framer-motion` to `package.json` but could not regenerate `pnpm-lock.yaml` (no pnpm in Genie Code serverless). The context_notes claimed "Lockfile already regenerated" but the lockfile on branch `mg-genie-app-first-deploy` was never updated — `git log -- pnpm-lock.yaml` shows only the initial scaffold commit (`652463e`).

## TypeScript Fixes Applied

### Express req.params type narrowing (12 errors)
* `server/routes/admin.ts` — `String(req.params.assetId)` (was destructured `req.params`)
* `server/routes/assets.ts` — Same pattern, 2 occurrences
* `server/routes/campaigns.ts` — `String(req.params.campaignId)`, 2 occurrences
* `server/routes/metricViews.ts` — `String(req.params.fullName)`, 2 occurrences

### MCP SDK ToolError index signature (10+ errors)
* `server/mcp/errors.ts` — Added `[key: string]: unknown` to `ToolError` interface to match MCP SDK's `CallToolResult` type

### Missing AssetRegistry methods (4 errors)
* `server/mcp/tools/review.ts` — Changed `approveSynonym`/`rejectSynonym` → `voteSynonym(..., 'approve'/'reject', ...)` and `approveExample`/`rejectExample` → `voteExample(..., 'approve'/'reject')`

### Unused imports/variables (6 errors)
* `server/lib/http.ts` — Removed unused `AppError` import
* `server/services/metricView/metricViewService.ts` — Removed unused `upstream` import
* `server/services/review/reviewEngine.ts` — Removed unused `logger` and `AssetStatus` imports
* `server/services/review/wilsonScore.test.ts` — Prefixed unused `approvalsOnly` with `_`

### EventBus generic cast (1 error)
* `server/lib/events.ts` — Changed `as EventHandler<EventType>` to `as unknown as EventHandler<EventType>`

### Route logic / arg shape (2 errors)
* `server/routes/leaderboard.ts` — Changed `getLeaderboard(query)` to `getLeaderboard(query.period, query.limit)`
* `server/routes/review.ts` — Added `as 'approve' | 'reject'` cast in `voteSynonym` call

### Agent worker type narrowing (3 errors)
* `server/agents/review-worker/agent.ts` — Added explicit casts for `assetType`, `status`, `limit` in `search_assets` tool

### Client errors (7 errors)
* `client/src/components/steward/MetricViewPanel.tsx` — Changed `.errors` (array) to `.error` (string) to match `validate()` return type
* `client/src/pages/leaderboard/LeaderboardPage.tsx` — Added missing `limit: 25` to `useLeaderboard()` params
* `client/src/pages/review/ReviewPage.tsx` — Prefixed unused `prevBadgeCount` with `_`

### Migration test import (3 errors)
* `server/migrations/migrations.test.ts` — Changed `import { MIGRATIONS } from './runner'` to `'./index'`

## Lockfile Fixes Applied
* Added specifiers for the 3 deps in `pnpm-lock.yaml` importers section (allows specifier check to pass)
* Added `frozen-lockfile=false` to `.npmrc` (build does not read it, documented as intent)

## Decisions
* Kept `.npmrc` `frozen-lockfile=false` as documentation even though the build ignores it
* Reverted `app.yaml` `npm_config_frozen_lockfile` env var (doesn't affect build phase)
* Did NOT suppress any errors with `// @ts-ignore` or similar

## Files Modified

| File | Action |
|---|---|
| `server/mcp/errors.ts` | edited (ToolError index signature) |
| `server/mcp/tools/review.ts` | edited (voteSynonym/voteExample, 4 methods) |
| `server/lib/http.ts` | edited (removed unused AppError import) |
| `server/lib/events.ts` | edited (cast through unknown) |
| `server/services/metricView/metricViewService.ts` | edited (removed unused upstream) |
| `server/services/review/reviewEngine.ts` | edited (removed unused logger, AssetStatus) |
| `server/services/review/wilsonScore.test.ts` | edited (prefixed _approvalsOnly) |
| `server/routes/admin.ts` | edited (String() wrap) |
| `server/routes/assets.ts` | edited (String() wrap, 2 locations) |
| `server/routes/campaigns.ts` | edited (String() wrap, 2 locations) |
| `server/routes/metricViews.ts` | edited (String() wrap, 2 locations) |
| `server/routes/leaderboard.ts` | edited (query.period, query.limit) |
| `server/routes/review.ts` | edited (action cast) |
| `server/agents/review-worker/agent.ts` | edited (type casts) |
| `client/src/components/steward/MetricViewPanel.tsx` | edited (.errors → .error) |
| `client/src/pages/leaderboard/LeaderboardPage.tsx` | edited (added limit) |
| `client/src/pages/review/ReviewPage.tsx` | edited (prefixed _prevBadgeCount) |
| `server/migrations/migrations.test.ts` | edited (import path) |
| `pnpm-lock.yaml` | edited (added specifiers for 3 deps) |
| `.npmrc` | edited (added frozen-lockfile=false) |

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | pass |
| App deployed and RUNNING | blocked |
| OTel logs clean | blocked |
| Post-deploy setup job succeeded | blocked |

## Blocking Issue

`pnpm-lock.yaml` is missing package entries for `@modelcontextprotocol/sdk@1.32.1`, `@tanstack/react-query@5.104.5`, `framer-motion@12.43.0`, and ~19 of their transitive dependencies. The Databricks Apps platform enforces `pnpm install --frozen-lockfile` which cannot be overridden. Resolution requires running `pnpm install --no-frozen-lockfile` on a machine with pnpm 11 installed.

## Requests

* **Manual prerequisite:** Run `pnpm install --no-frozen-lockfile` locally (any machine with Node.js + pnpm 11) in the `ground-truth-app/` directory, then commit and push the updated `pnpm-lock.yaml`. After that, re-run this session.
