# Session 47: Metric view UUID ids (P2 #4) + Lakehouse Monitoring on bronze (G11)

**Build 5 · wave `5-0` · edit (parallel)**

## Context

The ops dashboard shows BINARY ids because `mv_review_activity` exposes `campaign_id` / `asset_id` as BINARY (follow-up 4). The dashboard file is a workspace DASHBOARD object, so the fix goes into the metric views: dimension names stay the same (widgets and Genie SQL bind by name), only the expression changes. G11 (gap analysis §6) adds Lakehouse Monitoring on the bronze table.

## Steps

1. **UUID dimensions.** In every `ground-truth-infra/fixtures/metric_views/*.yaml`, for each dimension whose source column is a BINARY UUID (`*_id` from `bronze_lakebase_cdf` / `lb_*_history`; check the column types with `DESCRIBE` on the dev tables), set `expr: regexp_replace(lower(hex(<col>)), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5')`. Keep `name` and `display_name`. Filters and joins inside the YAML that compare ids keep using the raw column.
2. **Consumers.** Search the repo for every use of these dimensions: `ground-truth-agent/src/dashboards/operations.lvdash.json` (read only), the executive dashboard under `ground-truth-infra/src/dashboards/` (read only), `ground-truth-agent/resources/ground_truth_ops.genie_space.yml` example SQL, `agent_verification`, `post_deploy_validation.py`, app server SQL. Anything that compares a dimension to a BINARY value or calls `hex()` on it must change; list each consumer and the outcome in the status file. If a dashboard dataset needs a change, record a `request` (owner applies it); do not edit `.lvdash.json`.
3. **Tests:** extend `ground-truth-infra/tests/` with a YAML test: every `*_id` dimension over a BINARY source uses the UUID expression; the YAML still parses with the parser used by `deploy_metric_view.py`.
4. **G11 monitor.** Add `ground-truth-infra/resources/monitors/bronze_lakebase_cdf.quality_monitor.yml`: `quality_monitors` resource on `${resources.schemas.ground_truth_schema.catalog_name}.${resources.schemas.ground_truth_schema.name}.bronze_lakebase_cdf`, `output_schema_name` the same schema, `assets_dir` under the bundle workspace path, `time_series` on the commit timestamp column (`_commit_timestamp` or the confirmed name from root conventions §7) with granularities `1 hour` and `1 day`, slicing on the source table column, schedule daily (`PAUSED` in dev, matching the paused bronze refresh), no notifications in dev. Add the `include` to `databricks.yml` if resources are not globbed.
5. **Runbook:** `docs/runbooks/cdf_bronze_operations.md`: a monitoring section (where the profile/drift tables are, how to refresh).
6. `bundle validate --strict --target dev` (infra and agent); pytest.

## Acceptance

Validate passes; YAML tests pass; consumer list recorded; the monitor resource validates. Runtime proof is sessions 57 (metric views) and 58 (monitor).

## Owned paths

* `ground-truth-infra/fixtures/metric_views/**`
* `ground-truth-infra/resources/monitors/**`
* `ground-truth-infra/databricks.yml`
* `ground-truth-infra/tests/test_metric_view_ids.py`
* `ground-truth-agent/resources/ground_truth_ops.genie_space.yml`
* `docs/runbooks/cdf_bronze_operations.md`

## Dependencies

None.
