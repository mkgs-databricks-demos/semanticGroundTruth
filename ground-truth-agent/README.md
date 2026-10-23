# ground-truth-agent

Bundle 3 of 3 for the **Semantic Ground Truth App**. Deploys the Ground Truth Operations Genie Agent — a conversational analytics space over the app's Lakebase CDF data and OTel telemetry.

> Deploy [ground-truth-infra](../ground-truth-infra/) and [ground-truth-app](../ground-truth-app/) first.

## What This Bundle Deploys

| Resource | Type | Description |
|----------|------|-------------|
| Genie Space | `genie_spaces` | `Ground Truth Operations` — 9 data sources (7 metric views + 2 OTel tables), curated instructions + example SQL |
| Verification Job | `jobs` | `agent_verification` — 11 checks: space config, data source resolution, example SQL EXPLAIN, probe questions |

## Data Sources

### Business metric views (over `bronze_lakebase_cdf`)

| Metric View | Source | Key Measures |
|---|---|---|
| `mv_review_activity` | votes | Total Votes, Unique Reviewers, Approval Rate |
| `mv_coverage_metrics` | assets | Total Assets, Reviewed Count, Coverage Pct, Certification Pct |
| `mv_user_leaderboard` | user_activity | Total Reviews, Edits Accepted, Current Streak |
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

# Deploy (creates/updates the Genie space)
databricks bundle deploy --target dev

# Run verification
databricks bundle run agent_verification --target dev
```

## Project Structure

```
ground-truth-agent/
├── databricks.yml                          # Bundle config (variables, targets, engine: direct)
├── ground_truth_ops.geniespace.json         # Genie space definition (v2 serialized_space format)
├── resources/
│   ├── ground_truth_ops.genie_space.yml     # Genie space resource
│   └── jobs/
│       └── agent_verification.job.yml       # Verification job
├── src/
│   └── notebooks/
│       └── agent_verification.ipynb         # 11-check verification notebook
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
