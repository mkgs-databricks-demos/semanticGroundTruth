# Session 03: Converge — deploy agent, create metric views, verify (Wave 1)

## Scope
Deploy the agent bundle, ensure Lakehouse Sync tables exist, create metric views (fixing column drift if needed), deploy the Genie Agent, and verify it can answer questions. Repeat until all checks pass.

## Context
* **Part A dependency:** The app (Bundle 2) must be deployed and running with a successful post-deploy job. Lakehouse Sync must have created the `lb_*_history` tables. Part A wave 8 should have passed.
* **Lakehouse Sync timing:** After the app’s Lakebase tables are created by migrations, Lakehouse Sync creates corresponding Delta tables (`lb_<table>_history`) in the UC schema. This can take 1–15 minutes. The session must wait/retry if tables are missing.
* **Column drift risk:** The infra metric view fixtures (`mv_*.yaml`) were designed before the app’s actual schema was finalized. The converge session must:
  1. Inspect `lb_*_history` table schemas with `DESCRIBE TABLE`.
  2. Compare column names to those referenced in the metric view DDL.
  3. Fix any mismatches by editing the fixture SQL or the notebook’s DDL.
* **OTel metric views** don’t depend on Lakehouse Sync — they can be created immediately.
* **Genie Agent deploy:** `bundle deploy --target dev` creates the Genie Agent. The agent’s `genie_space_id` is available from `bundle summary`.
* **Verification checks:**
  1. `lb_*_history` tables exist (at least: `lb_votes_history`, `lb_assets_history`).
  2. All 6 metric views exist (`SHOW VIEWS ... LIKE 'mv_%'`).
  3. Each metric view is queryable (`SELECT MEASURE(...) ...` returns without error).
  4. Genie Agent is accessible via API.
  5. `bundle validate --strict --target dev` passes.

## Known blockers
* **No Lakehouse Sync tables yet:** As of the planning session, `lb_*` tables don’t exist. They require the app to have run migrations and data to have flowed through Lakehouse Sync.
* **Metric view column drift:** The infra fixtures reference columns like `vote_type`, `reviewer_id`, `asset_type`, `status`, `total_votes`, `confidence_score`, `certification_threshold`. These may not match actual column names in the Lakehouse Sync tables.
* **OTel metric views are new:** No existing OTel metric views — the DDL is written fresh by session 02.

## Tasks
1. Run `bundle deploy --target dev`.
2. Check for `lb_*_history` tables: `SELECT table_name FROM hls_fde_dev.information_schema.tables WHERE table_schema = 'dev_matthew_giglia_semantic_ground_truth' AND table_name LIKE 'lb_%'`. If empty, wait up to 15 minutes and retry.
3. For each `lb_*_history` table, run `DESCRIBE TABLE` and compare columns to the metric view DDL. Fix any drift.
4. Run the `deploy_metric_views` job: `bundle run deploy_metric_views --target dev`.
5. Verify metric views: query each with a simple `SELECT MEASURE(...) LIMIT 1`.
6. Extract the Genie Agent `genie_space_id` from `bundle summary`.
7. Run the `agent_verification` job: `bundle run agent_verification --target dev` with the `genie_space_id`.
8. If any check fails, diagnose, fix owned files, redeploy, and retry.

## Acceptance Criteria
- [ ] `lb_*_history` tables exist in the dev schema.
- [ ] 6 metric views (`mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`, `mv_otel_error_rate`, `mv_otel_request_latency`) exist and are queryable.
- [ ] Genie Agent `ground_truth_ops` is deployed and accessible.
- [ ] `agent_verification` job passes.
- [ ] `bundle validate --strict --target dev` passes.
- [ ] Any column drift fixes are documented and committed.

## Owned Paths / Assets
- `databricks.yml`
- `ground_truth_ops.geniespace.json`
- `src/notebooks/**`
- `resources/jobs/**`
- `../../ground-truth-infra/fixtures/metric_views/mv_*.yaml` (column drift fixes only — minimal edits)

## Dependencies
- Sessions 01, 02 (wave 0 complete).
- Part A wave 8 (app deployed and verified).
