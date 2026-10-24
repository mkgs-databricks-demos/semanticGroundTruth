# Session 25 (wave 4-0): Contracts + migration 009 (skips, user settings, steward triage)

* Date: 2026-10-24
* Job run: 1079028753739581 / 110489694161084, task `w4-0_session`
* Branch: `mg-genie-build-4`
* Mode: edit. Owned paths: `ground-truth-app/shared/contracts/**`, `ground-truth-app/server/migrations/**`
* Status: pass

## What changed

### Skip is no longer a vote
* `values.ts`: `VOTE_TYPES` is now `approve | reject | edit`. New `REVIEW_ACTIONS` (= votes + `skip`), `SKIP_REASONS`, `SKIP_COOLDOWN_HOURS_*` (default 24, 0-720).
* `VoteBodySchema` and MCP `review_submit_vote` reject `skip`. A skip goes through `SkipRequestSchema` (REST, `POST /api/review/skip`) or the new MCP tool `review_skip_card` (input shape in `McpToolShapes`; listed in `MCP_TOOL_NAMES_BUILD_4`, not in `MCP_TOOL_NAMES`, so the 12-tool registry test stays green until session 34 registers it).
* New types: `ReviewSkip`, `SkipStats`, `SkipResponse`; `skippedCount` / `skippedToday` on `UserStats` (alias `ReviewStats`), `skippedCount` on `LeaderboardEntry`, `totalSkips` / `lastSkipAt` on `UserActivity`.

### User settings
* `THEMES`, `DENSITIES`, `MOTION_PREFS`, `CARDS_PER_SESSION_*` (5-100, default 20); `UserSettings` type; `UpdateUserSettingsRequestSchema` (strict, partial, non-empty).

### Steward triage
* `FEEDBACK_BATCH_STATUSES` (`pending, proposed, in_review, merged, rejected, failed`), `FEEDBACK_BRANCH_REVIEW_STATUSES`, `CONFLICT_RESOLUTIONS`, `EDIT_FIELDS`.
* Types `FeedbackQueueItem`, `EditProposal`, `ConflictGroup`, `ConflictResolutionResult`, `FeedbackBranch`; `FeedbackBatch` gains `files`, `summary`, `reviewedBy`, `reviewedAt`.
* Request schemas: `FeedbackQueueQuerySchema`, `ConflictsQuerySchema`, `ResolveConflictRequestSchema` (`accept_edit` needs `voteId`), `FeedbackBranchListQuerySchema`, `UpsertFeedbackBranchRequestSchema` (branch must match `mg-genie-feedback-<yyyymmdd>[-suffix]`), `UpdateFeedbackBranchStatusRequestSchema`.
* `ScoringConfigSchema` (`config.ts`) + `skipCooldownHours` on `UpdateConfigBodySchema`.

### `Asset.synonyms`
Now required `AssetSynonym[]` (was optional `string[]`, which did not match what the API returns).

### `shared/contracts/schemas.ts` (new)
* zod schemas for every entity and response, with compile-time drift checks (`ContractTypeChecks`) that every schema's inferred type equals its TypeScript interface. Verified: changing one field in `AssetSchema` makes `tsc` fail.
* `ROUTE_CONTRACTS`: 50 routes = 41 registered today + 9 marked `plannedIn: 'session 33'`. Each has method, path, role, success status, error statuses, request/query/params/response schemas.
* `MCP_TOOL_CONTRACTS`: 13 tools = 12 deployed + `review_skip_card` (`plannedIn: 'session 34'`).
* `toJsonSchemas()` / `renderContractSchemas()`: JSON Schema draft 2020-12. Every schema lives once under `$defs`; routes and tools hold `{"$ref": "#/$defs/<name>"}`. Validate with `{...entry.response, "$defs": doc["$defs"]}`. Response objects are closed (`additionalProperties: false`) so contract tests catch extra fields. Request/query schemas describe the parsed input (query numbers are `integer`; clients send them as strings).
* `generate-schemas.ts`: prints the document to stdout (no `node:fs`, so it type-checks under the client tsconfig). Regenerate from `ground-truth-app/`: `pnpm exec tsx shared/contracts/generate-schemas.ts > shared/contracts/generated/contracts.schema.json`.
* `generated/contracts.schema.json` committed (62,501 bytes, one entry per line).

### Migration `009_skips_settings_triage`
* `app.review_skips` (reason/source CHECKs, FKs to assets/campaigns, 3 indexes), legacy `vote_type='skip'` rows moved there then removed from `app.votes` (none expected; the 001 CHECK already forbids them).
* `app.user_activity.total_skips`, `last_skip_at`.
* `app.user_settings` (CHECKs for theme, density, motion, default_asset_type, cards_per_session 5-100; `default_campaign_id` FK `ON DELETE SET NULL`).
* `app.feedback_batches.files/summary/reviewed_by/reviewed_at`; legacy statuses normalised (`completed`/`success`/... -> `proposed`, `error` -> `failed`, unknown -> `pending`) and then `feedback_batches_status_check` added behind a `pg_constraint` guard.
* `app.votes.resolution/resolved_by/resolved_at` (resolution CHECK).
* `app_config.skip_cooldown_hours = 24` (`ON CONFLICT DO NOTHING`).
* `REPLICA IDENTITY FULL` on both new tables.
* CHECK value lists are built from the contract constants, so SQL and TypeScript cannot drift.

## Decisions
* **50 routes, not 49.** The plan says "41 + 8 new = 49" but lists 9 new method+path pairs (`GET|PUT /api/me/settings` are two routes). Followed the explicit list; the test pins the 9 keys.
* `POST /api/steward/feedback-branches` is `admin` (the feedback job calls it as the app's service principal); the other steward routes are `steward`.
* Shared `$defs` instead of self-contained per-route schemas: 62 KB vs 91 KB, and Python can validate against named defs (`#/$defs/Asset`).
* Generated JSON was written through the workspace file tools (not `cp`), then checked byte-for-byte against generator output with `cmp`.

## Checks (all in `/tmp/gt-25`, a copy of `ground-truth-app` with the repo's owned files synced back in)
| Check | Result |
| --- | --- |
| `vitest run` (full suite) | 22 files, 370 tests pass (baseline 2 files / 23 tests for shared + migrations; now 3 files / 62) |
| `tsc -b tsconfig.server.json` | 9 errors, 0 in owned paths (all from `Asset.synonyms` / skip-stat fields; see requests) |
| `tsc -b tsconfig.client.json` | 3 errors, 0 in owned paths (`'skip'` used as a vote) |
| Migrations 001-009 on PGlite 0.5.11 (Postgres 17), 009 applied twice | Pass. Status normalisation, all new CHECKs reject bad values, `votes_vote_type_check` still rejects `skip`, `relreplident = 'f'` on both tables, config seeded |
| JSON Schema meta-validation (Python `jsonschema`, draft 2020-12) | 117 `$defs` valid, all `$ref`s resolve; sample Asset passes, extra field rejected |
| Staleness test negative | Editing the committed JSON makes `schemas.test.ts` fail |
| Route coverage negative | Adding a fake `app.get('/api/fake')` to a route file makes the coverage test fail |
| Drift-check negative | Making `AssetSchema.displayName` nullable makes `tsc` fail |

`tsc -b tsconfig.shared.json` fails before and after this session (server files pulled in through imports, e.g. TS2802 in `server/lib/shutdown.ts`); not caused by this session. It also emits `.js` next to sources because that config has no `noEmit`.

## Requests for other sessions (outside owned paths)
* `server/services/asset/mappers.ts:21`, `server/mcp/server.ts:40`: build `Asset.synonyms` as `AssetSynonym[]` (load from `app.asset_synonyms`; `[]` when none).
* `server/services/review/reviewEngine.ts:481,540,584`: return `skippedCount`/`skippedToday` in `UserStats` and `skippedCount` in `LeaderboardEntry` (count from `app.review_skips`).
* Test fixtures `server/mcp/views/cardHtml.test.ts:9`, `server/mcp/views/markdown.test.ts:16,76`, `server/services/review/validationQuery.test.ts:11`: add `synonyms: []` and the skip-stat fields.
* `client/src/components/review/CardStack.tsx:24,84`, `client/src/components/review/SwipeActions.tsx:49`: skip must call `POST /api/review/skip` (`SkipRequestSchema`), not `swipeVote('skip')`.
* `client/src/components/review/LogicView.tsx` (`asset.synonyms.join`): compiles but would render `[object Object]` now that synonyms are objects; map to `.synonym`.
* `tsconfig.shared.json`: add `noEmit: true` (or an `outDir`) so `tsc -b` stops writing `.js` beside sources.

## Files
Created: `shared/contracts/schemas.ts`, `shared/contracts/schemas.test.ts`, `shared/contracts/generate-schemas.ts`, `shared/contracts/generated/contracts.schema.json`, `server/migrations/009_skips_settings_triage.ts`.
Modified: `shared/contracts/{values,entities,config,review,api,mcp,index,api.test}.ts`, `server/migrations/{index,migrations.test}.ts`.
(All under `ground-truth-app/`.)
