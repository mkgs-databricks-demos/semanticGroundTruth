# Session 18 — Infra: app SPN secret-scope READ + scheduled bronze refresh

**Wave 0 · edit · run 745271774924215 · 2026-10-23 17:19 UTC**

## Problems & Root Causes

### G1 — App SPN loses READ on secret scope (P0 bug)

The infra secret scope `permissions` block is authoritative. Every `bundle deploy` enforces it, and the block listed only the owner's MANAGE. The app SPN's READ ACL (originally granted by the app bundle's `m2m-client-id` resource) was silently removed on every infra deploy, causing the `[ERROR] error resolving resource m2m-client-id` log line on every app start.

The header comment in the YAML incorrectly claimed a `configure_app_spn` job in Bundle 2 handled this. That job does not exist.

### G2 — No scheduled bronze refresh (P1)

The `cdf_bronze` SDP pipeline is `continuous: false` and nothing triggered it. Metric views and the Genie agent only see data as of the last manual run.

## Changes

### `ground-truth-infra/databricks.yml`

* Added variable `app_service_principal_id` (no global default; prod must supply it via deploy.sh). Description: application (client) ID of the app SPN.
* Dev target: default `55882972-924d-42cd-ab3d-d10c730629c2` (current dev app SPN).

### `ground-truth-infra/resources/secrets/ground_truth_scope.secret_scope.yml`

* Fixed header comment: now says the READ permission is declared in the target-specific permissions blocks below, not by a non-existent Bundle 2 job.
* Fixed section comment: "Owner MANAGE + app SPN READ".
* Both `dev` and `prod` targets: added `- service_principal_name: ${var.app_service_principal_id}` with `level: READ`.

### `ground-truth-infra/resources/jobs/cdf_bronze_refresh.job.yml` (new)

* Job `cdf_bronze_refresh`, display name "Semantic Ground Truth — Bronze Refresh".
* Single task `refresh_bronze`: `pipeline_task` referencing `${resources.pipelines.cdf_bronze.id}`, `full_refresh: false`.
* Schedule: `0 0 * * * ?` (hourly, UTC). Dev mode auto-pauses this (expected; documented in YAML comment).
* `max_concurrent_runs: 1`.
* Email notification on failure to `matthew.giglia@databricks.com`.
* Tags: `project: semantic-ground-truth`, `component: data-plane`, `gap: G2`.

### `deploy.sh`

* Added global `APP_SPN_CLIENT_ID` variable.
* Phase 1, Step 1a': before the infra deploy, resolves the app SPN from `databricks apps get <app-name>` (via the app bundle summary for the display name). If the app exists, passes `--var app_service_principal_id=<id>` to the infra deploy. If not (first deploy), falls back to the target default and warns.
* Phase 2, Step 2i: after the app deploy, if the app SPN was not available in Phase 1, resolves the live SPN and re-deploys infra to fix the scope ACL.
* `bash -n` syntax check passes.

## Decisions

* The app SPN ID is a variable (not a lookup) because the permissions block is evaluated at deploy time and the API call may fail in CI/CD environments without app access. deploy.sh resolves it dynamically when running interactively.
* PAUSED schedule in dev is acceptable (DAB development mode preset). Documented in a YAML comment. Converge session 22a validates the full path by running the job explicitly.

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` | pass |
| `bundle validate --strict --target prod --var app_service_principal_id=00000000-...` | pass |
| `bash -n deploy.sh` | pass |
| Secret scope YAML has `service_principal_name` with `level: READ` in dev | pass |
| Secret scope YAML has `service_principal_name` with `level: READ` in prod | pass |
| Bronze refresh job has `pipeline_task` with `pipeline_id: ${resources.pipelines.cdf_bronze.id}` | pass |
| Bronze refresh job has `schedule` with hourly cron | pass |
| No files edited outside owned_paths | pass |

## Files Modified

* `ground-truth-infra/databricks.yml` — added `app_service_principal_id` variable + dev default
* `ground-truth-infra/resources/secrets/ground_truth_scope.secret_scope.yml` — fixed comment + added SPN READ in both targets
* `ground-truth-infra/resources/jobs/cdf_bronze_refresh.job.yml` — **new** (bronze refresh job)
* `deploy.sh` — app SPN resolution + infra re-deploy logic
