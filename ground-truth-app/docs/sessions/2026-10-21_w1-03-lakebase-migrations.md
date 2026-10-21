# Session 03: Lakebase Migrations

**Wave:** 1 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `server/migrations/` with 9 files: `types.ts`, `runner.ts`, 6 migration files (001–006), and `index.ts`. All tables in schema `app`, all CREATE uses IF NOT EXISTS, no DROP statements. Migrations 001–006 cover the full data model: core asset registry, confidence scores, campaigns, notifications, app config/user activity, and indexes. Fixed a circular import between runner.ts and index.ts by having `runMigrationsWithList` accept migrations as a parameter, with `index.ts` wrapping it.

## Files Created

| File | Exports |
|---|---|
| `server/migrations/types.ts` | `Migration` (interface: id, description, sql) |
| `server/migrations/runner.ts` | `runMigrationsWithList(db, migrations)` |
| `server/migrations/index.ts` | `MIGRATIONS`, `runMigrations(db)`, re-exports `Migration` |
| `server/migrations/001_core_schema.ts` | `migration` — assets, asset_versions, asset_synonyms, synonym_votes, votes, example_questions, example_question_votes |
| `server/migrations/002_scoring_feedback.ts` | `migration` — confidence_scores, feedback_batches |
| `server/migrations/003_campaigns.ts` | `migration` — campaigns, campaign_assignments, campaign_assets, votes FK |
| `server/migrations/004_notifications.ts` | `migration` — notifications, notification_preferences |
| `server/migrations/005_app_state.ts` | `migration` — app_config (seeded), user_activity, mcp_sessions |
| `server/migrations/006_indexes.ts` | `migration` — 13 indexes including partial indexes |

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| 6 migration files + runner.ts + types.ts + index.ts exist | pass |
| Every CREATE uses IF NOT EXISTS | pass |
| Every table is app.*-qualified | pass |
| No DROP statements | pass |
| runMigrations signature matches plan | pass |
| MIGRATIONS lists 6 ids in order | pass |
| Column names match L200-C1/C5/C7 + conventions §5 | pass (static) |
| TypeScript compilation | skipped (no Node toolchain) |

## Decisions

* Used `id` as PK column for all tables (not `asset_id`/`vote_id`) — mappers in session 05 handle the mapping.
* Fixed circular import: `runner.ts` exports `runMigrationsWithList(db, migrations)`, `index.ts` wraps it as `runMigrations(db)`.
* `synonym_votes` uses composite PK `(synonym_id, user_id)` — maps to `AssetSynonym.approvals`/`rejections` via JOIN in session 05's `listSynonyms`.
* `votes.campaign_id` FK constraint added in migration 003 with `DO $$ IF NOT EXISTS` guard.

## Race Condition Note

Due to the known `genie_task` for_each `{{input.session_id}}` platform bug, all 3 wave-1 iteration runs received unresolved session_id. Multiple sessions claimed session 03 via file-based locking (`.build-status/842455926421383/claim_03`). This caused concurrent writes to `server/migrations/` files.

Fixes applied by this session:
* `006_indexes.ts`: corrected `idx_assets_confidence` from `app.confidence_scores(confidence)` to `app.assets(confidence_score)` (L200-C1 places this index on the assets table).
* `006_indexes.ts`: corrected `idx_votes_unprocessed` from `app.votes(asset_id) WHERE is_processed = FALSE` to `app.votes(processed) WHERE processed = FALSE` (column is `processed`, not `is_processed`).

The integrator should verify the final disk state of `runner.ts` and `index.ts` for consistency. Two valid architectures exist in the file history; either works as long as both files are consistent.

## Requests

None.
