# Session 05 — Agent bundle config + Genie space resource

**Wave:** 0 · **Mode:** edit · **Date:** 2026-10-22 · **Run:** 991892831639332

## Summary

Configured the `ground-truth-agent` bundle with variables and the `genie_spaces` resource for the Ground Truth Operations agent. Created the geniespace JSON definition with 9 data sources (7 metric views + 2 OTel tables), curated instructions, 8 sample questions, and 6 example SQL queries using MEASURE() syntax.

## Problems & Root Causes

None — clean implementation.

## Changes

### `ground-truth-agent/databricks.yml` (edited)
- Added 4 variables: `catalog`, `schema_name`, `warehouse_id`, `space_title` with dev defaults.
- Updated dev target: added `root_path` matching other bundles.
- Updated prod target: added variable overrides (with placeholder warehouse_id).
- Updated header comments with design source references.

### `ground-truth-agent/resources/ground_truth_ops.genie_space.yml` (created)
- `genie_spaces.ground_truth_ops` resource: title via `${var.space_title}`, warehouse via `${var.warehouse_id}`, file_path to `../ground_truth_ops.geniespace.json`, `CAN_RUN` for users.

### `ground-truth-agent/ground_truth_ops.geniespace.json` (created)
- Version 2 format.
- 9 data sources: mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency, semantic_ground_truth_otel_logs, semantic_ground_truth_otel_spans.
- Text instructions: agent persona, key concepts (Coverage %, Certification %, Wilson score, Freshness, Approval Rate), data source descriptions, MEASURE() query guidance, ROI framing.
- 8 sample questions covering review activity, coverage, leaderboard, pipeline health, and OTel errors.
- 6 example SQL queries with MEASURE() syntax against the 4 business metric views.

## Decisions

1. **Dev title prefix:** Dev mode adds `[dev matthew_giglia] ` prefix automatically. Default `space_title` set to `Ground Truth Operations` (not the prefixed version).
2. **Schema variable is fully expanded:** Unlike infra bundle (which uses dev-mode schema prefix), agent uses `dev_matthew_giglia_semantic_ground_truth` directly because geniespace JSON table identifiers need the full FQN.
3. **No column_configs on metric views:** Metric view definitions already provide semantic metadata. No column_configs on OTel tables either — agent discovers columns from table schema.
4. **Example SQL uses existing measure names:** Used measure names from current fixtures (Total Votes, Approval Rate, Total Reviews, etc.) which session 04 is expected to preserve through the rewrite.

## Assumptions (parallel sessions)

- Session 04 (wave 0): 3 new metric view fixtures (mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency) referenced in geniespace JSON but not yet created. No example SQL written against them. Measure names for the 4 existing views assumed stable through the rewrite (Total Votes, Unique Reviewers, Approval Rate, Total Reviews, Streak Days, etc.).
- Session 04 dimension names: Used `user_id`, `email` for mv_user_leaderboard per migration columns, not the current fixture's `display_name`/`team`.

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | pass |
| geniespace.json parses as JSON | pass |
| All 9 tables in allowed set | pass |
| Example SQL uses MEASURE() only | pass |
| No lb_*_history references in example SQL | pass |
| Dev mode title prefix = `[dev matthew_giglia] Ground Truth Operations` | pass |

## Requests for Other Sessions

None.
