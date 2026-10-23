# Session 13 (wave 3, converge): Lakebase CDF, bronze pipeline, metric views

* Run: `713417549836954` (job `1079028753739581`, task `w3_session`), branch `mg-genie-agent-build`
* Runtime targets: `infra_setup_cdf`, `cdf_bronze_pipeline`, `infra_metric_view_deploy`
* Result: **pass**. All three targets succeeded; bronze table has 281 rows from 13 sources; 7 metric views deployed.

## Problems, root causes, fixes

1. **`spark.catalog.tableExists()` blocked in SDP serverless** (`PY4J_BLOCKED_API`). The `CdfBronzeBuilder.existing_sources()` method in `src/lib/cdf_bronze/builder.py` used `spark.catalog.tableExists()` to check which `lb_*_history` tables exist before defining flows. This API is not whitelisted in the SDP serverless environment. Fix: replaced with a single `information_schema.tables` SQL query scoped by `table_schema` — faster (one query vs. N) and SDP-safe.

2. **`timestampNtz` Delta feature not enabled**. The `_timestamp` column is `TIMESTAMP_NTZ` per build_conventions §7. The SDP pipeline created `bronze_lakebase_cdf` but failed because the `timestampNtz` feature wasn't enabled on the table. Fix: added `table_properties={"delta.feature.timestampNtz": "supported"}` to the `dp.create_streaming_table()` call, then full-refreshed the pipeline.

3. **`list_fixtures` returned 0 files — empty `fixtures_path`**. The job YAML passed `fixtures_path: ""` as a base_parameter. The notebook's `dbutils.widgets.get("fixtures_path")` returned `""` (not an exception), so the fallback default path was never used. The `for_each_task` iterated over 0 items and reported SUCCESS. Fix: updated job YAML to pass `${workspace.file_path}/fixtures/metric_views` and fixed the notebook to treat empty strings the same as missing.

4. **Statement Execution API `wait_timeout` exceeded 50s max**. The `deploy_metric_view` notebook set `wait_timeout=120s`, but the API limits this to 0s or 5–50s. All 7 iterations failed with `InvalidParameterValue`. Fix: capped `wait_timeout` at 50s and added a polling fallback for longer-running statements.

## Attempts

| n | target | result | errors | fix | files_changed |
| --- | --- | --- | --- | --- | --- |
| 1 | cdf_bronze_pipeline | deploy_failed | PY4J_BLOCKED_API: spark.catalog.tableExists | Replaced with information_schema SQL | builder.py |
| 2 | cdf_bronze_pipeline | deploy_failed | DELTA_FEATURES_REQUIRE_MANUAL_ENABLEMENT: timestampNtz | Added table_properties to dp.create_streaming_table | builder.py |
| 3 | cdf_bronze_pipeline | stable | All 21 flows completed | n/a | n/a |
| 3 | infra_metric_view_deploy (first run) | unhealthy | 0 iterations — empty fixtures_path | Fixed job YAML path + notebook empty-string handling | metric_view_deploy.job.yml, list_fixtures.py |
| 4 | infra_metric_view_deploy (second run) | deploy_failed | wait_timeout 120s > 50s max | Capped at 50s + polling fallback | deploy_metric_view.py |
| 5 | infra_metric_view_deploy (third run) | stable | 7/7 succeeded | n/a | n/a |

## Verification (final state)

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` | pass |
| `infra_setup_cdf` run 665094268657979 | SUCCESS — CDF config created, 21 history tables |
| `cdf_bronze_pipeline` update 5d0ae685 | COMPLETED — 21 flows, 0 failed/dropped records |
| `infra_metric_view_deploy` run 144422306878438 | SUCCESS — 7/7 iterations |
| `lb_votes_history` rows | 11 |
| `lb_assets_history` rows | 71 |
| `bronze_lakebase_cdf` rows / sources / columns | 281 / 13 / 10 (correct order per §7) |
| `mv_review_activity` resolves | yes (11 rows) |
| All 7 metric views exist | yes |

## Files modified (relative to semanticGroundTruth)

* `ground-truth-infra/src/lib/cdf_bronze/builder.py` — replaced `spark.catalog.tableExists` with information_schema query; added `table_properties` to `dp.create_streaming_table`
* `ground-truth-infra/resources/jobs/metric_view_deploy.job.yml` — fixed `fixtures_path` to use `${workspace.file_path}`
* `ground-truth-infra/src/notebooks/list_fixtures.py` — handle empty `fixtures_path` string
* `ground-truth-infra/src/notebooks/deploy_metric_view.py` — capped `wait_timeout` at 50s, added polling

## Decisions

* Used `information_schema.tables` instead of `spark.catalog.tableExists()` for SDP compatibility — also more efficient (single query).
* Kept `TIMESTAMP_NTZ` for `_timestamp` per build_conventions §7 rather than changing to `TIMESTAMP`.
* Set `table_properties` on the streaming table definition so full-refreshes recreate it correctly.

## Requests

None.
