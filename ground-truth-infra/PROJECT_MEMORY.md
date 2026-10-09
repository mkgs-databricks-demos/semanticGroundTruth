# PROJECT_MEMORY — ground-truth-infra

> Last updated: 2026-10-08 — post-deploy cleanup and refactor complete. Bundle 1 fully deployed to dev.

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
- `feedback_pipeline.job.yml` — ID `811289891166091` — daily 11 PM UTC
- `freshness_resurfacing.job.yml` — ID `1103481179431341` — daily 6 AM UTC
- `metric_view_deploy.job.yml` — ID `423348439302077` — on-demand
- `post_deploy_validation.job.yml` — ID `123170360460207` — on-demand

**Lakebase** (`resources/lakebase/`)
- `ground_truth_project.postgres_project.yml` — dev: `projects/dev-matthew-giglia-ground-truth` | prod: `projects/ground-truth`
- `production.postgres_branch.yml` — `is_protected: true`, `replace_existing: true`
- `development.postgres_branch.yml` — copy-on-write snapshot of production
- `app_role.postgres_role.yml` — `ground_truth_app_role`; identity_type added post-Bundle 2
- `app_db.postgres_database.yml` — `ground_truth_app` on production branch

> CDF tables (`lb_*_history`) configured via Lakebase App UI Lakehouse Sync after Bundle 2 deploys.
> `postgres_synced_tables` in DABs = Reverse ETL (Delta→Lakebase), NOT Lakebase→Delta.

### Source Files
- **6 Python notebooks** — `src/notebooks/` — collect_feedback, create_feature_branch, freshness_check, list_fixtures, deploy_metric_view, post_deploy_validation
- **4 metric view fixtures** — `fixtures/metric_views/` — mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline
- **1 Genie Code skill prompt** — `fixtures/prompts/feedback_loop_prompt.md`

### Manual Post-Deploy Steps (not DAB-declarable)
- UC Secrets: create scope `ground-truth-infra` with `slack_webhook_url`, `teams_webhook_url`, `git_token`
- Lakebase Lakehouse Sync: configure in Lakebase App UI after Bundle 2 (creates `lb_*_history` Delta tables)
- Unity Gateway connection `ground-truth-mcp`: follow `docs/runbooks/unity-gateway-setup.md`
- Genie Code skill: `POST /api/2.1/unity-catalog/skills` (see `fixtures/prompts/feedback_loop_prompt.md`)
- Lakebase `app_role` identity: update to SERVICE_PRINCIPAL after Bundle 2 SP known
- Job params: set `genie_space_id` + `git_folder_id` in feedback_pipeline after skill registered

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
| `notification_slack_webhook` | Slack webhook URL | Not yet |
| `notification_teams_webhook` | Teams webhook URL | Not yet |

---

## Build Plan

See `docs/infra_build_plan.md` for the detailed 8-phase plan with deliverables, validation gates, and open questions.

**Phase summary:** Config → Lakebase → Secrets/Warehouse/Notifications → Jobs → Metric Views → Genie Code Skills → Unity Gateway → Deploy+Validate

---

## Open Questions — ALL RESOLVED

All 11 open questions from the L300 specs have been resolved. See `docs/plan/infra_build_plan.md` § Consolidated Open Questions for full findings.

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
- **Session summaries:** `fixtures/sessions/YYYY-MM-DD_description.md` + `fixtures/sessions/INDEX.md`
- **Git workflow:** Feature branches only; `mg-genie-<description>`

---

## Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-10-08 | Scaffold created | Empty DAB via workspace GUI; dev+prod targets; no variables/resources |
| 2026-10-08 | Build plan created | `docs/infra_build_plan.md`; PROJECT_MEMORY.md created |
| 2026-10-08 | Open questions resolved | All 11 L300 open questions resolved |
| 2026-10-08 | Phases 1–8 complete | All resources declared, deployed, and validated in dev |
| 2026-10-08 | Post-deploy refactor | Naming cleanup, folder restructure, one-resource-per-YAML split |

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
