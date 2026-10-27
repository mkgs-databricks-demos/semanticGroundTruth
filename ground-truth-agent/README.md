# ground-truth-agent

Bundle 3 of 3 for the **Semantic Ground Truth App**. Deploys the Ground Truth Operations Genie Agent — a conversational analytics space over the app's Lakebase CDF data and OTel telemetry — and the steward-facing Operations AI/BI dashboard.

> Deploy [ground-truth-infra](../ground-truth-infra/) and [ground-truth-app](../ground-truth-app/) first.

## What This Bundle Deploys

| Resource | Type | Description |
|----------|------|-------------|
| Genie Space | `genie_spaces` | `Ground Truth Operations` — 9 data sources (7 metric views + 2 OTel tables), curated instructions + example SQL |
| Operations Dashboard | `dashboards` | `ops_dashboard` — `Semantic Ground Truth — Operations` (dev: `[dev matthew_giglia] ` prefix). Pages: Review Queue Health (votes vs skips, skip rate by campaign, top 10 most-skipped assets, skip reasons, queue by asset type), Campaigns, Feedback Loop, App Health (24 h / 7 d error rate, p50/p95 latency), plus a global Filters page (date range default last 30 days, campaign, asset type) and a link to the Genie space. 17 datasets, all `MEASURE()` queries over the 7 metric views. `embed_credentials: false`. |
| Verification Job | `jobs` | `agent_verification` — space config, data source resolution, example SQL EXPLAIN, probe questions, and the operations dashboard (exists, published, every dataset executes with default parameters) |

## Data Sources

### Business metric views (over `bronze_lakebase_cdf`)

| Metric View | Source | Key Measures |
|---|---|---|
| `mv_review_activity` | votes, review_skips | Total Votes, Unique Reviewers, Approval Rate, Skips, Skip Rate (a skip is not a vote) |
| `mv_coverage_metrics` | assets | Total Assets, Reviewed Count, Coverage Pct, Certification Pct |
| `mv_user_leaderboard` | user_activity | Total Reviews, Edits Accepted, Current Streak, Total Skips |
| `mv_feedback_pipeline` | feedback_batches | Total Batches, Success Rate, Avg Processing Time |
| `mv_campaign_progress` | campaigns, campaign_assets | Active Campaigns, Completion Pct |

### Operational metric views

| Metric View | Source | Key Measures |
|---|---|---|
| `mv_otel_error_rate` | `semantic_ground_truth_otel_logs` | Error Count, Error Rate by severity/time |
| `mv_otel_request_latency` | `semantic_ground_truth_otel_spans` | p50/p95/p99 Latency by operation |

## Targets

| Target | Catalog | Mode |
|--------|---------|------|
| `dev` (default) | `hls_fde_dev` | Development — space prefixed `[dev matthew_giglia]` |
| `prod` | `prod_ground_truth` | Production |

## Deploy

```bash
# Validate
databricks bundle validate --strict --target dev

# Deploy (creates/updates the Genie space and the operations dashboard)
databricks bundle deploy --target dev

# Run verification
databricks bundle run agent_verification --target dev
```

Dev IDs: Genie space `01f1ceb0506f1c5d9f2024bfc5f95943`, operations dashboard `01f1d17bf9531f5ba79f838a0da0df35` (open `<workspace>/dashboardsv3/01f1d17bf9531f5ba79f838a0da0df35/published`). Latest verification: run `312880880434652`, 29/29 checks (build 4, session 39).

The metric views are deployed by the infra bundle (`metric_view_deploy`). If you add a measure the dashboard uses, deploy infra and run `metric_view_deploy` first, then deploy this bundle. Full order: [Deploy order and permissions](../docs/runbooks/deploy_order_and_permissions.md).

## Project Structure

```
ground-truth-agent/
├── databricks.yml                          # Bundle config (variables, targets, engine: direct)
├── ground_truth_ops.geniespace.json         # Genie space definition (v2 serialized_space format)
├── resources/
│   ├── ground_truth_ops.genie_space.yml     # Genie space resource
│   ├── ops_dashboard.dashboard.yml          # Operations AI/BI dashboard resource
│   └── jobs/
│       └── agent_verification.job.yml       # Verification job
├── src/
│   ├── dashboards/
│   │   └── operations.lvdash.json           # Operations dashboard definition (workspace DASHBOARD object)
│   └── notebooks/
│       └── agent_verification.ipynb         # Verification notebook (space + dashboard checks)
└── docs/
    ├── plans/                              # Build plans + waves.json (superseded by root manifest)
    └── sessions/                           # Session summaries
```

## Related Bundles

* **ground-truth-infra** (Bundle 1) — UC schema, Lakebase, SQL warehouse, CDF, bronze pipeline, metric view fixtures.
* **ground-truth-app** (Bundle 2) — Node.js AppKit app + React + MCP Server.

## Design Sources

* L200-C9 (Operational Genie Agent)
* L300-14 (Genie Agent creation)
* L300-15 (Bundle 3 deploy)
