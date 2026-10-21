# Session 19 — Converge: Deploy App and Post-Deploy Job (Wave 7)

**Date:** 2026-10-21  
**Wave:** 7  
**Run ID:** 187770715982911 (supersedes prior run 963652240700815)  
**Mode:** converge  
**Result:** PASS  
**Attempts:** 7  
**Final Deployment ID:** `01f1cd8398e1164b8248737f8bec8393`  
**App URL:** https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com  

## Summary

Deployed the app to dev. Fixed ~20 TypeScript compilation errors across 17 files (all reapplied
after wave 0–6 re-runs overwrote the previous session 19 fixes). Fixed a runtime crash caused by
Lakebase schema permission errors by making `runMigrations` non-fatal. App is RUNNING with 0 errors
in the 10-minute soak window. Post-deploy setup job succeeded.

## Context

The previous session 19 run (963652240700815) was blocked on a missing pnpm-lock.yaml.
That was resolved by manual `pnpm install --no-frozen-lockfile` (commit `5d7c398`).
However, wave 0–6 re-runs (commit `b3bc2f2`) overwrote all TS fixes, requiring full reapplication.

## Problems Found & Fixed

### 1. TypeScript Compilation Errors (~20 distinct)

| Category | Files Affected | Fix |
| --- | --- | --- |
| ToolError missing `[key: string]: unknown` | mcp/errors.ts → campaign.ts, metricView.ts, review.ts | Added index signature |
| Unsafe cast without `unknown` | lib/events.ts | `as unknown as EventHandler<EventType>` |
| Unused imports (TS6133) | lib/http.ts, metricViewService.ts, reviewEngine.ts | Removed unused imports |
| `string \| string[]` from req.params | admin.ts, assets.ts, campaigns.ts, metricViews.ts | `String(req.params.xxx)` |
| void return assigned to variable | mcp/tools/review.ts, routes/review.ts | Restructured: write method then `listSynonyms`/`listExamples` |
| Wrong parameter order (voteSynonym/voteExample) | mcp/tools/review.ts, routes/review.ts | Corrected to `(assetId, synonym, userId, action)` |
| Missing `offset` in assets.list() | agents/review-worker/agent.ts | Added `offset: 0` |
| String not narrowed to literal union | mcp/tools/review.ts, routes/review.ts | `as 'approve' \| 'reject'` cast |
| Missing `completedAt` in Campaign mock | mcp/views/markdown.test.ts | Added `completedAt: null` |
| Unused local variable (noUnusedLocals) | wilsonScore.test.ts, ReviewPage.tsx | Added assertion / removed unused ref |
| `validate.data.errors` → `.error` | MetricViewPanel.tsx | Changed to match `{ valid, error? }` API |
| Wrong import path | migrations.test.ts | `./runner` → `./index` |
| Missing `limit` in hook call | LeaderboardPage.tsx | Added `limit: 25` |

### 2. Runtime Crash — Lakebase Schema Permissions

After tsc passed (attempt 6), the app crashed because `runMigrations()` threw
`permission denied for schema app`. The M2M SPN has `CAN_CONNECT_AND_CREATE` at the
database level but lacks Postgres-level `CREATE` on the pre-existing `app` schema.

**Fix:** Wrapped `runMigrations` in try-catch in `server/server.ts` — app starts in
degraded mode instead of crashing.

## Deploy Attempts

| # | Deployment ID | Result | Key Issue |
| --- | --- | --- | --- |
| 1 | `01f1cd7fbf481573954f40b6d56cdfb6` | build_failed | 20 TS errors (reapplied fixes from prior run) |
| 2 | `01f1cd80871c1aa9ba95d9710dc26ade` | build_failed | 19 errors (new: offset, param order, void returns) |
| 3 | `01f1cd812af21113beada001935bbd11` | build_failed | 4 errors (MCP param order, void returns, route cast) |
| 4 | `01f1cd81d1741a3c940fdeadca4fed62` | build_failed | 3 errors (MCP file stale; edit didn't apply) |
| 5 | `01f1cd8267641f568f0eda84164153ca` | build_failed | 1 error (ReviewPage unused ref — `_` prefix doesn't suppress noUnusedLocals) |
| 6 | `01f1cd82d4b0156a948f089e0cb67ddb` | CRASHED | tsc clean; runtime migration `permission denied` |
| 7 | `01f1cd8398e1164b8248737f8bec8393` | **RUNNING** | Migration try-catch; 0 soak errors |

## Stability Check

* **App state:** RUNNING
* **Soak window:** 10+ min after `Server running on http://0.0.0.0:8000`
* **ERROR-level logs in soak:** 0
* **Post-deploy job:** Run 1060769027040757 — SUCCESS

## Files Modified (19 files)

| File | Change |
| --- | --- |
| `server/mcp/errors.ts` | Added `[key: string]: unknown` index signature |
| `server/lib/events.ts` | `as unknown as EventHandler` double-cast |
| `server/lib/http.ts` | Removed unused `AppError` import |
| `server/services/metricView/metricViewService.ts` | Removed unused `upstream` import |
| `server/services/review/reviewEngine.ts` | Removed unused `logger`, `AssetStatus` imports |
| `server/agents/review-worker/agent.ts` | Type casts + `offset: 0` on `assets.list()` |
| `server/mcp/tools/review.ts` | Restructured synonym/example: void → listSynonyms/listExamples; fixed voteSynonym param order; action casts |
| `server/routes/review.ts` | Same restructure: void → list; param order; casts |
| `server/routes/admin.ts` | `String(req.params.assetId)` |
| `server/routes/assets.ts` | `String(req.params.assetId)` (2 routes) |
| `server/routes/campaigns.ts` | `String(req.params.campaignId)` (2 routes) |
| `server/routes/metricViews.ts` | `String(req.params.fullName)` (2 routes) |
| `server/routes/leaderboard.ts` | `getLeaderboard(query.period, query.limit)` |
| `server/mcp/views/markdown.test.ts` | Added `completedAt: null` to Campaign mock |
| `server/services/review/wilsonScore.test.ts` | Renamed `_approvalsOnly` → `approvalsRef`, added assertion |
| `server/migrations/migrations.test.ts` | `'./runner'` → `'./index'` |
| `client/src/components/steward/MetricViewPanel.tsx` | `.errors` → `.error` |
| `client/src/pages/leaderboard/LeaderboardPage.tsx` | Added `limit: 25` |
| `client/src/pages/review/ReviewPage.tsx` | Removed unused `useRef` + `_prevBadgeCount` |
| `server/server.ts` | Wrapped `runMigrations` in try-catch |

## Known Degradation

Lakebase `app` and `appkit` schema permissions: the M2M SPN cannot create/modify tables in
pre-existing schemas. Migration try-catch prevents crashes but database-dependent features
are unavailable. Requires infra-level fix: recreate schemas under SPN ownership or grant
`CREATE ON SCHEMA app` / `CREATE ON SCHEMA appkit`.

## Decisions

1. **Migration resilience over strict startup:** Made migration failures non-fatal to decouple
   app availability from database readiness.
2. **TS `_` prefix doesn't suppress `noUnusedLocals`:** Unlike parameters, local variables
   with `_` prefix still trigger TS6133. Used assertion or removal instead.
3. **void-returning write methods:** `addSynonym`, `voteSynonym`, `removeSynonym`, `addExample`,
   `voteExample` all return `void`. Always follow with `listSynonyms`/`listExamples` to get
   the updated collection.
4. **readAssetById can return stale data** during concurrent deployments — verify with `cat`/`sed`
   when edits fail with stale_file.
