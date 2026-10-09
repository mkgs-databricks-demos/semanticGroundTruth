# ground-truth-infra

Bundle 1 of 3 for the **Semantic Ground Truth App**. Deploys all shared infrastructure that the App (Bundle 2) and Agent (Bundle 3) depend on.

## What This Bundle Deploys

| Resource | Type | Description |
|----------|------|-------------|
| UC Schema | `${var.catalog}.${var.schema}` | Shared schema for all app data and metric views |
| SQL Warehouse | Serverless PRO, 2X-Small | Metric view queries, sample aggregations, Genie Agent compute |
| Lakebase Project | Postgres (DAB-declared) | App state database — project, branches, endpoint, role, database |
| Synced Tables | 6 CDF tables (DAB-declared) | assets, votes, user_activity, confidence_scores, campaigns, feedback_batches → Delta in UC |
| Lakeflow Jobs | 4 jobs | feedback_pipeline (daily), freshness_resurfacing (daily), metric_view_deploy, post_deploy_validation |
| Metric View Fixtures | 4 YAMLs | mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline |
| UC Secrets | 3 secrets | slack_webhook_url, teams_webhook_url, git_token |
| Unity Gateway | HTTP connection | ground-truth-mcp (placeholder; updated by Bundle 2) |
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

# Deploy metric views
databricks bundle run metric_view_deploy --target dev
```

## Build Plan

See [`docs/plans/infra_build_plan.md`](docs/plans/infra_build_plan.md) for the detailed 8-phase build plan:

1. Bundle Configuration (variables, schema resource)
2. Lakebase Project + Schema (DAB-declared)
3. SQL Warehouse + UC Secrets + Notifications
4. Lakeflow Jobs (5 notebooks + 4 job definitions)
5. Metric View Fixtures (4 YAMLs over CDF tables)
6. Genie Code Skills (feedback loop prompt)
7. Unity Gateway Connection
8. Deploy + Validate

## Project Structure

```
ground-truth-infra/
├── databricks.yml
├── PROJECT_MEMORY.md
├── resources/
│   ├── jobs/                        (4 .job.yml files — one per job)
│   ├── lakebase/                    (5 files — project, branches, role, db)
│   ├── ground_truth_schema.schema.yml
│   └── infra_warehouse.warehouse.yml
├── src/
│   └── notebooks/                   (6 Python notebooks)
├── fixtures/
│   ├── metric_views/                (4 mv_*.yaml — deployed by metric_view_deploy job)
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
