# Session 33 (wave 4-1): Server skip endpoint, user settings, steward triage APIs (G6 backend)

* Date: 2026-10-24
* Run: job 1079028753739581 / run 110489694161084 / task w4-1_session
* Branch: mg-genie-build-4 (read-only git; nothing committed)
* Mode: edit

## Problems / root causes

* Skip was modelled as a vote type in the client (`CardStack.tsx`, `SwipeActions.tsx`), which session 25 removed from `VOTE_TYPES`; skips must never touch votes, scores, streaks or badges.
* Session 25 added `Asset.synonyms` and `UserStats.skippedCount/skippedToday` / `LeaderboardEntry.skippedCount`, which broke the server typecheck until the asset mappers and review engine populated them.
* Routes parsed bodies ad hoc; the plan requires every route to validate against `ROUTE_CONTRACTS` zod schemas.

## Changes

* `server/lib/validate.ts` (new): `validate(spec)` middleware (params, query, body -> 400 VALIDATION), `validated(res, spec)` accessor, introspectable `.validation` for the contract test. Applied to every route in `server/routes/*.ts`.
* `server/middleware/roles.ts`: `requireRoleMiddleware` exposes `requiredRole` for contract introspection.
* `server/lib/config.ts`: `skipCooldownHours` (default 24) in `AppSettings`, exposed through GET/PUT `/api/admin/config`.
* `server/services/asset/{mappers,assetRegistry}.ts`: assets carry `synonyms` (batched `ANY($1::uuid[])` lookup in `list()`).
* `server/services/review/reviewEngine.ts`: `skip()` inserts `app.review_skips` and bumps `user_activity.total_skips/last_skip_at` only; `getNextWithMeta()` excludes skips inside the cooldown and resurfaces the oldest-skipped asset (`resurfacedFromSkip`) when everything is in cooldown; skip stats in `getUserStats()` and per-period skip counts in `getLeaderboard()`.
* `server/services/settings/` (new): `UserSettingsService` get (migration defaults when no row) / partial upsert on `app.user_settings`; validates `defaultCampaignId`.
* `server/services/steward/` (new): `StewardService` feedback queue, conflict detection (`detectConflicts`), conflict resolution (per-vote resolution, optimistic 409, author notifications), feedback branch list / upsert (steward notifications, `feedback.failed`) / status transitions.
* `server/services/index.ts`: wires `settings` and `steward` services.
* Routes: `POST /api/review/skip`; `POST /api/review/vote` rejects `voteType:'skip'` with 400; `GET/PUT /api/me/settings`; `GET /api/steward/feedback-queue`, `GET /api/steward/conflicts`, `POST /api/steward/conflicts/:assetId/resolve`, `GET|POST /api/steward/feedback-branches`, `POST /api/steward/feedback-branches/:batchId/status` (new `server/routes/steward.ts`, registered in `routes/index.ts`). `GET /api/review/next` sets a resurfaced header.
* Client: `api.review.skip`, `api.me.getSettings/updateSettings`, `api.steward.*` in `client/src/lib/api/{endpoints,hooks,keys}.ts`; `CardStack.tsx` / `SwipeActions.tsx` call the skip endpoint instead of voting.
* Tests (vitest, mocked pg): `server/lib/testing/routeHarness.ts`, `server/routes/contracts.test.ts`, `server/routes/skipSettingsSteward.test.ts`, `server/services/review/skip.test.ts`, `server/services/settings/userSettingsService.test.ts`, `server/services/steward/stewardService.test.ts`; small fixture update in `server/services/review/validationQuery.test.ts`.

## Checks (run in /tmp/gt-33, copy of ground-truth-app)

* `pnpm install --frozen-lockfile`: pass
* `pnpm exec vitest run`: pass, 28 files / 528 tests
* `pnpm exec tsc -b tsconfig.client.json`: pass (CardStack/SwipeActions baseline errors cleared)
* `pnpm exec tsc -b tsconfig.server.json`: pass on rerun after the planner fixes (see below). First run: fail, 4 errors, all in excluded `server/mcp/**` (owned paths were clean):
  * `server/mcp/server.ts(40,13)` TS2741 `synonyms` missing on Asset literal
  * `server/mcp/views/cardHtml.test.ts(9,3)` TS2741 `synonyms` missing
  * `server/mcp/views/markdown.test.ts(16,3)` TS2741 `synonyms` missing
  * `server/mcp/views/markdown.test.ts(76,7)` TS2739 `skippedCount`, `skippedToday` missing on UserStats

### Rerun after planner fixes

The planner applied both requests below in the working tree (`server/mcp/server.ts`, `server/mcp/views/cardHtml.test.ts`, `server/mcp/views/markdown.test.ts`, `shared/contracts/schemas.ts`, `shared/contracts/schemas.test.ts`, `shared/contracts/generated/contracts.schema.json`) and adjusted `server/routes/contracts.test.ts`. I re-copied the app to /tmp/gt-33 (checked that each file matches the workspace copy, cleared tsbuildinfo) and ran everything again:

* `pnpm install --frozen-lockfile`: pass
* `pnpm exec tsc -b tsconfig.server.json`: pass (exit 0)
* `pnpm exec tsc -b tsconfig.client.json`: pass (exit 0)
* `pnpm exec vitest run`: pass, 28 files / 528 tests
* No `plannedIn: SESSION_33` markers remain in `shared/contracts/schemas.ts`.

Final status: pass. Requests and blocking cleared.

## Requests for other sessions (resolved by the planner)

* `server/mcp/server.ts`, `server/mcp/views/cardHtml.test.ts`, `server/mcp/views/markdown.test.ts` (session 34 / MCP owner): add `synonyms: []` to the Asset literals and `skippedCount: 0, skippedToday: 0` to the UserStats fixture. Caused by session 25 type changes.
* `shared/contracts/schemas.ts` + `shared/contracts/schemas.test.ts` (integrator / contracts owner): the 9 session-33 routes are now registered; drop their `plannedIn: SESSION_33` markers and update the non-planned count from 41 to 50.

## Decisions

* `POST /api/steward/feedback-branches` requires `admin` (feedback job M2M identity), as in `ROUTE_CONTRACTS`; the other steward routes require `steward`.
* A `cooldown` of 0 disables skip filtering and resurfacing.
* `server/routes/health.ts` got only the shared `validate()` wiring (empty spec), no behavior change.
