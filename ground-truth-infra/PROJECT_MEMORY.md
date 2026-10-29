# PROJECT_MEMORY — ground-truth-infra

> Last updated: 2026-10-23 — Root build waves 0–4 complete. CDF configured, bronze pipeline running (21 flows), 7 metric views deployed. Branch `mg-genie-agent-build`.

## Bundle Identity

**Bundle name:** `ground-truth-infra`
**Bundle root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-infra/`
**Solution root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/` (shared with ground-truth-app, ground-truth-agent)
**Role:** Bundle 1 of 3. Deploys FIRST — all shared infrastructure.

**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)

---

## Targets

| Target | Mode | Catalog | Schema (var) | Deployed UC Schema | Status |
|--------|------|---------|---------|--------|--------|
| `dev` | development (default) | `hls_fde_dev` | `ground_truth` | `hls_fde_dev.dev_matthew_giglia_ground_truth` | ✅ Deployed |
| `prod` | production | `prod_ground_truth` | `semantic_ground_truth` | `prod_ground_truth.semantic_ground_truth` | Not yet deployed |

> DAB dev mode auto-prepends `dev_<user>_` to schema names. Set `var.schema` to the unprefixed name.
> `staging` target deferred — not needed for initial deploy.

---

## What This Bundle Owns

### DAB Resources (all deployed to dev)

**UC Schema**
- `resources/ground_truth_schema.schema.yml` — `hls_fde_dev.dev_matthew_giglia_ground_truth` (dev)

**SQL Warehouse**
- `resources/infra_warehouse.warehouse.yml` — `Semantic Ground Truth`, 2X-Small serverless PRO
- ID (dev): `0ea84986a23a47c3`
- Permissions: CAN_MANAGE (matthew.giglia), CAN_USE (users group); app SPN added post-Bundle 2

**Lakeflow Jobs** (`resources/jobs/`)
- `feedback_pipeline.job.yml` — ID `811289891166091` — daily 11 PM UTC (paused in dev). 4 tasks: `collect_feedback` -> `check_has_feedback` -> `author_feedback_branch` (Genie Code `genie_task`, skill `ground-truth-feedback-author` `1.0.0` at `fixtures/skills/ground-truth-feedback-author/SKILL.md`) -> `register_feedback_branch`. Branches are `mg-genie-feedback-<yyyymmdd>[-n]`; first branch `mg-genie-feedback-20261026` (`38fb38e`, run `799084267984677`, session 38). Bundle YAML cannot express `genie_task`, so every deploy resets `author_feedback_branch` to a placeholder notebook that fails on purpose; `post_deploy_setup` (`setup_job_params`) patches it back. `register_feedback_branch.genie_response` is `""` (an `{{tasks.author_feedback_branch.output...}}` reference makes `jobs/reset` fail while the task is the placeholder); the notebook reads `runs/get-output`. **`repo_path`:** use the dedicated Git folder `/Workspace/Users/<user>/semanticGroundTruth-feedback` (dev repo id `1397479021974305`), never the build folder (Genie Code switches branches there); this is the YAML default since 2026-10-27 (`/Workspace/Users/${workspace.current_user.userName}/semanticGroundTruth-feedback`; the Git folder must exist before the first run). **`batchId`** in the app's `UpsertFeedbackBranchRequest` is an `app.feedback_batches` id, not the staging batch id, so the job does not send it; it sends `voteIds` and the app marks those votes processed (app `e7c8736`). Runbook: `../docs/runbooks/feedback_pipeline.md`. Gap G4, build 4.
- `freshness_resurfacing.job.yml` — ID `1103481179431341` — daily 6 AM UTC
- `metric_view_deploy.job.yml` — ID `423348439302077` — on-demand
- `post_deploy_validation.job.yml` — ID `123170360460207` — on-demand
- `cdf_bronze_refresh.job.yml` — ID `703274109872341` (dev) — hourly `0 0 * * * ?` UTC `pipeline_task` on `cdf_bronze` (`full_refresh: false`, `max_concurrent_runs: 1`). Development mode pauses the schedule in `dev`; it runs hourly only in `prod`. Gap G2, added 2026-10-23.
- `post_deploy_setup.job.yml` — ID `159451853337655` (dev) — auto-triggered by `job_run` on every deploy (with `run_setup=true`). G10 (build 4, session 28): tasks `setup_gateway_connection`, `setup_app_role_sp` and `check_m2m_secret_present` removed (notebooks deleted). The `app_sp_client_id` parameter is kept because `run_post_deploy.job_run.yml` still passes it (optional cleanup). Open: `setup_cdf_config` gets `lakebase_branch_id` but the notebook reads a `database` widget (default `""`). Each `setup_genie_automation` run may create a new Genie Code scheduled task (session 38 saw a new `configuration_id`); check for duplicates.
- `run_post_deploy.job_run.yml` — deploy hook, fires post_deploy_setup

**Secret scope** (`resources/secrets/ground_truth_scope.secret_scope.yml`) — `semantic_ground_truth_credentials`
- The `permissions` block is **authoritative**: every infra deploy removes ACLs that are not listed. It lists the owner (MANAGE) and the app SPN (`service_principal_name: ${var.app_service_principal_id}`, READ) in both targets. Without the app SPN entry, the app logs `error resolving resource m2m-client-id` on every start (gap G1, fixed 2026-10-23).

**Executive dashboard** (`resources/dashboards/executive.dashboard.yml` → `src/dashboards/executive.lvdash.json`)
- `Semantic Ground Truth — Executive`, dev ID `01f1cf0b38d31b7cbac5bdac6cafe3eb`, warehouse `${resources.sql_warehouses.infra_warehouse.id}`.
- 11 datasets (`MEASURE()` over 6 of the 7 metric views, incl. `ds_skipped_cards` / `ds_skip_rate_trend` added in build 4; `mv_feedback_pipeline` has no widget yet), 1 page: KPI counters, review trend, skips, campaign progress, asset status mix, error rate, P95 latency. Brand chart palette. Published 2026-10-26 05:27Z; all 11 datasets pass `EXPLAIN` (session 37).
- The app dev target's `exec_dashboard_url` is the real published URL of this dashboard; update it if the dashboard is recreated (`../docs/runbooks/deploy_order_and_permissions.md`).
- Datasets use `catalog`/`schema` fields, not 3-part names. `mv_campaign_progress` has no `campaign_name` column; use `campaign_type` (fixed in session 22b).
- The app gets the published URL from `deploy.sh` (`--var exec_dashboard_url`). Gap G3, added 2026-10-23.

**Agent skills volume** (`resources/agent_skills.volume.yml`) — managed volume `agent_skills` (`prevent_destroy`), added 2026-10-26. The app bundle's `sync_agent_skills` job mirrors `ground-truth-app/agent_skills/` into it, and the app's `agents-skills` resource reads it, so **deploy infra before the app**.

**UC Secrets** — removed. The comment-only `slack_webhook`, `teams_webhook` and `git_token` secret YAMLs were deleted in build 4 (G10, session 28). Slack goes through `system.ai.slack` per `../docs/research/05_slack_mcp_notifications.md` (G5, not built yet).

**MCP Service** — not in this bundle. The Unity Gateway MCP service and its HTTP connection live in `ground-truth-app` (see that bundle's PROJECT_MEMORY "MCP Service (moved from infra)").

**Lakebase** (`resources/lakebase/`)
- `ground_truth_project.postgres_project.yml` — dev: `projects/dev-matthew-giglia-ground-truth` | prod: `projects/ground-truth`
- `production.postgres_branch.yml` — `is_protected: true`, `replace_existing: true`
- `development.postgres_branch.yml` — copy-on-write snapshot of production
- `app_role.postgres_role.yml` — `ground_truth_app_role`; identity_type added post-Bundle 2
- `app_db.postgres_database.yml` — `ground_truth_app` on production branch

> CDF tables (`lb_*_history`) are now configured and active — 23 history tables in `cdf_bronze_tables.yaml` feeding `bronze_lakebase_cdf` (21 + `review_skips`, `user_settings` since build 4).
> `postgres_synced_tables` in DABs = Reverse ETL (Delta→Lakebase), NOT Lakebase→Delta.

**SDP Pipeline**
- `resources/pipelines/cdf_bronze.pipeline.yml` — metadata-driven bronze pipeline: streams all `lb_*_history` tables into `bronze_lakebase_cdf`
- `src/lib/cdf_bronze/builder.py` — `CdfBronzeBuilder` class (reads `fixtures/pipelines/cdf_bronze_tables.yaml`, creates one streaming append flow per table)
- `src/pipelines/cdf_bronze_notebook.py` — SDP pipeline notebook
- `fixtures/pipelines/cdf_bronze_tables.yaml` — table config listing all `lb_*_history` tables with keys

### Source Files
- **Python notebooks** (deployed) — `src/notebooks/` — collect_feedback, create_feature_branch, freshness_check, list_fixtures, deploy_metric_view, post_deploy_validation, setup_cdf_config
- **Python library** — `src/lib/lakebase_cdf.py` — CDF config helpers (create/list configs)
- **7 metric view fixtures** — `fixtures/metric_views/` — mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency. Build 4: `mv_review_activity` is `votes` UNION ALL `review_skips` inserts and keeps the latest row per `_record_key` (no `update_preimage`, no `delete`), like the other CDF views; new measures `skips`, `skip_rate`, dimension `skip_reason`; `mv_user_leaderboard.total_skips`. Open (session 29): `asset_type` dimension on `mv_review_activity`, campaign name/due date on `mv_campaign_progress`, `branch_name` on `mv_feedback_pipeline`.
- **Bronze table list** — `fixtures/pipelines/cdf_bronze_tables.yaml` now includes `review_skips` (keys `[id]`) and `user_settings` (keys `[user_id]`) from migration 009 (session 37). A migration that ALTERs a synced table triggers a Lakehouse Sync re-snapshot; recover with `reset_checkpoint_selection` on the `bronze_from_<table>` flows, **never a full refresh** (`../docs/runbooks/cdf_bronze_operations.md` §1).
- **Genie Code skill** — `fixtures/skills/ground-truth-feedback-author/SKILL.md` (`1.0.0`)
- **1 Genie Code automation prompt** — `fixtures/prompts/feedback_loop_prompt.md` (`2.0.0`, thin pointer to the skill; consumed by `setup_genie_automation.py`). `docs/plans/feedback_pipeline_rework_plan.md` (`feedback/YYYY-MM-DD` branches) is superseded by plan 27.

### Post-Deploy Automation (replaces prior manual steps)

**Declarative (deploy-time):** UC Secrets (3), MCP Service — deployed by `bundle deploy` (requires `engine: direct`, CLI ≥ 1.17.0)

**Auto-triggered (via `job_run` resource):**
- Group A (every deploy): Genie Code automation creation, feedback_pipeline job param patching
- Group B (post-Bundle 2): Lakebase CDF config (the Unity Gateway HTTP connection and app_role SP tasks were removed in build 4: the MCP connection is the app's `create_mcp_connection` job, the Lakebase role comes from AppKit `CAN_CONNECT_AND_CREATE`)

**Remaining manual step:** Lakebase Lakehouse Sync — configure in Lakebase App UI after Bundle 2 (creates `lb_*_history` Delta tables). Planned for `setup_cdf_config.py` notebook but needs API verification.

See `docs/plans/post_deploy_automation_plan.md` and `docs/plans/feedback_pipeline_rework_plan.md`.

---

## Design Documents

All at `../docs/design/` (solution root).

| Spec | Scope |
|------|-------|
| L100 §Deployment Architecture, §Bundle 1 | System-level infra scope |
| L200-C1 Asset Registry | Lakebase schema (11 tables with full DDL) |
| L200-C6 Feedback Pipeline | Pipeline flow, Genie Code skill, retry logic |
| L200-C9 Operational Genie Agent | 4 metric views, curated instructions (deployed here, consumed by Bundle 3) |
| L300-01 | Repo scaffold + databricks.yml config |
| L300-02 | Lakebase project + branches + migration scripts |
| L300-03 | UC Secrets, SQL Warehouse, notification destinations |
| L300-04 | Lakeflow Jobs (feedback pipeline, freshness, branch creation) |
| L300-05 | Metric view fixtures over CDF tables |
| L300-06 | Genie Code custom skills |
| L300-07 | Unity Gateway connection registration |
| L300-08 | Bundle 1 deploy + post-deploy validation |

---

## Variables

| Variable | Description | Set? |
|----------|-------------|------|
| `catalog` | Target UC catalog | Not yet |
| `schema` | Target UC schema | Not yet |
| `warehouse_id` | ~~Replaced by DAB substitution~~ `${resources.sql_warehouses.infra_warehouse.id}` | N/A |
| `lakebase_project_id` | ~~Replaced by DAB substitution~~ `${resources.postgres_projects.ground_truth_project.id}` | N/A |
| `notification_slack_webhook` | Slack webhook URL | Not used (webhooks deferred; G5 recommends `system.ai.slack`) |
| `notification_teams_webhook` | Teams webhook URL | Not used (webhooks deferred) |
| `app_service_principal_id` | Application (client) ID of the app SPN that gets READ on the secret scope | dev default `9f3db838-9415-46fe-9722-9654a6856ecc`; no global default (prod must pass it). `deploy.sh` overrides it with the live SPN from `databricks apps get`. The app SPN changes on every app destroy/recreate, so update the dev default then. |

---

## Build Plan

See `docs/plans/infra_build_plan.md` for the detailed 8-phase plan with deliverables, validation gates, and open questions.

**Phase summary:** Config → Lakebase → Secrets/Warehouse/Notifications → Jobs → Metric Views → Genie Code Skills → Unity Gateway → Deploy+Validate

---

## Open Questions — ALL RESOLVED

All 11 open questions from the L300 specs have been resolved. See `docs/plans/infra_build_plan.md` § Consolidated Open Questions for full findings.

Key resolutions:
1. **`for_each_task` syntax** — `file_list()` does NOT exist. Use upstream notebook + `taskValues`.
2. **`genie_code_task`** — Yes, available (Beta). No structured output — only a thread link.
3. **Genie Code task output** — No built-in mechanism. Restructure pipeline: combine Genie Code call + branch creation in a single notebook task, or write proposed YAML to Delta/Volume.
4. **Cross-bundle variables** — `deploy.sh` pattern with `bundle summary --output json` + `resolve_infra_vars()`.
5. **Lakebase as DAB resources** — Fully supported (Beta, Feb 2026). Manual CLI replaced.
6. **Migrations** — Moved to Bundle 2 (App). lakeLoom TypeScript pattern.

---

## Conventions

- **Schema references:** `${resources.schemas.ground_truth_schema.*}` in resource definitions
- **Warehouse references:** `${resources.sql_warehouses.infra_warehouse.id}`
- **Notebook paths:** Must match actual file extension on disk; validate with directory listing
- **Migrations:** MOVED to Bundle 2 (App). lakeLoom TypeScript pattern — app server runs migrations on startup.
- **Session summaries:** `docs/sessions/YYYY-MM-DD_description.md` + `docs/sessions/INDEX.md`
- **Git workflow:** Feature branches only; `mg-genie-<description>`

---

## Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-10-08 | Scaffold created | Empty DAB via workspace GUI; dev+prod targets; no variables/resources |
| 2026-10-08 | Build plan created | `docs/plans/infra_build_plan.md`; PROJECT_MEMORY.md created |
| 2026-10-08 | Open questions resolved | All 11 L300 open questions resolved |
| 2026-10-08 | Phases 1–8 complete | All resources declared, deployed, and validated in dev |
| 2026-10-08 | Post-deploy refactor | Naming cleanup, folder restructure, one-resource-per-YAML split |
| 2026-10-08 | docs/ restructure | `docs/plans/`, `docs/sessions/` established; fixtures/ is now exclusively deployable config |
| 2026-10-23 | Root build waves 0–4 complete | CDF setup job, bronze SDP pipeline (21 flows / 281 rows), 7 metric views deployed. Branch `mg-genie-agent-build`. |
| 2026-10-24 | **Brand + gaps build (run `745271774924215`)** ✅ | Branch `mg-genie-ui-brand-and-gaps`. G1: `app_service_principal_id` var + app SPN READ in the scope `permissions` (sessions 18, 22a; stale dev default `55882972-…` corrected to `9f3db838-…`); `secrets list-acls` verified after the 22a and 22b deploys. G2: `cdf_bronze_refresh` job; run `950875080561148` SUCCESS, pipeline update `800a3ae5-…` COMPLETED with 0 issues, bronze 774 rows. G3: executive dashboard `01f1cf0b38d31b7cbac5bdac6cafe3eb`, 9/9 datasets pass EXPLAIN and LIMIT 1 (session 22b). `agent_verification` regression run `149451153256513` SUCCESS (session 22c). |
| 2026-10-26 | **Build 4 (runs `110489694161084` + `655172288447819`)** | Branch `mg-genie-build-4`. Owner: `agent_skills` volume. Session 27/38 (G4): feedback pipeline as Genie Code task + skill `1.0.0`; first branch `mg-genie-feedback-20261026`, votes marked processed, idempotency run `885100203138696` created no branch. Session 28/37 (G10 + skips): G10 deletions deployed in `post_deploy_setup` `159451853337655`; `review_skips`/`user_settings` in bronze; migration 009 re-snapshot recovered with `reset_checkpoint_selection` on `bronze_from_votes`/`bronze_from_user_activity` (update `2454186f`); `mv_review_activity` latest-row dedupe; 7 metric views redeployed, cross-checked 13 votes / 1 skip. |
| 2026-10-27 | **Build 4 closed (owner, interactive)** | Wave 4-6 unblocked: app `voteIds` deployed, votes `644eff17`/`4f81557c` marked processed through the app, idempotency run `885100203138696` (no feedback -> no branch). `feedback_pipeline.job.yml` default `repo_path` -> `semanticGroundTruth-feedback`; infra deploy + `post_deploy_setup` run `1115453808467683` (`author_feedback_branch` genie_task, new `configuration_id` `…/20536fcd…`: setup makes a new automation every run, follow-up 1). Follow-ups: `../docs/requests/2026-10-27_build-4-follow-ups.md`. Session: `../docs/sessions/2026-10-27_build-4-unblock-and-close.md`. |
| 2026-10-28 | **Build 5 (run `229891579528310`, waves 5-4/5-5 converge)** | Branch `mg-genie-build-5`. 46: `genie_automation_lib.py` keeps one Genie Code automation (job, then recorded `setup_state/genie_automation.json`, then previous id; unscheduled automations are not listed and have no `display_name`); `deploy.sh --infra` always runs `post_deploy_setup` with `run_setup=true`; `setup_cdf_config` widget fix; `bundle_target` job parameter; `collect_feedback` records edit votes with no proposed value as processed (`no_proposed_value`) and has a `dry_run` widget. 47: metric view id dimensions are lowercase UUID strings. 48: `ui_visual_checks` job + volume. 57: three `post_deploy_setup` runs kept `20536fcd...`, duplicate `e9bdf433...` deleted, `post_deploy_validation` 11/11, test batch `21bb95ea...` rejected, remote `mg-genie-feedback-20261026` deleted (owner). **D-B5-4 (owner, `9ec1219`): the bronze quality monitor is under `targets.prod` only**, because the shared metastore is at its 1000-monitor limit (create returns 429 and `bundle deploy` hangs on the retry). 58: dev deploys with no monitor, prod validates with it; first prod refresh not yet proven. Owner `6d2b95f`: M2M SPN READ/WRITE VOLUME on `ui_visual_checks` through the app's `app_post_deploy_setup`. Runbooks: `../docs/runbooks/cdf_bronze_operations.md` §6, `deploy_order_and_permissions.md`. Follow-ups: `../docs/requests/2026-10-28_build-5-follow-ups.md`. |

---

## Lakebase DAB Research Notes

**Verified against docs Oct 2026.**

DABs support Lakebase resource types (Beta, Feb 2026 — confirmed via [Manage Lakebase with DABs](https://docs.databricks.com/aws/en/oltp/projects/manage-with-bundles), last updated Sep 11 2026): `postgres_projects`, `postgres_branches`, `postgres_endpoints`, `postgres_databases`, `postgres_catalogs`, `postgres_synced_tables`, `postgres_roles`.

**This project does NOT use `postgres_catalogs`** (UC catalog binding). That resource type creates a full UC catalog mirroring the Lakebase project and requires **CREATE CATALOG** permission on the metastore. Instead, we use `postgres_synced_tables` (CDF) to replicate specific tables as Delta tables (`lb_<table>_history`) into our existing UC schema. This keeps permissions scoped to schema-level grants.

The [Typical Lakebase project setup](https://docs.databricks.com/aws/en/oltp/projects/dabs-typical-project) page provides a full canonical YAML example including project → production branch → endpoint → app role → app database → UC catalog binding → synced tables → Databricks App with `resources.postgres` block. We follow this pattern but **skip the UC catalog binding** (`postgres_catalogs`) — we use synced tables (CDF) only.

**Substitution pattern (from docs):** `${resources.postgres_projects.my_app.id}`, `${resources.postgres_branches.production.id}`, `${resources.postgres_roles.app_role.id}`, `${resources.postgres_databases.app_db.name}`, `${resources.postgres_branches.production.name}`. These ensure proper dependency ordering during deployment.

**Critical deploy findings (confirmed against live deploy, Oct 2026):**
- `.id` for ALL Lakebase resources returns the **full resource path** (e.g. `projects/dev-matthew-giglia-ground-truth`). Never prepend `projects/` manually.
- Branch `parent` field: use `${resources.postgres_projects.ground_truth_project.id}` directly (already `projects/{id}`).
- `app_db.role` field: use `${resources.postgres_roles.app_role.id}` directly (already full path).
- Jobs `environment_key: serverless` requires a matching `environments: [{environment_key: serverless, spec: {client: "1"}}]` block at the job level.

**Approach hierarchy (per project conventions):**
1. **DABs (primary)** — Declarative YAML in `resources/lakebase.yml`. Fully supported for project, branches, endpoints, roles, databases, synced tables. This is the approach used in this plan (UC catalog binding excluded — CDF via synced tables only).
2. **Parameterized SQL — NOT available for Lakebase resource creation.** Project/branch/endpoint creation is API-only. SQL DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`) is used *inside* the Lakebase database for schema objects — our `src/migrations/V*.sql` scripts handle this layer.
3. **Python SDK (fallback)** — `databricks.sdk.service.postgres`: `w.postgres.create_project(...)`, `w.postgres.create_branch(...)`, etc. Returns operations with `.wait()`. Use only if DABs can't express a specific resource or for dynamic scripting in notebooks.

**Key docs note:** Every Lakebase project auto-creates a `databricks_postgres` database owned by your identity. This plan creates a separate named database via `postgres_databases` owned by a dedicated `postgres_roles` resource to isolate app data (matches the canonical pattern).

(Source: read from Databricks public documentation, Oct 2026 — unverified against actual deployment.)

---

## Deviations from L300 Specs

| Item | L300 Spec | Actual | Reason |
|------|-----------|--------|--------|
| Directory name | `bundle-infra/` | `ground-truth-infra/` | Matches bundle name; created via GUI |
| Staging target | Included | Deferred | Not needed for initial dev; add when ready |
| `workspace.root_path` | `/Workspace/Shared/.bundles/...` | `/Users/matthew.giglia@databricks.com/.bundle/...` (prod) | GUI default; adjust when deploying shared |
| Dev catalog | `dev_ground_truth` | `hls_fde_dev` | Workspace convention; `dev_ground_truth` doesn’t exist |
| Resource YAML layout | One file per type | One file per resource, subdirs by category | User preference — applied post-deploy |
