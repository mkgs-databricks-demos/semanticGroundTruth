# 21 — Infra: executive AI/BI dashboard over the metric views

**Wave 0 · edit · bundle `ground-truth-infra` · gap G3 (design L200-C8 resolved Q1: AI/BI dashboard primary)**

## Steps
1. List the 7 metric view fixtures under `ground-truth-infra/fixtures/metric_views/` and read their measures/dimensions; use only names that exist there.
2. `src/dashboards/executive.lvdash.json`: one page, datasets that query the metric views with `MEASURE()` in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth` (use the dataset `catalog`/`schema` fields, not hard-coded 3-part names where the format allows). Widgets: KPI counters (total votes, approval rate, assets validated, active reviewers), review activity by day (line), campaign progress (bar), asset status mix (bar), app error rate and p95 latency (from the OTel metric views). Series colors from the ui_brand_plan §3.3 chart palette.
3. `resources/dashboards/executive.dashboard.yml`: `dashboards.executive` with `display_name: Semantic Ground Truth — Executive`, `file_path: ../../src/dashboards/executive.lvdash.json`, `warehouse_id: ${resources.sql_warehouses.infra_warehouse.id}`, `parent_path` under the bundle workspace root. No `permissions` block unless it only adds the app SPN `CAN_READ` (the app links to it; viewers use their own access).
4. Confirm the relative `file_path` from the YAML directory resolves to the JSON on disk; `bundle validate --strict --target dev`.

## Done when
Wave 0 gate line for 21 holds and validate passes. Publishing and dataset execution are checked in session 22 (`executive_dashboard` target with `execute_datasets: true`).
