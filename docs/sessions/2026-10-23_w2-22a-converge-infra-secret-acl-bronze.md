# Session 22a — Converge infra: secret ACL + bronze refresh job

**Wave 2 · converge · run 745271774924215 · 2026-10-23 18:02 UTC**

## Problems & Root Causes

### Stale app SPN default in databricks.yml

The `app_service_principal_id` dev default was `55882972-924d-42cd-ab3d-d10c730629c2` (written by session 18 from the context_notes). The live app SPN — confirmed via `databricks apps get dev-semantic-ground-truth` — is `9f3db838-9415-46fe-9722-9654a6856ecc`. The old SPN was from a prior app destroy/recreate cycle; PROJECT_MEMORY notes "app SPN changes on every destroy (latest 9f3db838-...)". Fixed the default before deploying.

## Changes

### `ground-truth-infra/databricks.yml`

* Updated `app_service_principal_id` dev default from `55882972-924d-42cd-ab3d-d10c730629c2` to `9f3db838-9415-46fe-9722-9654a6856ecc` (current live app SPN).

## Converge Attempt 1 — stable

### Deploy

* `bundle validate --strict --target dev` — Validation OK
* `bundle deploy --target dev --var=run_setup=false` — 88 files uploaded, 2 created (dashboards.executive, jobs.cdf_bronze_refresh), 1 changed (secret_scopes.ground_truth_secret_scope.permissions), 18 unchanged.

### ACL Verification

* `databricks secrets list-acls semantic_ground_truth_credentials`:
  * `9f3db838-9415-46fe-9722-9654a6856ecc` → READ ✅
  * `matthew.giglia@databricks.com` → MANAGE ✅

### Bronze Refresh Job

* Job `703274109872341`, run `950875080561148`: TERMINATED SUCCESS (17:58:03–17:59:46 UTC, ~103s).
* Pipeline `ef3c1863-ad0d-4029-a36e-3f61fca1e393`, update `800a3ae5-7bfd-4b4a-a3bb-1881076d531b`: COMPLETED.
  * 0 issues (errors/warnings)
  * 6 flows completed: bronze_from_asset_sources, bronze_from_mcp_sessions, bronze_from_campaigns, bronze_from_app_config, bronze_from_feedback_batches, bronze_from_campaign_assets

### Bronze Table

* `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.bronze_lakebase_cdf`
  * 10 columns: `_source_table`, `_source_history_table`, `_record_key`, `_pg_change_type`, `_pg_lsn`, `_pg_xid`, `_timestamp`, `_sort_by`, `_ingested_at`, `data` ✅
  * 774 rows (≥ 1) ✅
  * Fresh writes: versions 33–35 at 2026-10-23T17:59:23–24Z (18 new rows from this pipeline run)

### Classification: stable

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` | pass |
| `secrets list-acls` shows app SPN READ | pass |
| `secrets list-acls` shows owner MANAGE | pass |
| Pipeline update COMPLETED, 0 issues | pass |
| Bronze table has all 10 required_columns | pass |
| Bronze table row count ≥ 1 (774) | pass |
| Fresh DESCRIBE HISTORY commits from this run | pass |

## Decisions

* Fixed the stale SPN default in databricks.yml rather than passing `--var` override, because the YAML default should reflect the current app SPN for interactive `bundle deploy` runs outside of deploy.sh.

## Files Modified

* `ground-truth-infra/databricks.yml` — updated `app_service_principal_id` dev default to current app SPN
