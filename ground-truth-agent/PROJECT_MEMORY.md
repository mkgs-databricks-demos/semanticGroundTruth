# Project Memory — ground-truth-agent (Bundle 3)

## Bundle Identity
- **Bundle name:** `ground-truth-agent`
- **Bundle root:** `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-agent`
- **Part of:** `semanticGroundTruth` monorepo (3-bundle project: infra → app → agent)
- **Deploy order:** Bundle 1 (infra) → Bundle 2 (app) → Bundle 3 (agent, this bundle)
- **Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)
- **Catalog (dev):** `hls_fde_dev`
- **Schema (dev):** `dev_matthew_giglia_semantic_ground_truth`
- **Feature branch:** `mg-genie-agent-build` (from main at `6af87be`)

## Component
C9 — Operational Genie Agent. Conversational analytics over the Ground Truth App’s own usage data. Executives and admins ask questions about reviewer activity, coverage progress, certification rates, and ROI. Backed by metric views over Lakehouse Sync CDF tables and OTel telemetry.

## DAB Resource
- **Resource type:** `genie_spaces` (requires `engine: direct` — already set in `databricks.yml`)
- **Resource key:** `ground_truth_ops`
- **Agent title:** `Ground Truth Operations`
- **Definition file:** `ground_truth_ops.geniespace.json` (version 2 format)
- **Warehouse:** infra bundle warehouse (passed as `var.warehouse_id`)
- **Permissions:** CAN_RUN for users
- **Added in Databricks CLI 1.3.0**

## Variables (dev defaults)
| Variable | Dev default |
|---|---|
| `catalog` | `hls_fde_dev` |
| `schema_name` | `dev_matthew_giglia_semantic_ground_truth` |
| `warehouse_id` | Infra warehouse ID (look up from infra bundle) |
| `app_display_name` | `Ground Truth Operations` |

## Data Sources

### Business metric views (4, from infra YAML fixtures)
Source fixtures: `ground-truth-infra/fixtures/metric_views/mv_*.yaml`
Deployed by: `deploy_metric_views` job in this bundle

| Metric view | Source CDF table | Key measures |
|---|---|---|
| `mv_review_activity` | `lb_votes_history` | Total Votes, Unique Reviewers, Approval Rate |
| `mv_coverage_metrics` | `lb_assets_history` | Total Assets, Reviewed Assets, Coverage Pct, Certification Pct |
| `mv_user_leaderboard` | `lb_user_activity_history` | Total Reviews, Edits Accepted, Current Streak Days |
| `mv_feedback_pipeline` | `lb_feedback_batches_history` | Total Batches, Success Rate, Avg Processing Time |

### Operational metric views (2, new — created by this bundle)
| Metric view | Source table | Key measures |
|---|---|---|
| `mv_otel_error_rate` | `semantic_ground_truth_otel_logs` | Error Count, Total Logs, Error Rate by severity/time |
| `mv_otel_request_latency` | `semantic_ground_truth_otel_spans` | p50/p95/p99 latency by operation/time |

## Key Concepts (for agent instructions)
- **Coverage %** = assets with at least 1 vote / total assets
- **Certification %** = assets above Wilson score threshold / total assets
- **Wilson score** = confidence metric penalizing small sample sizes
- **Freshness** = how recently a production asset was re-validated
- **Approval Rate** = approvals / total votes
- **ROI framing:** time saved vs. manual review, coverage velocity, quality improvement
- **MEASURE() syntax** required for all metric view queries in Genie Agent

## Infra Dependencies
- `lb_*_history` Lakehouse Sync tables (created after app deploys + Lakehouse Sync runs)
- `semantic_ground_truth_otel_*` tables (already exist as of 2026-10-21)
- SQL warehouse from infra bundle
- UC schema `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`

## Build Status
- **2026-10-21:** Planning session complete. Feature branch `mg-genie-agent-build` created from main. Plan files written for sessions 01–03. Waves 0–1 manifest committed.
- **2026-10-23:** Root build waves 0–4 complete. Genie space deployed, 9 data sources (7 metric views + 2 OTel tables), verification job passing (11/11 checks), 2/2 probe questions returning SQL.

## Build Results (root manifest waves 0–4)

The agent bundle was built as part of the root manifest (`docs/plans/waves.json`), not the agent-local `waves.json`.

- **Wave 0 (sessions 05, 06):** Bundle config with variables/targets, Genie space resource + `ground_truth_ops.geniespace.json`, verification job + notebook.
- **Wave 4 (session 14, converge):** Deployed space, fixed geniespace JSON structure (instructions to top level, array fields, sorted tables/metric_views), fixed verification notebook (measure discovery, title matching, API field names). 4 attempts, final = stable.

### Converge fixes (session 14)
- `geniespace.json`: instructions moved from `config` to top level; `question`/`sql`/`content` fields wrapped in arrays; tables sorted alphabetically; metric views in `data_sources.metric_views`.
- `agent_verification.ipynb`: measure discovery via `columns.is_measure` (not `measures[]`); title matching via `endswith` (handles dev prefix); `space_id` and `attachment_id` API field names.

## Known Risks (updated)
1. **Lakehouse Sync tables don’t exist yet** — require app to deploy and run migrations first.
2. **Column drift** — infra metric view fixtures reference columns designed before app migrations were finalized. Converge session (03) must inspect actual `lb_*_history` schemas and fix.
3. **Agent benchmarking (L300-15)** is a manual follow-up, not automated in this build.
4. **Branch cross-contamination** — initial commit picked up 16 stray app code files from workspace git state when switching branches. Cleanup needed before PR.

## Open Questions (resolved)
- ~~Infra warehouse ID~~ — `0ea84986a23a47c3`, passed as `var.warehouse_id` in targets.
- ~~Genie space ID as output~~ — Not needed; the verification job discovers the space by title.
