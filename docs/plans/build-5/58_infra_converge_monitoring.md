# Session 58: Converge infra: Lakehouse Monitoring on bronze (G11) + visual-checks volume

**Build 5 · wave `5-5` · converge (alone) · target `bronze_cdf_profile_metrics`; the wave gate also checks `bronze_lakebase_cdf` (volumes have no runtime-target type, so step 4 is checked by the session and recorded in its status file)**

## Steps

1. Session 57 already deployed the infra bundle (monitor + `ui_visual_checks` volume). If anything changed since, redeploy with `./deploy.sh --target dev --infra`.
2. Trigger a monitor refresh (`w.quality_monitors.run_refresh` on `bronze_lakebase_cdf`) and wait for `SUCCESS` (up to 30 min; poll every 60 s). If the refresh fails, read the refresh message and fix the monitor YAML (timestamp column, granularities, slicing).
3. Check `bronze_lakebase_cdf_profile_metrics` and `bronze_lakebase_cdf_drift_metrics` exist in the project schema and the profile table has rows for this refresh.
4. Check the volume `ui_visual_checks` exists and the M2M SPN has `READ_VOLUME` and `WRITE_VOLUME`.
5. Record the monitor dashboard URL (if created) for session 63's runbook update.

## Stable when

The latest monitor refresh is `SUCCESS`, the profile metrics table has ≥ 1 row, and the volume grants are in place.

## Owned paths

* `ground-truth-infra/**` (excluding `ground-truth-infra/.databricks/**`)
* `docs/runbooks/cdf_bronze_operations.md`

## Dependencies

57
