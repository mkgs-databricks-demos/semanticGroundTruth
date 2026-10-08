# PROJECT_MEMORY — ground-truth-infra

## Bundle Identity

**Bundle name:** `ground-truth-infra`
**Bundle root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-infra/`
**Solution root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/` (shared with ground-truth-app, ground-truth-agent)
**Role:** Bundle 1 of 3. Deploys FIRST — all shared infrastructure.

**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)

---

## Targets

| Target | Mode | Catalog | Schema | Status |
|--------|------|---------|--------|--------|
| `dev` | development (default) | `dev_ground_truth` | `app` | Scaffolded — no variables yet |
| `prod` | production | `prod_ground_truth` | `app` | Scaffolded — no variables yet |
| `staging` | — | `staging_ground_truth` | `app` | Not yet created (L300-01 proposed it) |

---

## What This Bundle Owns

### DAB Resources
- **UC Schema** — `${var.catalog}.${var.schema}`
- **SQL Warehouse** — Serverless PRO, 2X-Small
- **Lakeflow Jobs** — feedback_pipeline, freshness_resurfacing, metric_view_deploy, post_deploy_validation

### DAB-Declared Lakebase Resources (`resources/lakebase.yml`)
- **Lakebase project** (`postgres_projects`) — `ground-truth`
- **Lakebase branches** (`postgres_branches`) — production (auto), dev (copy-on-write)
- **Lakebase endpoint** (`postgres_endpoints`) — app compute endpoint
- **Lakebase role** (`postgres_roles`) — app role for database ownership
- **Lakebase database** (`postgres_databases`) — app database
- **Lakebase synced tables** (`postgres_synced_tables`) — 6 CDF tables: assets, votes, user_activity, confidence_scores, campaigns, feedback_batches → Delta `lb_*_history` in existing UC schema
- **Lakebase tables** — 11 tables from L200-C1 (created by app-side TypeScript migrations on server startup, not infra)

> **No `postgres_catalogs`** — UC catalog binding removed. Requires CREATE CATALOG on metastore. Using CDF via `postgres_synced_tables` instead.
- **Lakebase CDF** — 6 tables with `REPLICA IDENTITY FULL` → Delta tables in UC (`lb_*_history`)

> Lakebase DAB support added Feb 2026 (Beta). Replaces manual CLI from L300-02.
- **UC Secrets** — `slack_webhook_url`, `teams_webhook_url`, `git_token`
- **Unity Gateway connection** — `ground-truth-mcp` (placeholder URL; updated by Bundle 2)
- **Genie Code skill** — feedback loop prompt
- **Notification destinations** — Slack, Teams, webhook (workspace settings)

### Source Files
- **~~10 SQL migrations~~** — **MOVED to Bundle 2 (App).** App-side TypeScript migrations run on server startup (lakeLoom pattern: `server/migrations/migrate.ts`).
- **5 Python notebooks** — `src/notebooks/` (collect_feedback, create_feature_branch, freshness_check, deploy_metric_view, post_deploy_validation)
- **1 prompt** — `src/prompts/feedback_loop_prompt.md`
- **4 metric view fixtures** — `fixtures/mv_*.yaml` (review_activity, coverage_metrics, user_leaderboard, feedback_pipeline)

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

See `docs/plan/infra_build_plan.md` for the detailed 8-phase plan with deliverables, validation gates, and open questions.

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
| 2026-10-08 | Build plan created | `docs/plan/infra_build_plan.md`; PROJECT_MEMORY.md created |
| 2026-10-08 | Open questions resolved | All 11 L300 open questions resolved. Key: Lakebase DAB-declarable (Beta), migrations moved to Bundle 2, `for_each_task` needs upstream notebook, `genie_code_task` available (Beta, no structured output), cross-bundle vars via deploy.sh. Build plan updated with findings. Session summary + README written. |

---

## Lakebase DAB Research Notes

**Verified against docs Oct 2026.**

DABs support Lakebase resource types (Beta, Feb 2026 — confirmed via [Manage Lakebase with DABs](https://docs.databricks.com/aws/en/oltp/projects/manage-with-bundles), last updated Sep 11 2026): `postgres_projects`, `postgres_branches`, `postgres_endpoints`, `postgres_databases`, `postgres_catalogs`, `postgres_synced_tables`, `postgres_roles`.

**This project does NOT use `postgres_catalogs`** (UC catalog binding). That resource type creates a full UC catalog mirroring the Lakebase project and requires **CREATE CATALOG** permission on the metastore. Instead, we use `postgres_synced_tables` (CDF) to replicate specific tables as Delta tables (`lb_<table>_history`) into our existing UC schema. This keeps permissions scoped to schema-level grants.

The [Typical Lakebase project setup](https://docs.databricks.com/aws/en/oltp/projects/dabs-typical-project) page provides a full canonical YAML example including project → production branch → endpoint → app role → app database → UC catalog binding → synced tables → Databricks App with `resources.postgres` block. We follow this pattern but **skip the UC catalog binding** (`postgres_catalogs`) — we use synced tables (CDF) only.

**Substitution pattern (from docs):** `${resources.postgres_projects.my_app.id}`, `${resources.postgres_branches.dev_branch.id}`, `${resources.postgres_roles.app_role.id}`, `${resources.postgres_databases.app_db.name}`, `${resources.postgres_branches.production.name}`. These ensure proper dependency ordering during deployment.

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
