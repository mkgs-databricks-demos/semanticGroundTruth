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
| Lakeflow Jobs | 6 jobs | feedback_pipeline (daily), freshness_resurfacing (daily), metric_view_deploy, post_deploy_validation, setup_lakebase_cdf, M2M SPN setup |
| Metric View Fixtures | 7 YAMLs | mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency |
| UC Secrets | 3 secrets | slack_webhook_url, teams_webhook_url, git_token |
| Unity Gateway | HTTP connection | ground-truth-mcp (schema-level; updated by Bundle 2) |
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
* **CDF / bronze / metric views (2026-10-23):** built by the solution-root manifest [`../docs/plans/waves.json`](../docs/plans/waves.json). See sessions 02, 03, 04 (edit) and 13 (converge) in [`../docs/sessions/INDEX.md`](../docs/sessions/INDEX.md).

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
│   ├── jobs/                        (6 .job.yml files — one per job)
│   ├── pipelines/                   (cdf_bronze SDP pipeline)
│   ├── lakebase/                    (5 files — project, branches, role, db)
│   ├── ground_truth_schema.schema.yml
│   └── infra_warehouse.warehouse.yml
├── src/
│   ├── notebooks/                   (Python notebooks: setup_cdf_config, list_fixtures, deploy_metric_view, etc.)
│   ├── lib/
│   │   ├── lakebase_cdf.py              (CDF config helpers)
│   │   └── cdf_bronze/                  (CdfBronzeBuilder metadata-driven pipeline)
│   └── pipelines/                   (SDP pipeline notebook for cdf_bronze)
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
