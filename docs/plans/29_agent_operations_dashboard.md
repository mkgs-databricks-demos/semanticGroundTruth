# Session 29: Agent bundle AI/BI operations dashboard

**Build 4 · wave `4-0` · edit · agent**

## Scope

Add an AI/BI (Lakeview) dashboard resource to `ground-truth-agent`, deployed with the bundle, that gives stewards and the project owner an operational view next to the Genie space "Ground Truth Operations". Different audience from the infra executive dashboard (which stays leadership-facing): this one is for running the review program day to day.

## Context

* Agent bundle today: `resources/ground_truth_ops.genie_space.yml` (space `01f1ceb0506f1c5d9f2024bfc5f95943`), `resources/jobs/agent_verification.job.yml`, `src/notebooks/agent_verification.ipynb`, `ground_truth_ops.geniespace.json`. Warehouse `0ea84986a23a47c3`. Schema `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`.
* Pattern to copy: `ground-truth-infra/resources/dashboards/*.yml` + `ground-truth-infra/src/dashboards/executive.lvdash.json` (bundle `dashboards` resource, `file_path`, `warehouse_id`, `embed_credentials: false`). Read it; do not edit it.
* Metric views (pinned names; skips measures arrive with session 28 and are deployed by session 37 before this dashboard is converged in session 39): `mv_review_activity` (`skips`, `skip_rate`, `skip_reason` + existing), `mv_campaign_progress`, `mv_coverage_metrics`, `mv_feedback_pipeline`, `mv_user_leaderboard` (`total_skips`), `mv_otel_error_rate`, `mv_otel_request_latency`. Query them with `MEASURE()`.
* Brand: `docs/plans/ui_brand_plan.md` (Lava 600 `#FF3621` accent, Navy 800 `#1B3139`, DM Sans), the executive dashboard's theme block.

## Tasks

1. `ground-truth-agent/resources/ops_dashboard.dashboard.yml`: display name **`Semantic Ground Truth — Operations`** (dev mode adds `[dev matthew_giglia] `), `file_path: ../src/dashboards/operations.lvdash.json`, warehouse from the bundle variable used by the Genie space, `embed_credentials: false`.
2. `src/dashboards/operations.lvdash.json`, pages:
   * **Review queue health:** votes vs skips per day, skip rate by asset type and by campaign, top 10 most-skipped assets (candidates for better context), skip reasons.
   * **Campaigns:** progress per active campaign, reviewers assigned vs active, days to due date.
   * **Feedback loop:** feedback batches by status, edit votes awaiting a branch, latest `mg-genie-feedback-*` branch and its file count.
   * **App health:** error rate and p50/p95 latency (OTel metric views), last 24 h and 7 d.
   * A text widget linking to the Genie space ("Ask Ground Truth Operations").
   Global filters: date range (default last 30 days), campaign, asset type.
3. Add a check to `agent_verification.ipynb`: the dashboard exists, is published, and each dataset executes (statement execution on the warehouse) with no error. Keep existing checks unchanged.
4. Update `ground-truth-agent/README.md` and `PROJECT_MEMORY.md` resource tables.
5. `bundle validate --strict --target dev` for `ground-truth-agent`.

## Acceptance Criteria

- [ ] Dashboard resource + JSON exist; every dataset uses only the metric views and measure names listed above.
- [ ] `agent_verification` has the new dashboard check.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths

- `ground-truth-agent/**`

## Exclude Paths

- `ground-truth-agent/docs/plans/**`
- `ground-truth-agent/.databricks/**`

## Dependencies

- None for editing (wave `4-0`). Converged by session 39 after session 37 deploys the metric views.
