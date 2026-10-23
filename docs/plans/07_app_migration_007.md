# 07 — App: migration 007 (CDF readiness, app groups, asset sources)

**Wave 1 · edit · owns `ground-truth-app/server/migrations/**`**

## Context
* Migrations 001–006 are applied in dev (2026-10-22). All 18 `app.*` tables have `REPLICA IDENTITY DEFAULT`; CDF needs `FULL` (build_conventions §6).
* Runner: `server/migrations/runner.ts` records ids in `app._migrations`; migration SQL must be idempotent (`IF NOT EXISTS`, no `DROP`).
* Tables are owned by the app SPN, so `ALTER TABLE` must run inside the app (migrations), not from a job.

## Steps
1. `007_rbac_sources_cdf.ts`:
   * `app.app_groups` and `app.app_group_members` per build_conventions §3 (FK to `app_groups(name)`, `member_id` stored lower-case, CHECK role in reviewer/steward/admin); seed the 3 groups with `INSERT ... ON CONFLICT (name) DO NOTHING`.
   * `app.asset_sources` per §4 with `UNIQUE (workspace_path)`.
   * `ALTER TABLE app.assets ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES app.asset_sources(id)`, `ADD COLUMN IF NOT EXISTS source_metadata JSONB`.
   * A `DO $$ ... $$` block that sets `REPLICA IDENTITY FULL` on every ordinary table in schema `app` whose `relreplident <> 'f'`.
2. `runner.ts`: after applying pending migrations, always run the same replica-identity block (idempotent) so tables added later are covered. Export it as `ensureReplicaIdentityFull(db)`.
3. Register 007 in `index.ts`; extend `migrations.test.ts` (ids sorted and unique, 007 contains no `DROP`, every CREATE uses `IF NOT EXISTS`, replica block present).

## Done when
* App unit tests for migrations pass (`pnpm exec vitest run server/migrations`).
* No `DROP` in any migration; 007 is listed after 006.
