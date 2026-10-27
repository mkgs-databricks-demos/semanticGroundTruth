# Session 29 — Agent bundle AI/BI operations dashboard

**Build 4 · wave `4-0` · edit · run `110489694161084` · branch `mg-genie-build-4` · 2026-10-24**

Plan: `docs/plans/29_agent_operations_dashboard.md`. Status: **pass** (edit only; session 39 deploys and converges).

## Changes

* `ground-truth-agent/resources/ops_dashboard.dashboard.yml` (new): `dashboards.ops_dashboard`, `display_name: ${var.ops_dashboard_title}`, `file_path: ../src/dashboards/operations.lvdash.json`, `warehouse_id: ${var.warehouse_id}` (same variable as the Genie space), `embed_credentials: false`, `dataset_catalog` / `dataset_schema` from `var.catalog` / `var.schema_name`, `CAN_RUN` for `users`. Resolved dev name: `[dev matthew_giglia] Semantic Ground Truth — Operations` (matches runtime target `agent_ops_dashboard`).
* `ground-truth-agent/databricks.yml`: new variable `ops_dashboard_title` (default `Semantic Ground Truth — Operations`, also set in `prod`).
* `ground-truth-agent/src/dashboards/operations.lvdash.json` (new): 17 datasets, 5 pages.
  * **Review Queue Health:** text widget with the link "Ask Ground Truth Operations" (`/genie/rooms/01f1ceb0506f1c5d9f2024bfc5f95943`); counters Votes / Skipped cards / Skip rate; votes vs skips per day (line); queue by asset type and review status; skip rate by campaign; top 10 most-skipped assets; skip reasons; reviewers with the most skips (`total_skips`).
  * **Campaigns:** active campaigns, average completion, reviewed vs assigned assets (counters); active campaign progress by type / domain / rule; active reviewers per campaign (`Unique Reviewers` by `campaign_id`); campaigns by type and status.
  * **Feedback Loop:** batches, success rate, failed batches; edit votes (date range), batches awaiting a branch (`status = 'pending'`), assets in pending batches; batches by status per day; latest 10 batches.
  * **App Health:** last 24 h vs last 7 d table (error rate, errors, p50, p95, requests); hourly error rate and p50/p95 latency for 7 d.
  * **Filters** (`PAGE_TYPE_GLOBAL_FILTERS`): date range (dataset parameter `date_range`, `complexType: RANGE`, default `now-30d/d`..`now/d`, bound to the 8 date-scoped datasets with `BETWEEN :date_range.min AND :date_range.max OR :date_range IS NULL`), campaign (`campaign_id` field filter on 3 datasets), asset type (`asset_type` field filter).
  * Brand colours from `docs/plans/ui_brand_plan.md` (Lava 600 `#FF3621`, Navy 800 `#1B3139`, Lava 700 `#BD2B26`, Blue 600 `#2272B4`, Green 700 `#00875C`, Yellow 600 `#FFAB00`, Gray Text `#5A6F77` for skips). No `uiSettings` theme block: the infra executive dashboard has none to copy, and an unverified theme schema could break the deploy.
  * The file is a workspace `DASHBOARD` object; the file edit tools cannot open it, so it was written with the Workspace import API (same method as sessions 21 and 28), from a generator, and read back to verify.
* `ground-truth-agent/src/notebooks/agent_verification.ipynb`: new widget `dashboard_title`; new cell "Verify operations dashboard is published and every dataset executes" before the summary cell. Checks `ops_dashboard:exists_and_published` (title match via `endswith`, `lakeview.get_published`) and one `ops_dashboard:dataset:<name>` row per dataset (`SELECT * FROM (<query>) LIMIT 1` on the warehouse with RANGE defaults inlined as `DATE'...'` literals and single-value parameters bound as statement parameters). Existing checks unchanged (diff is additions only).
* `ground-truth-agent/resources/jobs/agent_verification.job.yml`: passes `dashboard_title: ${var.ops_dashboard_title}`.
* `ground-truth-agent/README.md`, `ground-truth-agent/PROJECT_MEMORY.md`: resource tables, variables, structure, known metric-view limits.

## Decisions

* Datasets use only the 7 metric views with `MEASURE()` and fixture measure names (checked against `ground-truth-infra/fixtures/metric_views/*.yaml` after session 28: `skips` = `COUNT(DISTINCT skip_id)`, `skip_rate`, dimension `skip_reason`, `total_skips`; `Total Votes` = `COUNT(id)` excludes skips).
* Date range is a dataset parameter (not a field filter) so that measures such as `skip_rate` and "top 10" are computed over the filtered rows. Additive datasets keep `campaign_id` so the campaign field filter works; non-additive ones (skip rate by campaign) group by the plotted dimension only.
* The genie-build-waves gate (`check_dashboard`) skips datasets with RANGE parameters, so 8 of 17 datasets are not executed by the `agent_ops_dashboard` runtime target. The `agent_verification` check executes all 17 with defaults, and `agent_verification` is a runtime target of wave 4-7.
* App Health uses fixed windows (24 h, 7 d) per the plan, so it does not follow the global date range.

## Plan items not possible with the pinned metric views (no workaround outside owned paths)

* **Skip rate by asset type:** `mv_review_activity` has no `asset_type` and `mv_coverage_metrics` has no asset id to join on. The page shows the queue by asset type and status instead.
* **Campaigns: per campaign name, reviewers assigned, days to due date:** `mv_campaign_progress` has no campaign id / name, due date or assignment dimensions. Shown by type / domain / rule; active reviewers per `campaign_id` come from `mv_review_activity`.
* **Latest `mg-genie-feedback-*` branch and its file count:** `mv_feedback_pipeline` has `branch_name` in its source but not as a dimension. "Edit votes awaiting a branch" is approximated as edit votes in range plus pending batches.

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` (ground-truth-agent) | pass — Validation OK; `dashboards.ops_dashboard` resolved with the file's content as `serialized_dashboard`, `dataset_catalog` / `dataset_schema` accepted |
| Dashboard JSON parses; every dataset FROM is one of the 7 metric views (all 7 used); every `MEASURE()` name exists in the referenced view's fixture | pass |
| Every dataset used by a widget, no undefined datasets, unique widget names, every encoding `fieldName` is a widget query field | pass |
| Verification parameter binder on all 17 datasets: no `:param` left, defaults resolve (`now-30d/d` -> 2026-09-24, `now/d` -> 2026-10-24) | pass |
| Notebook diff additions only (existing checks unchanged) | pass |
| Dataset execution on the warehouse | skipped — edit session (`allow_execute` false); session 39 / `agent_verification` |

## Requests

* infra (`ground-truth-infra/fixtures/metric_views/`, a later session): add `asset_type` (and optionally `asset_name`) to `mv_review_activity`; `campaign_id`, `campaign_name`, `due_date` and an assigned-reviewers measure to `mv_campaign_progress`; `branch_name` dimension to `mv_feedback_pipeline`. Then the dashboard can show skip rate by asset type, per-campaign progress / due dates and the latest feedback branch.
* genie-build-waves (`src/notebooks/wave_gate_check.ipynb`, not in this repo): support RANGE dataset parameters in `check_dashboard` (inline `.min` / `.max` defaults like the `agent_verification` binder) so the gate executes every dataset.

## For session 39 (converge)

* Unverified Lakeview JSON details to watch on first deploy: RANGE parameter / `filter-date-range-picker` binding, multi-series `y.fields` line charts (spec version 3), table spec version 1 columns, `mappings` colour scale, counter `target`. Fix in `operations.lvdash.json` via the Workspace import API.
* Grid is 6 columns wide (the executive dashboard uses 12-column positions).
