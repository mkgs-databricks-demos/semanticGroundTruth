# 04 — Infra: metric views over bronze

**Wave 0 · edit · owns `ground-truth-infra/fixtures/metric_views/**`, `ground-truth-infra/src/notebooks/deploy_metric_view.py`, `ground-truth-infra/src/notebooks/list_fixtures.py`, `ground-truth-infra/resources/jobs/metric_view_deploy.job.yml`**

## Context
* Current fixtures (`mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`) reference `lb_*_history` tables with wrong columns (`vote_id`, `reviewer_id`, `display_name`, `team`, `batch_id`, `_change_type`, ...). Rewrite them against `bronze_lakebase_cdf` (build_conventions §7–§8).
* Real columns: read `ground-truth-app/server/migrations/001_core_schema.ts` … `005_app_state.ts`. user_activity = `user_id, email, total_votes, current_streak_days, longest_streak_days, last_vote_date, badges (array), updated_at`; feedback_batches = `id, ..., processing_time_seconds, triggered_by, branch_name` (no `error_message`).
* The agent bundle no longer deploys metric views; this job is the only deployer.

## Steps
1. Rewrite the 4 fixtures; add `mv_campaign_progress` (campaigns + campaign_assets latest state: campaigns by status/type, assets per campaign, completion %) and the two operational views from the former agent plan: `mv_otel_error_rate` (over `semantic_ground_truth_otel_logs`) and `mv_otel_request_latency` (over `semantic_ground_truth_otel_spans`, SERVER spans).
2. Each fixture keeps the existing format consumed by `deploy_metric_view.py` (check it first); YAML `version: 1.1`, `source` is a SQL query per §8 with typed columns, every measure/dimension has `comment` and `synonyms`.
3. Update `deploy_metric_view.py` if needed so it substitutes `${catalog}`/`${schema}`, executes on the warehouse, and verifies with `DESCRIBE TABLE EXTENDED ... AS JSON`. Keep `.py` paths in the job YAML.
4. Add `validate_only` parameter to the job (default `false`) that runs `EXPLAIN` on each source query instead of creating the view.

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-infra`.
* `grep -E "vote_id|reviewer_id|display_name|_change_type[^_]|batch_id|error_message|lb_[a-z_]+_history" fixtures/metric_views` returns nothing (bronze is the only source besides OTel tables).
* 7 fixture files exist.
