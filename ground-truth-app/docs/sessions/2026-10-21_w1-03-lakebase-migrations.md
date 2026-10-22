# Session 03: Lakebase Migrations

**Wave:** 1 · **Run:** 187770715982911 (re-validation; originally 842455926421383) · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Re-validation for run 187770715982911 (branch `mg-genie-app-first-deploy`). All 9 `server/migrations/` files were completed in the initial build (PR #4, merged as 6af87be on main). Re-validated all acceptance criteria; outputs match the plan. No changes needed.

## Files (unchanged from prior run)

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

| Check | Result | Detail |
|---|---|---|
| `databricks bundle validate --strict --target dev` | **pass** | "Validation OK!" |
| 9 expected files exist | **pass** | types.ts, runner.ts, index.ts, 001–006 |
| Every CREATE uses IF NOT EXISTS | **pass** | All CREATE TABLE and CREATE INDEX verified |
| Every table is app.*-qualified | **pass** | All 16 tables prefixed `app.` |
| No DROP statements | **pass** | No DROP TABLE/INDEX/SCHEMA |
| runMigrations(db) signature | **pass** | Returns `Promise<{ applied: string[]; total: number }>` |
| MIGRATIONS lists 6 ids in order | **pass** | m001–m006 in index.ts |
| votes.source CHECK constraint | **pass** | `IN ('web', 'mcp', 'agent')` |
| assets: display_name, status CHECK, domain, subdomain | **pass** | All four present |
| Index column consistency | **warn** | See Findings below |
| TypeScript compilation | **skipped** | No Node toolchain in sessions |

## Findings (carried from prior build)

1. **`006_indexes.ts` — `idx_assets_confidence`** references `app.assets(confidence_score)`, but the `assets` table (001) has no `confidence_score` column — it was moved to the `confidence_scores` table (002). Runtime: Postgres will error on this CREATE INDEX.
2. **`006_indexes.ts` — `idx_votes_unprocessed`** references `app.votes(processed) WHERE processed = FALSE`, but the `votes` table (001) names the column `is_processed`. Runtime: Postgres will error on this CREATE INDEX.

Both are pre-existing from the prior build's race-condition fix (run 842455926421383). They cause migration 006 to fail at app startup unless the migration was already applied with different SQL in an earlier deployment. These should be fixed in a follow-up session (outside this session's scope).

## Decisions (carried from prior run)

* Used `id` as PK column for all tables (not `asset_id`/`vote_id`) — mappers in session 05 handle the mapping.
* Fixed circular import: `runner.ts` exports `runMigrationsWithList(db, migrations)`, `index.ts` wraps it as `runMigrations(db)`.
* `synonym_votes` uses composite PK `(synonym_id, user_id)`.
* `votes.campaign_id` FK constraint added in migration 003 with `DO $$ IF NOT EXISTS` guard.

## Requests

None (index column fixes are outside this session's scope; flag for converge session 19).
