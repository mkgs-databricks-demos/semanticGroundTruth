# Session 03: Lakebase Migrations (Phase C)

## Scope
Create `server/migrations/` — a custom forward-only migration runner and six migrations that build the Ground Truth data model in Postgres schema `app`. Export `runMigrations(db: Db): Promise<{ applied: string[]; total: number }>`. Do not wire it into `server.ts` (session 09 does that) and do not delete the sample todo routes.

## Context
* Tables: `../docs/design/L200-C1_asset_registry.md` § Lakebase Schema, `L200-C5_campaign_manager.md`, `L200-C7_notification_service.md`, plus the additions in `build_conventions.md` §5 (decisions 1, 2, 6). All tables live in schema `app` (fully qualify every name: `app.assets`).
* `Db` from `server/lib/db.ts` (session 02, wave 0). Use `db.tx(script)` for each migration (single multi-statement call).
* Lakehouse Sync later replicates these tables to Delta as `lb_<table>_history`; keep table names stable.
* The existing `app.todos` table from the scaffold must be left alone (do not drop it).

## Tasks
1. `server/migrations/types.ts` — `export interface Migration { id: string; description: string; sql: string; }`.
2. `server/migrations/runner.ts` — `runMigrations(db)`:
   * `CREATE SCHEMA IF NOT EXISTS app; CREATE TABLE IF NOT EXISTS app._migrations (id TEXT PRIMARY KEY, description TEXT, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`.
   * A session-level advisory lock is NOT reliable on a pool; instead make every migration idempotent (`IF NOT EXISTS`) and insert into `_migrations` with `ON CONFLICT (id) DO NOTHING` inside the same `tx` script.
   * Apply pending migrations in `id` order; log each; on failure log and rethrow (app startup should fail loudly).
   * Return `{ applied, total }`.
3. `server/migrations/index.ts` — `export const MIGRATIONS: Migration[]` (ordered) and re-export `runMigrations`.
4. `001_core_schema.ts` — `assets` (L200-C1 + `display_name`, `status` with CHECK, `domain`, `subdomain`), `asset_versions`, `asset_synonyms`, `synonym_votes`, `votes` (+ `source` with CHECK, FK `campaign_id` added in 003), `example_questions` + `example_question_votes (question_id FK, user_id, action IN ('approve','reject'), created_at, UNIQUE (question_id, user_id))`.
5. `002_scoring_feedback.ts` — `confidence_scores`, `feedback_batches` (L200-C1 verbatim).
6. `003_campaigns.ts` — `campaigns` (L200-C5 + `completion_rule`, `freshness_interval_days DEFAULT 180`, `status DEFAULT 'active'`), `campaign_assignments`, `campaign_assets`; `ALTER TABLE app.votes ADD CONSTRAINT votes_campaign_fk FOREIGN KEY (campaign_id) REFERENCES app.campaigns(campaign_id)` guarded by a `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_campaign_fk') ... $$` block.
7. `004_notifications.ts` — `notifications` (L200-C7; channel CHECK = `in_app, slack, teams, webhook`), `notification_preferences (user_id TEXT, event_type TEXT, channels TEXT[] NOT NULL DEFAULT '{in_app}', digest BOOLEAN NOT NULL DEFAULT FALSE, updated_at, PRIMARY KEY (user_id, event_type))`.
8. `005_app_state.ts` — `app_config (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` seeded with `INSERT ... ON CONFLICT DO NOTHING` for every key in `DEFAULT_SETTINGS` (snake_case keys: `wilson_z`, `industry_prior`, `prior_weight`, `prior_decay_threshold`, `certification_threshold`, `min_votes_for_certification`, `staleness_days`, `freshness_interval_days`, `admin_emails`, `steward_emails`); `user_activity (user_id TEXT PRIMARY KEY, email TEXT, total_votes INTEGER NOT NULL DEFAULT 0, current_streak_days INTEGER NOT NULL DEFAULT 0, longest_streak_days INTEGER NOT NULL DEFAULT 0, last_vote_date DATE, badges TEXT[] NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; `mcp_sessions (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, current_asset_id UUID, campaign_id UUID, state JSONB NOT NULL DEFAULT '{}', created_at, updated_at)`.
9. `006_indexes.ts` — all L200-C1 indexes (`idx_assets_type`, `idx_assets_environment`, `idx_assets_confidence`, `idx_assets_last_reviewed`, `idx_votes_unprocessed` partial, `idx_votes_asset`, `idx_votes_user`, `idx_example_questions_asset`) plus `idx_assets_status`, `idx_assets_domain`, `idx_campaigns_status`, `idx_campaign_assets_asset`, `idx_notifications_recipient_unread ON app.notifications(recipient_id) WHERE status <> 'read'`. All `CREATE INDEX IF NOT EXISTS`.
10. Each migration file exports `export const migration: Migration = { id: '001_core_schema', description: '...', sql: `...` }` (template literal; no `${}` interpolation inside SQL).

## Acceptance Criteria
- [ ] 6 migration files + `runner.ts`, `types.ts`, `index.ts` exist; `MIGRATIONS` lists 6 ids in order.
- [ ] Every `CREATE` uses `IF NOT EXISTS`; every table is `app.`-qualified; no `DROP` statements.
- [ ] Column names match L200-C1/C5/C7 plus the conventions §5 additions exactly (session 01's DTOs map from these).
- [ ] `runMigrations` signature matches the Scope.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/migrations/**`

## Dependencies
- Session 02: `Db` (`server/lib/db.ts`), `logger`.
- Session 01: none directly (keep snake_case columns consistent with its camelCase DTOs).
