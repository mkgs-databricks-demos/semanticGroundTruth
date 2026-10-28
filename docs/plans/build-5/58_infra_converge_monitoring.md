# Session 58: Converge infra: bronze monitor is prod-only (G11, D-B5-4) + visual-checks volume

**Build 5 · wave `5-5` · converge (alone) · target `bronze_lakebase_cdf` (volumes and validate output have no runtime-target type, so steps 2-4 are checked by the session and recorded in its status file)**

> **Rescoped 2026-10-28 (owner decision D-B5-4).** The shared `fevm-hls-fde` metastore is at its 1000 quality-monitor limit: creating the dev monitor returns `429 RESOURCE_EXHAUSTED` and `bundle deploy` hangs on retries (session 57). The project owns no monitors, so there is no capacity to free. `resources/monitors/bronze_lakebase_cdf.quality_monitor.yml` now defines the monitor under `targets.prod` only. This session no longer refreshes a dev monitor or checks profile / drift tables. Do not move the monitor back to dev, and do not create a monitor by hand.

## Steps

1. Session 57 already deployed the infra bundle (`ui_visual_checks` volume, no dev monitor). If anything changed since, or `bundle summary --target dev` shows `ui_visual_checks` as `(not deployed)`, redeploy with `./deploy.sh --target dev --infra` (or its steps one by one, as session 57 did).
2. Dev has no monitor: `bundle summary --target dev` lists no `Quality Monitors`, and `w.quality_monitors.get` on `bronze_lakebase_cdf` returns not found.
3. Prod keeps the monitor: `bundle validate --strict --target prod --var app_service_principal_id=<any uuid>` passes, and `bundle summary --target prod` lists `quality_monitors.bronze_lakebase_cdf`. Record the resolved `time_series`, `slicing_exprs` and `schedule`.
4. Check the volume `ui_visual_checks` exists and the M2M SPN has `READ_VOLUME` and `WRITE_VOLUME`.
5. In `docs/runbooks/cdf_bronze_operations.md`, note that the monitor is prod-only (why, and how to re-enable it in dev once quota allows) for session 63.

## Stable when

The dev infra deploy completes with no monitor, the prod target validates with the monitor, `bronze_lakebase_cdf` passes its runtime target, and the volume grants are in place.

## Owned paths

* `ground-truth-infra/**` (excluding `ground-truth-infra/.databricks/**`)
* `docs/runbooks/cdf_bronze_operations.md`

## Dependencies

57
