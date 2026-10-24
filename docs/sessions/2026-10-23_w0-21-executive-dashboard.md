# Session 21 — Infra: executive AI/BI dashboard over the metric views

**Wave:** 0 · **Mode:** edit · **Run:** 745271774924215 · **Branch:** `mg-genie-ui-brand-and-gaps`

## Scope

Gap G3: dashboards resource in the infra bundle with a `.lvdash.json` over the 7 metric views (KPI counters, review activity trend, campaign progress, asset status mix, app error rate/latency), Databricks brand palette, infra warehouse.

## What was done

1. Created `ground-truth-infra/src/dashboards/` directory.
2. Created `ground-truth-infra/src/dashboards/executive.lvdash.json` — single-page Lakeview dashboard with:
   - **9 datasets** querying all 7 metric views via `MEASURE()` aggregation syntax.
   - Datasets use `catalog`/`schema` fields (`hls_fde_dev` / `dev_matthew_giglia_semantic_ground_truth`) instead of hard-coded 3-part names.
   - **4 KPI counters** (row 0): Total Votes, Approval Rate, Certified Assets (with total comparison), Active Reviewers.
   - **2 trend charts** (row 1): Review Activity by Day (line, Lava 600 `#FF3621`) and Campaign Progress by Status (bar, Blue/Yellow/Green/Maroon).
   - **3 operational charts** (row 2): Asset Status Mix (bar, Yellow/Blue/Green by status), Error Rate trend (line, Lava 700 `#BD2B26`), P95 Latency trend (line, Blue 600 `#2272B4`).
   - Chart colors from `ui_brand_plan.md` §3.3 palette and semantic tokens.
3. Created `ground-truth-infra/resources/dashboards/` directory.
4. Created `ground-truth-infra/resources/dashboards/executive.dashboard.yml` with:
   - `display_name: Semantic Ground Truth — Executive`
   - `file_path: ../../src/dashboards/executive.lvdash.json` (resolves correctly from `resources/dashboards/` to `src/dashboards/`)
   - `warehouse_id: ${resources.sql_warehouses.infra_warehouse.id}`
   - No `permissions` block (per plan: only add `CAN_READ` for the app SPN if needed).

## Metric views covered

| # | Metric view | Datasets | Widgets |
|---|---|---|---|
| 1 | `mv_review_activity` | ds_total_votes, ds_approval_rate, ds_review_trend | Total Votes counter, Approval Rate counter, Review Activity line |
| 2 | `mv_coverage_metrics` | ds_certified_assets, ds_asset_status | Certified Assets counter, Asset Status Mix bar |
| 3 | `mv_user_leaderboard` | ds_active_reviewers | Active Reviewers counter |
| 4 | `mv_campaign_progress` | ds_campaign_progress | Campaign Progress bar |
| 5 | `mv_otel_error_rate` | ds_error_rate | Error Rate line |
| 6 | `mv_otel_request_latency` | ds_latency | P95 Latency line |
| 7 | `mv_feedback_pipeline` | — | Not charted (no widget; feedback pipeline metrics are operational and low-volume; could be added as a table widget in a later iteration) |

**Note:** `mv_feedback_pipeline` is included in the gap analysis as one of the 7 metric views but the plan scope ("KPI counters, review activity trend, campaign progress, asset status mix, app error rate/latency") does not name it explicitly. The converge session (22b) can add it if needed.

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | **pass** — Validation OK |
| `file_path` resolves to existing `.lvdash.json` | **pass** — `resources/dashboards/` + `../../src/dashboards/executive.lvdash.json` = `src/dashboards/executive.lvdash.json` |
| Dashboard JSON valid (parseable, 9 datasets, 1 page, 9 widgets) | **pass** |
| All datasets use `catalog`/`schema` fields, no 3-part names in SQL | **pass** |
| Chart colors from brand palette (§3.3) | **pass** |

## Files changed

- `ground-truth-infra/src/dashboards/executive.lvdash.json` (created)
- `ground-truth-infra/resources/dashboards/executive.dashboard.yml` (created)

## Decisions

- Omitted `mv_feedback_pipeline` from widgets since the plan scope lists 5 specific chart areas and feedback pipeline was not among them. The converge session can add it.
- Used the Lakeview SDK API to write the `.lvdash.json` because `editAsset` does not support dashboard-type files in Git folders. The file is stored as a standard workspace dashboard object.
- No `permissions` block on the dashboard resource — the plan says to add `CAN_READ` for the app SPN only if needed.
