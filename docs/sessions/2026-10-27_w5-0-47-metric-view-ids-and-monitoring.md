# Session 47 (build 5, wave 5-0): metric view UUID ids + Lakehouse Monitoring on bronze (G11)

* **Run:** `229891579528310` (Build Waves `-sgt-build-5`, job `884230801831394`), branch `mg-genie-build-5`, mode `edit`.
* **Plan:** `docs/plans/build-5/47_metric_view_ids_and_monitoring.md`. Scope: follow-up 4 via metric view dimension expressions (no dashboard JSON edits); quality monitor on `bronze_lakebase_cdf`; consumer audit.
* **Status:** pass.

## Problem and root cause

The ops dashboard showed unreadable ids (follow-up 4). Evidence from the dev tables (`hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`):

* In `bronze_lakebase_cdf.data`, `schema_of_variant(data:id | asset_id | campaign_id)` is `BINARY` (Postgres `UUID`), while `data:user_id` is `STRING` (email / SPN id, e.g. `71862687979431@7474657291520070`).
* The fixture's `data:asset_id::STRING` keeps the raw 16 bytes in a STRING column (`DESCRIBE mv_review_activity`: `asset_id string`, `campaign_id string`). Collecting such a column to pandas fails with `ArrowException: Wrapping ... failed`, the same symptom as the dashboard. `hex(data:asset_id::STRING)` equals `hex(data:asset_id::BINARY)`, so `hex()` on the column is lossless.

## Changes

1. **`ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml`:** dimensions `asset_id` and `campaign_id` now use `regexp_replace(lower(hex(<col>)), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5')` (the SQL from follow-up 4). Names and display names unchanged; source columns and measures (`COUNT(id)`, `COUNT(DISTINCT skip_id)`) unchanged; header comment explains why. No other fixture has a dimension over a UUID column: `mv_campaign_progress.campaign_id`, `mv_coverage_metrics.id`, `mv_feedback_pipeline.id` are only used in `COUNT(DISTINCT ...)` measures, `mv_user_leaderboard.user_id` is a STRING, and the OTel `record_id` columns are not from bronze.
2. **`ground-truth-infra/tests/test_metric_view_ids.py` (new, 17 tests):** reads UUID column names from `ground-truth-app/server/migrations/*.ts`; parses every fixture like `deploy_metric_view.py` (`yaml.safe_load`, `${catalog}`/`${schema}` substitution, `$$...$$` body); fails if any dimension exposes a `data:<uuid>::STRING` alias bare, requires the exact UUID expression for `*_id` dimensions over such aliases, checks exactly two `$$` per fixture, and checks the Python port of the expression against `uuid.UUID(bytes=...)`.
3. **`ground-truth-infra/resources/monitors/bronze_lakebase_cdf.quality_monitor.yml` (new):** `quality_monitors.bronze_lakebase_cdf` on `${resources.schemas.ground_truth_schema.catalog_name}.${resources.schemas.ground_truth_schema.name}.bronze_lakebase_cdf`, output to the same schema, `assets_dir: ${workspace.root_path}/monitoring/bronze_lakebase_cdf`, `warehouse_id: ${resources.sql_warehouses.infra_warehouse.id}`, TimeSeries on `_timestamp` with `1 hour` + `1 day`, `slicing_exprs: [_source_table]`, daily 06:00 UTC schedule, no notifications.
4. **`docs/runbooks/cdf_bronze_operations.md`:** §4 note on UUID id dimensions; new §6 Lakehouse Monitoring (resource, settings, output tables `bronze_lakebase_cdf_profile_metrics` / `_drift_metrics`, manual refresh via UI or `w.quality_monitors.run_refresh`, `_ingested_at` fallback). Also corrected two wrong rows in the bronze schema table (`_record_key` is UUID text / `|`-joined, not JSON; `_ingested_at` is `TIMESTAMP`, confirmed by the table schema).

`ground-truth-infra/databricks.yml` is unchanged: `include` already globs `resources/*/*.yml` (the monitor appears in `bundle validate --output json` includes), and dev `mode: development` sets `trigger_pause_status: PAUSED`, which the docs say pauses quality monitor schedules too. `ground-truth-agent/resources/ground_truth_ops.genie_space.yml` is unchanged (see consumers).

## Decisions

* **Timestamp column `_timestamp`** (CDF commit time, `TIMESTAMP_NTZ`, root conventions §7): there is no `_commit_timestamp`. Data profiling accepts a timestamp column of any type `to_timestamp` converts. Fallback if session 58 sees a type error: `_ingested_at` (`TIMESTAMP`), documented in the runbook.
* **Dev pause via development mode** rather than an explicit `pause_status`, so a prod deploy runs the schedule without a target override.
* **Expression applied in the dimension, not the source**, as the plan says; `id`/`skip_id` stay raw because only measures use them.

## Consumer audit

| Consumer | Uses | Outcome |
|---|---|---|
| `ground-truth-agent/src/dashboards/operations.lvdash.json` (read only) | `ds_votes_skips_daily`, `ds_skips_by_campaign`, `ds_top_skipped_assets`, skip-reason dataset select `campaign_id` / `asset_id` by name, `GROUP BY`, `IS NOT NULL` | No change needed: they get UUID strings once the view is redeployed. The optional tie-break `ORDER BY skip_count DESC, asset_id` from follow-up 4 is a dashboard change (request below). |
| `ground-truth-infra/src/dashboards/executive.lvdash.json` (read only) | measures and `vote_date` only | No change. |
| `ground-truth-agent/ground_truth_ops.geniespace.json` (via `resources/ground_truth_ops.genie_space.yml`) | example SQL on `mv_review_activity` uses measures / `vote_type`; leaderboard groups by `user_id` (STRING); no `asset_id`/`campaign_id`/`hex()` | No change. |
| `ground-truth-agent/src/notebooks/agent_verification.ipynb` | `SELECT MEASURE(...)` per view | No change. |
| `ground-truth-infra/src/notebooks/post_deploy_validation.py` | `SHOW VIEWS` existence only | No change. |
| `ground-truth-app/server/services/review/validationQuery.ts` | generic `SELECT MEASURE(<name>)` | No change. |
| App server / shared contracts | no metric view id queries | No change. |
| `ground-truth-infra/src/notebooks/collect_feedback.py` | already formats BINARY ids with the same expression on `lb_*_history` | No change (consistent). |

No consumer compares these dimensions to a BINARY value or calls `hex()` on them.

## Checks

| Check | Result |
|---|---|
| SQL on dev bronze: UUID expression over `data:id::STRING` equals `_record_key` | pass (assets 262/262, campaigns 11/11, votes 26/26, review_skips 1/1) |
| SQL: vote `asset_id` strings match an asset `_record_key` | pass (13/13) |
| `pytest ground-truth-infra/tests/test_metric_view_ids.py` | pass, 17 |
| Negative check: same tests against the HEAD fixture | 2 fail as expected (`asset_id` exposes BINARY) |
| `pytest ground-truth-infra/tests ground-truth-app/src/notebooks/tests` | pass, 135 (includes other wave 5-0 sessions' tests in the tree) |
| `bundle validate --strict --target dev` ground-truth-infra | pass (monitor included) |
| `bundle validate --strict --target dev` ground-truth-agent | pass |
| Metric view `CREATE` with the new expression | skipped (edit mode, no execute); runtime proof is session 57 |
| Monitor create + first refresh | skipped (no deploy); runtime proof is session 58 |

## Requests

* `ground-truth-agent/src/dashboards/operations.lvdash.json` (owner): optional tie-break in `ds_top_skipped_assets`: `ORDER BY skip_count DESC, asset_id LIMIT 10` (13 of 14 assets tie at 0 skips; follow-up 4). Not needed for readable ids.
* Session 57: redeploy metric views (`metric_view_deploy`) and confirm `typeof(asset_id)` / `campaign_id` values match `^[0-9a-f]{8}-...$` from `mv_review_activity`; then `agent_verification`.
* Session 58: deploy infra, check the monitor is created (`w.quality_monitors.get`), run a refresh, confirm `bronze_lakebase_cdf_profile_metrics` has rows per `_source_table`.

## Files modified

* `ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml`
* `ground-truth-infra/tests/test_metric_view_ids.py` (new)
* `ground-truth-infra/resources/monitors/bronze_lakebase_cdf.quality_monitor.yml` (new)
* `docs/runbooks/cdf_bronze_operations.md`
