# Session 25: Contracts + migration 009 (skips, user settings, steward triage)

**Build 4 · wave `4-0` · edit · app**

## Scope

Make `skip` a tracked non-vote, add per-user settings, and add the data fields the steward triage views need. Own the shared contracts (types **and** zod schemas for every REST and MCP payload) and Lakebase migration 009. No server routes or services here (session 33), no MCP tools (session 34).

## Context

* Owner decision (2026-10-24): **skip does not count as a vote**, but the number of skipped cards must be tracked.
* Today `shared/contracts/values.ts` L13 has `VOTE_TYPES = ['approve','reject','edit','skip']`, while `app.votes.vote_type` CHECK (migration 001 L67) allows only `approve|reject|edit`. A skip from the card UI (`CardStack.tsx` key `S`, `SwipeActions.tsx`) is sent as a vote and fails the CHECK (500). Found in build 3 session 23.
* `app.user_activity` (migration 005) is one row per user: `total_votes`, streaks, `last_vote_date`, `badges`.
* `app.feedback_batches` (migration 002) already has `branch_name`, `status` (free text, default `pending`), `asset_count`, `completed_at`.
* Migration 007 sets `REPLICA IDENTITY FULL` on every `app.*` table so Lakebase CDF replicates them to `lb_<table>_history`. New tables need the same.
* `Asset.synonyms` is optional in the contract and has no column (build 3 follow-up). Decide it here: always present (array, possibly empty), filled from `app.asset_synonyms`.
* Node toolchain: [docs/runbooks/node_toolchain_genie_code.md](../runbooks/node_toolchain_genie_code.md). Use it to run `vitest` and `tsc -b tsconfig.shared.json`/`tsconfig.server.json` before you finish. Do not change `package.json`.

## Tasks

1. **Values.** `VOTE_TYPES = ['approve','reject','edit']`. Add `REVIEW_ACTIONS = [...VOTE_TYPES, 'skip']` for UI/MCP input, `SKIP_REASONS = ['not_sure','not_my_area','need_context','other']`, `THEMES = ['system','light','dark']`, `DENSITIES = ['comfortable','compact']`, `MOTION_PREFS = ['system','reduce','full']`, `FEEDBACK_BATCH_STATUSES = ['pending','proposed','in_review','merged','rejected','failed']`, `CONFLICT_RESOLUTIONS = ['accept_edit','keep_current','reject_all']`.
2. **Entities / API types** (`entities.ts`, `api.ts`, `review.ts`, `config.ts`):
   * `ReviewSkip {id, assetId, campaignId|null, reason|null, versionHash|null, source:'web'|'mcp'|'agent', createdAt}`; `SkipRequest {assetId, campaignId?, reason?}`; `SkipResponse {skip: ReviewSkip, stats: {skippedCount, skippedToday}}`.
   * `ReviewStats` gains `skippedCount`, `skippedToday`; `LeaderboardEntry` gains `skippedCount` (shown, never ranked on).
   * `UserSettings {theme, density, motion, defaultCampaignId|null, defaultAssetType|null, showKeyboardHints, cardsPerSession (5-100), updatedAt}`; `UpdateUserSettingsRequest` = partial of the editable fields.
   * `ScoringConfig`/admin config gains `skipCooldownHours` (default 24, 0-720): a skipped asset is hidden from that user's queue for this long.
   * Steward triage: `FeedbackQueueItem {assetId, displayName, assetType, campaignId|null, votes:{approve,reject,edit}, skips, pendingEdits, lastActivityAt}`; `ConflictGroup {assetId, displayName, edits: EditProposal[], rejectCount, approveCount}` with `EditProposal {voteId, userId, field:'description'|'plain_english_logic'|'display_name', value, createdAt}`; `ResolveConflictRequest {resolution, voteId?, note?}`; `FeedbackBranch {batchId, branchName, status, assetCount, files: string[], summary|null, createdAt, completedAt|null, reviewedBy|null}`; `UpsertFeedbackBranchRequest {batchId?, branchName, files, summary?, status}`; `UpdateFeedbackBranchStatusRequest {status, note?}`.
   * `Asset.synonyms: AssetSynonym[]` (required).
3. **zod schemas** in new `shared/contracts/schemas.ts`: one schema per request body, query string, path param set and response body above **and every existing** route in `server/routes/*.ts` and MCP tool in `server/mcp/tools/*.ts` (inputs and the JSON in `structuredContent`/text). Export `ROUTE_CONTRACTS`: an array of `{method, path, role, request?, query?, params?, response, errors: number[]}` covering every route (41 today across `server/routes/*.ts`, including `GET /health` and `GET /api/config`, + 8 new in session 33: `POST /api/review/skip`, `GET|PUT /api/me/settings`, `GET /api/steward/feedback-queue`, `GET /api/steward/conflicts`, `POST /api/steward/conflicts/:assetId/resolve`, `GET /api/steward/feedback-branches`, `POST /api/steward/feedback-branches`, `POST /api/steward/feedback-branches/:batchId/status`), and `MCP_TOOL_CONTRACTS` for all 12 tools + `review_skip_card`. Export `toJsonSchemas()` using zod v4 `z.toJSONSchema` so tests and the Python contract job share one source.
4. **Generated JSON Schema:** add `shared/contracts/generate-schemas.ts` and commit its output `shared/contracts/generated/contracts.schema.json`. Generate it in your `/tmp/gt-25/` copy (runbook Node, `pnpm install --frozen-lockfile`, then `node --experimental-strip-types` or `pnpm exec vite-node` if available) and copy only the generated file back into the repo. Add a vitest that fails if the committed file is stale.
5. **Migration `009_skips_settings_triage.ts`** (register in `server/migrations/index.ts`):
   * `app.review_skips (id UUID PK DEFAULT gen_random_uuid(), user_id TEXT NOT NULL, asset_id UUID NOT NULL REFERENCES app.assets(id), campaign_id UUID REFERENCES app.campaigns(id), reason TEXT CHECK (reason IN (...SKIP_REASONS)), version_hash TEXT, source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','mcp','agent')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; indexes `(user_id, created_at DESC)`, `(asset_id)`, `(campaign_id)`.
   * `ALTER TABLE app.user_activity ADD COLUMN IF NOT EXISTS total_skips INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS last_skip_at TIMESTAMPTZ`.
   * `app.user_settings (user_id TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'system' CHECK ..., density TEXT NOT NULL DEFAULT 'comfortable' CHECK ..., motion TEXT NOT NULL DEFAULT 'system' CHECK ..., default_campaign_id UUID REFERENCES app.campaigns(id) ON DELETE SET NULL, default_asset_type TEXT, show_keyboard_hints BOOLEAN NOT NULL DEFAULT TRUE, cards_per_session INTEGER NOT NULL DEFAULT 20 CHECK (cards_per_session BETWEEN 5 AND 100), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`.
   * `app.feedback_batches`: add `files JSONB NOT NULL DEFAULT '[]'`, `summary TEXT`, `reviewed_by TEXT`, `reviewed_at TIMESTAMPTZ`; normalise existing `status` values to `FEEDBACK_BATCH_STATUSES` and add the CHECK.
   * `app.votes`: add `resolution TEXT CHECK (resolution IN (...CONFLICT_RESOLUTIONS))`, `resolved_by TEXT`, `resolved_at TIMESTAMPTZ` (steward conflict resolution).
   * `INSERT INTO app.app_config (key, value) VALUES ('skip_cooldown_hours','24') ON CONFLICT DO NOTHING`.
   * `REPLICA IDENTITY FULL` on `app.review_skips` and `app.user_settings`.
   * The vote_type CHECK stays `approve|reject|edit`. If any row has `vote_type='skip'` (none expected), move it into `review_skips` first, then delete it from `votes`.
6. Extend `server/migrations/migrations.test.ts` and `shared/contracts/api.test.ts` for the new objects. Fix every compile error the `VOTE_TYPES` change causes **inside your owned paths**; for errors elsewhere (server services, client), record a `request` naming the file and line. Session 33 fixes server and client call sites.

## Acceptance Criteria

- [ ] `'skip'` is not in `VOTE_TYPES`; `REVIEW_ACTIONS` contains it.
- [ ] `schemas.ts` has a schema for every route in `ROUTE_CONTRACTS` (49) and every tool in `MCP_TOOL_CONTRACTS` (13); a vitest asserts the counts and that every `server/routes/*.ts` registration appears in `ROUTE_CONTRACTS` (parse the route files' `app.<method>('<path>'` calls).
- [ ] `generated/contracts.schema.json` is committed and the staleness test passes.
- [ ] Migration 009 is idempotent (every statement `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`), registered, and covered by `migrations.test.ts`.
- [ ] `pnpm exec vitest run shared server/migrations` passes; `tsc -b tsconfig.shared.json` passes.

## Owned Paths

- `ground-truth-app/shared/contracts/**`
- `ground-truth-app/server/migrations/**`

## Dependencies

- None (wave `4-0`). Sessions 33, 34 and 35 build on these contracts; sessions 28 and 29 rely on the table and column names above.
