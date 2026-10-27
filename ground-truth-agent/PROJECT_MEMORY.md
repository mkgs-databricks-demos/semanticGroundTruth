# Project Memory — ground-truth-agent (Bundle 3)

## Bundle Identity
- **Bundle name:** `ground-truth-agent`
- **Bundle root:** `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-agent`
- **Part of:** `semanticGroundTruth` monorepo (3-bundle project: infra → app → agent)
- **Deploy order:** Bundle 1 (infra) → Bundle 2 (app) → Bundle 3 (agent, this bundle)
- **Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)
- **Catalog (dev):** `hls_fde_dev`
- **Schema (dev):** `dev_matthew_giglia_semantic_ground_truth`
- **Feature branch:** current build branch `mg-genie-build-4` (earlier: `mg-genie-agent-build` from main at `6af87be`, `mg-genie-ui-brand-and-gaps`)
- **Genie space id (dev):** `01f1ceb0506f1c5d9f2024bfc5f95943`
- **Operations dashboard id (dev):** `01f1d17bf9531f5ba79f838a0da0df35` (published 2026-10-26 20:29 UTC)
- **Verification job (dev):** `agent_verification` `930756362224750`; latest run `312880880434652` = 29/29 checks (session 39)

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

### Operations dashboard (build 4, session 29)
| Field | Value |
|---|---|
| Resource | `dashboards.ops_dashboard` in `resources/ops_dashboard.dashboard.yml` |
| Display name | `${var.ops_dashboard_title}` = `Semantic Ground Truth — Operations` (dev adds `[dev matthew_giglia] `) |
| Definition | `src/dashboards/operations.lvdash.json` — a workspace `DASHBOARD` object: the file edit tools cannot open it; write it with the Workspace import API (same as the infra executive dashboard) |
| Warehouse | `${var.warehouse_id}`; `embed_credentials: false`; `dataset_catalog` / `dataset_schema` from `var.catalog` / `var.schema_name` |
| Audience | Stewards / project owner, day-to-day (the infra executive dashboard stays leadership-facing) |
| Pages | Review Queue Health, Campaigns, Feedback Loop, App Health, global Filters (date range `date_range` RANGE parameter default `now-30d/d`..`now/d`; campaign and asset type field filters) |
| Datasets | 17, only `MEASURE()` over the 7 metric views; skip measures `skips`, `skip_rate`, `skip_reason` (dim), `total_skips` from session 28 |
| Verification | `agent_verification` cell "Verify operations dashboard…": exists + published, every dataset runs `SELECT * FROM (<q>) LIMIT 1` with RANGE defaults inlined (the wave gate skips RANGE-parameter datasets) |
| Converge | Session 39 (wave 4-7): attempt 1 stable, no code changes needed; 17/17 datasets pass `EXPLAIN` (RANGE defaults inlined), `agent_verification` 29/29. Session 37 deployed the skip measures first |
| Open (follow-up 4) | 3 datasets (`ds_votes_skips_daily`, `ds_skips_by_campaign`, `ds_top_skipped_assets`) select raw BINARY `campaign_id` / `asset_id` (unreadable; also break pandas/Arrow). UUID-string SQL tested 2026-10-27 (identical results, same aliases, `asset_id` tie-break for the top 10) but not applied: the Workspace import with overwrite was blocked by the agent safety layer. SQL in `../docs/requests/2026-10-27_build-4-follow-ups.md` |

Known metric-view limits (dashboard shows the closest available view): `mv_review_activity` has no `asset_type`, so skip rate by asset type is not possible (the page shows the queue by asset type from `mv_coverage_metrics`); `mv_campaign_progress` has no campaign id / name, due date or reviewer assignment, so campaign rows are by type / domain / rule and per-campaign reviewers use `campaign_id` from `mv_review_activity`; `mv_feedback_pipeline` has no `branch_name` dimension, so the latest branch name is not shown (latest batches table shows asset counts).

## Variables (dev defaults)
| Variable | Dev default |
|---|---|
| `catalog` | `hls_fde_dev` |
| `schema_name` | `dev_matthew_giglia_semantic_ground_truth` |
| `warehouse_id` | Infra warehouse ID (look up from infra bundle) |
| `space_title` | `Ground Truth Operations` |
| `ops_dashboard_title` | `Semantic Ground Truth — Operations` |

## Data Sources

### Business metric views (5, from infra YAML fixtures)
Source fixtures: `ground-truth-infra/fixtures/metric_views/mv_*.yaml`
Deployed by: the infra `metric_view_deploy` job (not this bundle). All read `bronze_lakebase_cdf` filtered by `_source_table`.

| Metric view | Source (`_source_table`) | Key measures |
|---|---|---|
| `mv_review_activity` | `votes` + `review_skips` (build 4) | Total Votes, Unique Reviewers, Approval Rate, `skips`, `skip_rate`; dim `skip_reason` |
| `mv_coverage_metrics` | `assets` | Total Assets, Reviewed Assets, Coverage Pct, Certification Pct |
| `mv_user_leaderboard` | `user_activity` | Total Reviews, Edits Accepted, Current Streak Days, `total_skips` |
| `mv_feedback_pipeline` | `feedback_batches` | Total Batches, Success Rate, Avg Processing Time |
| `mv_campaign_progress` | `campaigns`, `campaign_assets` | Active Campaigns, Completion Pct |

### Operational metric views (2, also infra fixtures)
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
- **2026-10-24:** Brand + gaps build: `agent_verification` regression run `149451153256513` SUCCESS (session 22c).
- **2026-10-26:** Build 4 complete for this bundle. Session 29 added the operations dashboard (G11 partial) and dashboard checks in `agent_verification`; session 39 deployed and verified it (29/29). Lakehouse Monitoring on bronze is still deferred.
- **2026-10-27:** Build 4 `BUILD_PASSED` (run `655172288447819`; wave 4-7 commit `6d26b3f`). Dashboard id formatting deferred (follow-up 4); no agent bundle changes in the close-out session.

## Build Results (root manifest waves 0–4)

The agent bundle was built as part of the root manifest (`docs/plans/waves.json`), not the agent-local `waves.json`.

- **Wave 0 (sessions 05, 06):** Bundle config with variables/targets, Genie space resource + `ground_truth_ops.geniespace.json`, verification job + notebook.
- **Wave 4 (session 14, converge):** Deployed space, fixed geniespace JSON structure (instructions to top level, array fields, sorted tables/metric_views), fixed verification notebook (measure discovery, title matching, API field names). 4 attempts, final = stable.

### Converge fixes (session 14)
- `geniespace.json`: instructions moved from `config` to top level; `question`/`sql`/`content` fields wrapped in arrays; tables sorted alphabetically; metric views in `data_sources.metric_views`.
- `agent_verification.ipynb`: measure discovery via `columns.is_measure` (not `measures[]`); title matching via `endswith` (handles dev prefix); `space_id` and `attachment_id` API field names.

## Known Risks (updated)
1. ~~**Lakehouse Sync tables don’t exist yet**~~ — resolved; 23 `lb_*_history` tables feed bronze (21 + `review_skips`, `user_settings` from build 4).
2. **Column drift** — when an app migration changes a table, check the metric views and the dashboard datasets with `EXPLAIN` (the `agent_verification` dashboard cell does this).
3. **Agent benchmarking (L300-15)** is a manual follow-up, not automated in this build.
4. **Branch cross-contamination** — initial commit picked up 16 stray app code files from workspace git state when switching branches. Cleanup needed before PR.

## Open Questions (resolved)
- ~~Infra warehouse ID~~ — `0ea84986a23a47c3`, passed as `var.warehouse_id` in targets.
- ~~Genie space ID as output~~ — Not needed; the verification job discovers the space by title.
