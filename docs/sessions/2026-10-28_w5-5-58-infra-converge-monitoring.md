# Session 58 (build 5, wave 5-5, converge): bronze monitor prod-only (D-B5-4) + visual-checks volume

* **Run:** `229891579528310` (job `884230801831394`), branch `mg-genie-build-5` (HEAD `2038e82`), mode `converge`, runtime target `bronze_lakebase_cdf` (table).
* **Plan:** `docs/plans/build-5/58_infra_converge_monitoring.md` (rescoped by D-B5-4).
* **Status:** **blocked**. Steps 1, 2, 3 and 5 are proven or done, and the runtime target passes. Step 4 fails: the `ui_visual_checks` volume exists, but the M2M SPN has **no** `READ VOLUME` / `WRITE VOLUME` grant on it. The owner's grant path is in ground-truth-app (outside this session's owned paths and runtime targets), and it has not run since the owner's change.

## Step 1: dev infra deploy (attempt 1)

The owner changed infra files after session 57's deploy (`6d2b95f`: `ui_visual_checks.volume.yml`; `2038e82`: post_deploy_validation job + notebook), so I redeployed, following `deploy.sh --infra` step by step (its shell CLI cannot run in this session; see session 57):

1. `bundle plan --target dev`: `update jobs.feedback_pipeline` only, 22 unchanged. No quality monitor in the plan.
2. Captured `author_feedback_branch` configuration_id X = `genie_code/users/1081964970114387/scheduled_insights/20536fcdc3b647448babc91f3e5e44ae`.
3. `bundle deploy --target dev --var run_setup=false --var app_service_principal_id=9f3db838-…` (runDatabricksCli, from `ground-truth-infra`): **completed** (93 files uploaded; 0 created, 1 changed, 0 deleted, 22 unchanged). No 429 hang this time.
4. `bundle run post_deploy_setup --params run_setup=true,previous_configuration_id=X --no-wait` → run `235080611783693`: **SUCCESS** (all tasks; `setup_cdf_config` excluded because app_url is empty). `author_feedback_branch` is a genie_task again with the same X.

## Step 2: dev has no monitor: proven

* `bundle summary --target dev` has no `Quality Monitors` section; `ui_visual_checks` and `agent_skills` volumes are deployed.
* `w.quality_monitors.get("hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.bronze_lakebase_cdf")` → `ResourceDoesNotExist: Cannot find Monitor ...`.

## Step 3: prod keeps the monitor: proven

* `bundle validate --strict --target prod --var app_service_principal_id=00000000-0000-4000-8000-000000000000` → `Validation OK!` (mode `production`).
* `bundle summary --target prod` lists `Quality Monitors: bronze_lakebase_cdf` (table `${resources.schemas.ground_truth_schema...}.bronze_lakebase_cdf`; prod catalog `prod_ground_truth`, schema `semantic_ground_truth`).
* Resolved settings (from the validate output and the YAML; the tool truncated the JSON in the middle of the monitor block, so the last fields are read from the YAML file, which has no target overrides): `assets_dir` `/Workspace/Users/matthew.giglia@databricks.com/.bundle/ground-truth-infra/prod/monitoring/bronze_lakebase_cdf`; `time_series` `{timestamp_col: _timestamp, granularities: [1 hour, 1 day]}`; `slicing_exprs` `[_source_table]`; `schedule` `{quartz_cron_expression: "0 0 6 * * ?", timezone_id: UTC}`. Prod runs in production mode, so the schedule is kept (session 57 saw development mode drop it).

## Step 4: volume grants: FAIL (blocked)

* `w.volumes.read("hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.ui_visual_checks")` → MANAGED volume exists.
* `GET /api/2.1/unity-catalog/permissions/volume/...ui_visual_checks` → `{}` (no direct grants). `SHOW GRANTS ON VOLUME` shows only inherited catalog / metastore grants (owner user, a catalog-admin SPN, `account users` READ METADATA). The M2M SPN has only `USE SCHEMA` on the schema (shown as `[REDACTED]` because its application id is the secret scope value).
* **Root cause:** in `6d2b95f` the owner moved the grant out of the infra volume YAML into ground-truth-app's `app_post_deploy_setup` job (`grant_app_permissions`, parameter `visual_checks_volume`, fired by `run_app_post_deploy.job_run.yml`). The deployed app job `490114363376686` (`[dev matthew_giglia] dev-semantic-ground-truth-post-deploy-setup`) last ran on 2026-10-23 00:57 UTC, so the ground-truth-app bundle has not been deployed or run since that commit. ground-truth-app is not in this session's owned paths or runtime targets, so I did not deploy it and did not grant by hand (that would bypass the owner's design).

## Step 5: runbook

`docs/runbooks/cdf_bronze_operations.md` §6 now says the monitor is prod-only (D-B5-4), why (1000-monitor limit, 429 + CLI retry hang), what session 58 verified, and how to re-enable it in dev once quota allows (move the block to top-level `resources:`, validate, deploy, refresh by hand; back out if the deploy stalls). The schedule row now covers production vs development mode. For session 63.

## Runtime target `bronze_lakebase_cdf`

The table resolves, has all 10 `required_columns`, and has 796 rows (`min_rows` 1; `require_fresh_deployment: false`).

## Attempts

| # | Deploy | Classification | Errors | Fix |
|---|---|---|---|---|
| 1 | infra `bundle deploy --target dev` (completed) + post_deploy_setup `235080611783693` SUCCESS | stable | none for the infra deploy; volume grant missing (outside owned paths) | none needed in owned paths |

Self-soak: not applicable (no app). The deploy completed, and the table and job state did not change.

## Checks

| Check | Result |
|---|---|
| `bundle deploy --target dev` (infra) completes, no monitor | pass |
| post_deploy_setup run_setup=true keeps configuration_id X | pass |
| `bundle summary --target dev` has no Quality Monitors; `quality_monitors.get` not found | pass |
| `bundle validate --strict --target prod` | pass |
| `bundle summary --target prod` lists `quality_monitors.bronze_lakebase_cdf` | pass |
| `bundle validate --strict --target dev` (final code) | pass |
| runtime target `bronze_lakebase_cdf` (columns, rows) | pass |
| `ui_visual_checks` volume exists | pass |
| M2M SPN READ_VOLUME + WRITE_VOLUME on `ui_visual_checks` | **fail** |

## Files changed

* `docs/runbooks/cdf_bronze_operations.md` (§6)

Assets changed: `jobs.feedback_pipeline` (811289891166091, redeployed then re-patched to genie_task X), post_deploy_setup run `235080611783693`, infra bundle files under `.bundle/ground-truth-infra/dev/files`.

## Requests

1. **Owner (ground-truth-app):** deploy the app bundle to dev (`./deploy.sh --target dev --app` or `bundle deploy` from `ground-truth-app`) so `run_app_post_deploy` runs `app_post_deploy_setup` with `visual_checks_volume=hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.ui_visual_checks`. Then confirm with `SHOW GRANTS ON VOLUME ...ui_visual_checks` that the M2M SPN (`semantic-ground-truth-m2m*`, application id in `m2m_client_id_dev`) has `READ VOLUME` and `WRITE VOLUME`. Then set `58.json` to `pass` (add the grant check result) and repair from `w5-5_integrate`.

## Notes

* In this session, the SCIM service-principal list and `dbutils.secrets.get` through `WorkspaceClient` fail with `Invalid delegation claim present in Ctx`, so I could not resolve the M2M SPN's display name. UC grants and Jobs API calls work.
* A direct `jobs.run_now` on job 159451853337655 was blocked by the safety guardrail (job not named in the task). `bundle run post_deploy_setup --no-wait` from the infra bundle worked.
