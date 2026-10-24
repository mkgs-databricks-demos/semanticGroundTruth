# 18 — Infra: app SPN secret-scope READ + scheduled bronze refresh

**Wave 0 · edit · bundle `ground-truth-infra` (+ `deploy.sh`) · gaps G1 (P0), G2**

## Context
* `resources/secrets/ground_truth_scope.secret_scope.yml` declares `permissions` (owner MANAGE only) per target. A secret-scope `permissions` block is authoritative, so every infra deploy removes the READ ACL the app resource (`m2m-client-id` secret) granted. Result on 2026-10-23: `secrets list-acls` = owner only; every app start logs `[ERROR] error resolving resource m2m-client-id for env GT_BOOTSTRAP_ADMIN_IDS`.
* The file's header comment claims a Bundle 2 `configure_app_spn` job grants READ; that job does not exist. Correct the comment.
* `resources/pipelines/cdf_bronze.pipeline.yml` is `continuous: false` and nothing triggers it.

## Steps
1. `databricks.yml`: variable `app_service_principal_id` (description: application id of the app SPN that needs READ on the scope). Dev target default = `55882972-924d-42cd-ab3d-d10c730629c2` (current app SPN). Prod: no default; document that deploy.sh supplies it.
2. Secret scope YAML: in each target's `permissions`, add `- service_principal_name: ${var.app_service_principal_id}` with `level: READ`, keeping owner MANAGE. Fix the header comment.
3. `deploy.sh`: in the infra phase, resolve the app SPN with `databricks apps get <app-name> -o json` (`service_principal_client_id`) when the app exists and pass `--var app_service_principal_id=...`; if the app does not exist yet (first deploy), fall back to the target default and, after the app phase, re-run the infra deploy only when the resolved id differs. Use `safe()` for interpolation; keep `bash -n` clean.
4. `resources/jobs/cdf_bronze_refresh.job.yml`: job `cdf_bronze_refresh`, name `Semantic Ground Truth — Bronze Refresh`, one `pipeline_task` with `pipeline_id: ${resources.pipelines.cdf_bronze.id}` and `full_refresh: false`, `schedule` hourly (`0 0 * * * ?`, UTC), `max_concurrent_runs: 1`, owner email notification on failure, tags per repo convention. Dev mode pauses schedules; note that in a YAML comment (do not force UNPAUSED).
5. `bundle validate --strict --target dev` (and prod with `--var app_service_principal_id=00000000-0000-0000-0000-000000000000` to confirm it parses).

## Done when
Wave 0 gate lines for 18 hold and both validates pass. Deployment happens in session 22.
