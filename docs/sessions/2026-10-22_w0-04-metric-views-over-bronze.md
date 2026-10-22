# Session 04 — Infra: metric views over bronze

**Wave:** 0 | **Mode:** edit | **Run:** 991892831639332 | **Date:** 2026-10-22

## Summary

Rewrote all 4 existing metric view fixtures and added 3 new ones so every fixture queries `bronze_lakebase_cdf` (or the OTel tables) with correct column names from migrations 001–006. Updated the deploy notebook to execute via the Databricks SDK Statement Execution API on the SQL warehouse, verify with `DESCRIBE TABLE EXTENDED ... AS JSON`, and support a `validate_only` mode. Added the `validate_only` job parameter.

## Problems & Root Causes

* The 4 existing fixtures (`mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`) referenced non-existent `lb_*_history` tables with wrong column names (`vote_id`, `reviewer_id`, `display_name`, `team`, `edits_accepted`, `streak_days`, `badge_count`, `batch_id`, `error_message`, `_change_type`).
* The deploy notebook used `spark.sql()` instead of the warehouse, had no verification step, and lacked a validation-only mode.

## Changes

### Fixture rewrites (4 files)

| Fixture | Source Table | Pattern | Key Column Fixes |
|---|---|---|---|
| `mv_review_activity` | `votes` (event) | No windowing, `_source_table = 'votes'` | `vote_id` → `id`, `reviewer_id` → `user_id`, `comment` → `feedback` |
| `mv_coverage_metrics` | `assets` (state) | QUALIFY ROW_NUMBER + exclude delete | `asset_id` → `id`, removed `display_name` column |
| `mv_user_leaderboard` | `user_activity` (state) | QUALIFY ROW_NUMBER + exclude delete | `display_name` → `email`, `total_reviews` → `total_votes`, `streak_days` → `current/longest_streak_days`, removed `team`/`edits_accepted`/`badge_count` |
| `mv_feedback_pipeline` | `feedback_batches` (state) | QUALIFY ROW_NUMBER + exclude delete | `batch_id` → `id`, removed `error_message`, `completed_at` added |

All 4 now use `data:col::TYPE` extracts from `bronze_lakebase_cdf`, `_pg_change_type`, `CREATE OR REPLACE VIEW`, `NULLIF` for division safety.

### New fixtures (3 files)

| Fixture | Source | Description |
|---|---|---|
| `mv_campaign_progress` | `bronze_lakebase_cdf` (campaigns) | Campaigns by status/type, assets per campaign, completion % |
| `mv_otel_error_rate` | `semantic_ground_truth_otel_logs` | Error/FATAL log rate by severity, route, date |
| `mv_otel_request_latency` | `semantic_ground_truth_otel_spans` | SERVER span latency: avg, P50/P95/P99, error rate |

### Deploy notebook (`deploy_metric_view.py`)

* Added `warehouse_id` and `validate_only` parameters
* Replaced `spark.sql()` with `WorkspaceClient().statement_execution.execute_statement()` on the warehouse
* Added `DESCRIBE TABLE EXTENDED ... AS JSON` verification after deploy
* `validate_only=true` extracts the source query from the `$$` delimiters and runs `EXPLAIN`
* Uncommented pip install cell (SDK + pyyaml)

### Job YAML (`metric_view_deploy.job.yml`)

* Added `parameters: [{name: validate_only, default: "false"}]` at job level
* Passed `validate_only: "{{job.parameters.validate_only}}"` to deploy_single_view task
* Updated task description

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | pass |
| grep for `vote_id`, `reviewer_id`, `batch_id`, `error_message` | pass (none found) |
| grep for `data:display_name` | pass (none found) |
| grep for `lb_*_history` | pass (none found) |
| 7 fixture files exist | pass |
| `_pg_change_type` used (not `_change_type`) | pass |

## Decisions

* `display_name` column removed from `mv_coverage_metrics` source query to satisfy the gate check; `asset_name` (from `data:name`) is sufficient.
* Vote type values use lowercase (`approve`, `reject`, `edit`) matching the Postgres CHECK constraint.
* Feedback batch status uses lowercase (`pending`, `completed`, `failed`) matching the Postgres DEFAULT.
* OTel metric views query the raw OTel tables directly (not bronze) since they are not CDF-sourced.
* `CREATE OR REPLACE VIEW` instead of `CREATE VIEW IF NOT EXISTS` to support redeployment.

## Files Modified

* `ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml` (rewritten)
* `ground-truth-infra/fixtures/metric_views/mv_coverage_metrics.yaml` (rewritten)
* `ground-truth-infra/fixtures/metric_views/mv_user_leaderboard.yaml` (rewritten)
* `ground-truth-infra/fixtures/metric_views/mv_feedback_pipeline.yaml` (rewritten)
* `ground-truth-infra/fixtures/metric_views/mv_campaign_progress.yaml` (new)
* `ground-truth-infra/fixtures/metric_views/mv_otel_error_rate.yaml` (new)
* `ground-truth-infra/fixtures/metric_views/mv_otel_request_latency.yaml` (new)
* `ground-truth-infra/src/notebooks/deploy_metric_view.py` (updated: SDK execution, warehouse, validate_only)
* `ground-truth-infra/resources/jobs/metric_view_deploy.job.yml` (updated: validate_only parameter)
