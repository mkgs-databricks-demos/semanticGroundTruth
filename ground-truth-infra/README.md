# ground-truth-infra

Bundle 1 of 3 for the **Semantic Ground Truth App**. Deploys all shared infrastructure that the App (Bundle 2) and Agent (Bundle 3) depend on.

## What This Bundle Deploys

| Resource | Type | Description |
|----------|------|-------------|
| UC Schema | `${var.catalog}.${var.schema}` | Shared schema for all app data and metric views |
| SQL Warehouse | Serverless PRO, 2X-Small | Metric view queries, sample aggregations, Genie Agent compute |
| Lakebase Project | Postgres (DAB-declared) | App state database — project, branches, endpoint, role, database |
| Lakebase CDF | 21 history tables | All `app` schema tables → `lb_*_history` in UC via Lakehouse Sync |
| SDP Pipeline | `cdf_bronze` | Metadata-driven bronze: streams all `lb_*_history` into `bronze_lakebase_cdf` (VARIANT `data`) |
| Lakeflow Jobs | 7 jobs | feedback_pipeline (daily), freshness_resurfacing (daily), metric_view_deploy, post_deploy_validation, setup_lakebase_cdf, M2M SPN setup, **cdf_bronze_refresh** (hourly `cdf_bronze` run; paused in dev) |
| AI/BI Dashboard | `executive` | `Semantic Ground Truth — Executive`: KPIs, review trend, skipped cards + skip rate by day, campaign progress, asset status mix, app error rate and P95 latency over the metric views (`src/dashboards/executive.lvdash.json`) |
| Secret scope | `semantic_ground_truth_credentials` | M2M credentials. `permissions` grants the owner MANAGE and the app SPN (`var.app_service_principal_id`) READ |
| Metric View Fixtures | 7 YAMLs | mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency |
| Genie Code Skill | Feedback loop prompt | `fixtures/prompts/feedback_loop_prompt.md` |

## Targets

| Target | Catalog | Mode |
|--------|---------|------|
| `dev` | `hls_fde_dev` | Development (default) — schema auto-prefixed `dev_<user>_` |
| `prod` | `prod_ground_truth` | Production |

## Deploy

This bundle must deploy **before** Bundles 2 and 3.

```bash
# Validate
databricks bundle validate --strict --target dev

# Deploy
databricks bundle deploy --target dev

# Run post-deploy validation
databricks bundle run post_deploy_validation --target dev
```

Preferred: run `./deploy.sh --target dev --infra --run-setup` from the solution root, which also checks the M2M SPN credentials and reports secret-scope keys.

> **Secret scope ACL (app SPN):** the scope's `permissions` block is authoritative, so every deploy removes any ACL it does not list. It lists the app service principal through `app_service_principal_id`. `deploy.sh` sets it from `databricks apps get <app>`. If you deploy this bundle directly, check that the dev default in `databricks.yml` is still the live app SPN (it changes when the app is destroyed and recreated) or pass `--var app_service_principal_id=<client-id>`. Check with `databricks secrets list-acls semantic_ground_truth_credentials`.

### Scheduled bronze refresh

`cdf_bronze_refresh` runs the `cdf_bronze` pipeline every hour on the hour (UTC), so metric views, the executive dashboard and the Genie agent stay current. Development mode pauses the schedule in `dev`. Refresh there by hand:

```bash
databricks bundle run cdf_bronze_refresh --target dev
```

### Executive dashboard

Deployed and published by `bundle deploy`. `deploy.sh` reads its ID from `bundle summary` and passes the published URL (`<workspace>/dashboardsv3/<id>/published`) to the app as `exec_dashboard_url`. If you change a dataset, check it with `EXPLAIN` against the metric view first (column names must exist in the view, for example `campaign_type`, not `campaign_name`).

Skip metrics (build 4): `mv_review_activity` unions `votes` with `review_skips` inserts from bronze. A skip is not a vote: `Total Votes`, `Approval Rate`, `Unique Reviewers` count votes only; `skips`, `skip_rate` (`skips / (votes + skips)`) and the `skip_reason` dimension cover skips. `mv_user_leaderboard.total_skips` sums `app.user_activity.total_skips`. Skip rows reach bronze only once `review_skips` (and `user_settings`) are listed in `fixtures/pipelines/cdf_bronze_tables.yaml`; Lakebase CDF itself replicates every table in the `app` schema automatically (a table appears as `lb_<table>_history` after its first row).

Removed (G10, 2026-10-24): the scaffold-only `setup_gateway_connection` and `setup_app_role_sp` notebooks and their `post_deploy_setup` tasks (plus the `check_m2m_secret_present` gate), and the empty `git_token`, `slack_webhook` and `teams_webhook` secret YAMLs. App notifications go through the workspace Slack MCP instead of webhooks (research 05).

### Data plane (after the app bundle has run migrations)

The Lakebase `app` schema is created by app migrations, so run these **after** `ground-truth-app` is deployed:

```bash
# 1. Lakehouse Sync: 21 app tables → lb_*_history (idempotent)
databricks bundle run setup_lakebase_cdf --target dev

# 2. SDP bronze: all lb_*_history → bronze_lakebase_cdf
databricks bundle run cdf_bronze --target dev

# 3. Metric views: deploy all 7 fixtures (for_each over fixtures/metric_views)
databricks bundle run metric_view_deploy --target dev
```

Adding a table or recovering from a schema change: see [CDF → bronze operations](../docs/runbooks/cdf_bronze_operations.md).

## Build Plans

* **Original bundle build:** [`docs/plans/infra_build_plan.md`](docs/plans/infra_build_plan.md), the 8-phase plan used for the first deploy (2026-10-08).
* **CDF / bronze / metric views (2026-10-23):** built by the root build (manifest in git history). See sessions 02, 03, 04 (edit) and 13 (converge) in [`../docs/sessions/INDEX.md`](../docs/sessions/INDEX.md).
* **Secret ACL, bronze refresh, executive dashboard (2026-10-23/24):** built by the brand + gaps manifest [`../docs/plans/waves.json`](../docs/plans/waves.json), run `745271774924215`. See sessions 18, 21 (edit), 22a, 22b (converge) and 22c (agent regression).

### Converge lessons (session 13)

* `spark.catalog.tableExists()` is blocked in serverless SDP (`PY4J_BLOCKED_API`). Use an `information_schema.tables` query instead.
* `TIMESTAMP_NTZ` columns in streaming tables need `delta.feature.timestampNtz = supported` in `table_properties`.
* Statement Execution `wait_timeout` must be 0 or 5–50 s. Poll for longer statements.
* An empty-string job parameter is not "missing": `dbutils.widgets.get` returns `""`, so handle empty strings explicitly.

## Project Structure

```
ground-truth-infra/
├── databricks.yml
├── PROJECT_MEMORY.md
├── resources/
│   ├── jobs/                        (.job.yml files — one per job, incl. cdf_bronze_refresh)
│   ├── pipelines/                   (cdf_bronze SDP pipeline)
│   ├── dashboards/                  (executive.dashboard.yml)
│   ├── secrets/                     (ground_truth_scope.secret_scope.yml)
│   ├── lakebase/                    (5 files — project, branches, role, db)
│   ├── ground_truth_schema.schema.yml
│   └── infra_warehouse.warehouse.yml
├── src/
│   ├── notebooks/                   (Python notebooks: setup_cdf_config, list_fixtures, deploy_metric_view, etc.)
│   ├── lib/
│   │   ├── lakebase_cdf.py              (CDF config helpers)
│   │   └── cdf_bronze/                  (CdfBronzeBuilder metadata-driven pipeline)
│   ├── pipelines/                   (SDP pipeline notebook for cdf_bronze)
│   └── dashboards/                  (executive.lvdash.json)
├── fixtures/
│   ├── metric_views/                (7 mv_*.yaml — deployed by metric_view_deploy job)
│   ├── pipelines/                   (cdf_bronze_tables.yaml — table config for bronze flows)
│   └── prompts/                     (feedback_loop_prompt.md — registered as UC skill)
└── docs/
    ├── plans/                       (infra_build_plan.md)
    ├── runbooks/                    (unity-gateway-setup.md)
    └── sessions/                    (session summaries + INDEX.md)
```

## Related Bundles

* **ground-truth-app** (Bundle 2) — Node.js AppKit + React + MCP Server. Deploys after this bundle.
* **ground-truth-agent** (Bundle 3) — Operational Genie Agent over CDF metric views. Deploys after this bundle.

## Design Sources

All design documents are at the solution root (`../docs/design/`):

* L100 §Deployment Architecture, §Bundle 1
* L200-C1 (Asset Registry), L200-C6 (Feedback Pipeline), L200-C9 (Operational Genie Agent)
* L300-01 through L300-08 (implementation specs)
