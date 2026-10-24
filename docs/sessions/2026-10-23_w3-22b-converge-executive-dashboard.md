# Session 22b — Converge infra: executive AI/BI dashboard

**Wave:** 3 · **Mode:** converge · **Run:** 745271774924215 · **Branch:** `mg-genie-ui-brand-and-gaps`
**Date:** 2026-10-23

## Scope

Deploy infra (run_setup=false, same app SPN variable as 22a so the scope ACL is preserved), publish the executive dashboard, and fix any dataset that fails LIMIT 1 execution. Record the dashboard id and published URL in the session summary for session 23.

## Problems & Root Causes

### `campaign_name` column does not exist in `mv_campaign_progress`

The `ds_campaign_progress` dataset referenced `campaign_name` but the metric view only has `campaign_type`, `campaign_status`, `completion_rule`, `scope_domain`, and `campaign_month` as dimensions. Root cause: session 21 authored the dataset SQL with an incorrect column name. Fixed by replacing all `campaign_name` references with `campaign_type` in the dataset query, widget field, and bar chart x-axis encoding.

## Changes

### `ground-truth-infra/src/dashboards/executive.lvdash.json` (via Lakeview SDK)

* `ds_campaign_progress` dataset: `campaign_name` → `campaign_type` in query, GROUP BY, ORDER BY
* `w_campaign_progress` widget: field name `campaign_name` → `campaign_type`, expression updated
* `w_campaign_progress` spec: x-axis encoding `fieldName` `campaign_name` → `campaign_type`

## Converge Attempt 1 — stable

### Deploy (initial)

* `bundle validate --strict --target dev` — Validation OK
* `bundle deploy --target dev --var=run_setup=false` — 88 files uploaded, 0 created, 0 changed, 21 unchanged
* Published revision: 2026-10-23T17:57:33.372Z (from 22a deploy; no source change yet)

### Diagnose

* EXPLAIN on all 9 datasets: 8 pass, 1 fail
* `ds_campaign_progress`: `[UNRESOLVED_COLUMN.WITH_SUGGESTION] campaign_name cannot be resolved. Did you mean campaign_type?`

### Fix

* Updated source dashboard `01f1cf0622f41dd4bdfd75a8ef2ddb1d` via `w.lakeview.update()` — replaced all `campaign_name` → `campaign_type`

### Redeploy

* `bundle deploy --target dev --var=run_setup=false` — 1 file uploaded, 1 changed (dashboards.executive), 20 unchanged
* New published revision: **2026-10-23T18:14:47.434Z**

### Re-verify

* EXPLAIN on all 9 datasets: **9/9 pass**
* LIMIT 1 execution on all 9 datasets: **9/9 pass** with data
* `secrets list-acls semantic_ground_truth_credentials`: app SPN READ ✅, owner MANAGE ✅
* `bundle validate --strict --target dev`: Validation OK

### Classification: stable

## Dashboard Details (for session 23)

| Field | Value |
|---|---|
| Dashboard ID | `01f1cf0b38d31b7cbac5bdac6cafe3eb` |
| Display name | `[dev matthew_giglia] Semantic Ground Truth — Executive` |
| Published URL | `https://fevm-hls-fde.cloud.databricks.com/dashboardsv3/01f1cf0b38d31b7cbac5bdac6cafe3eb/published` |
| Warehouse ID | `0ea84986a23a47c3` |
| Published revision | 2026-10-23T18:14:47.434Z |
| Datasets | 9 (all executing) |
| Pages | 1 (Executive Summary) |

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` (pre-deploy) | pass |
| `bundle deploy` succeeds | pass |
| Dashboard published revision newer than deploy | pass (18:14:47Z) |
| All 9 datasets pass EXPLAIN | pass |
| All 9 datasets pass LIMIT 1 execution | pass |
| `secrets list-acls` shows app SPN READ after deploy | pass |
| `secrets list-acls` shows owner MANAGE after deploy | pass |
| `bundle validate --strict --target dev` (post-fix) | pass |

## Files Modified

* `ground-truth-infra/src/dashboards/executive.lvdash.json` — fixed `campaign_name` → `campaign_type` in ds_campaign_progress dataset, widget field, and chart encoding
