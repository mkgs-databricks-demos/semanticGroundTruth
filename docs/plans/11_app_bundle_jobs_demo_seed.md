# 11 — App bundle: permissions, bootstrap env, M2M verification, demo seed job

**Wave 1 · edit · owns `ground-truth-app/resources/**`, `ground-truth-app/src/**`, `ground-truth-app/app.yaml`, `ground-truth-app/databricks.yml`**

## Context
* build_conventions §3, §9, §10. The existing `deploy_verification` job got 401 on `/api/*` and `/mcp` because it used the job identity; switch it to the M2M OAuth pattern (verified working 2026-10-22).
* App notebooks are `.ipynb`; check paths on disk before editing YAML.

## Steps
1. `resources/app.app.yml`: add app resource `m2m-client-id` (`secret`, scope `semantic_ground_truth_credentials`, key from a new variable `m2m_client_id_key`, dev default `m2m_client_id_dev`, permission `READ`). Do NOT add a bundle `permissions` block to the app: it replaces the ACL and would drop the M2M SPN's existing `CAN_USE` (verified 2026-10-22 that the M2M SPN holds it). Instead add `CAN_USE` for group `users` additively (`w.permissions.update`) in `src/notebooks/grant_app_permissions.ipynb` (run by `app_post_deploy_setup`), keeping the M2M grant. `app.yaml`: env `GT_BOOTSTRAP_ADMIN_IDS` `valueFrom: m2m-client-id`, `GT_ADMIN_EMAILS` value `matthew.giglia@databricks.com` (dev bootstrap; document in README).
2. `src/notebooks/deploy_verification.ipynb`: call the app with M2M OAuth (`allow_redirects=False`), check `/health`, `/api/me` (roles include `admin`), `/api/campaigns`, `POST /mcp` initialize; fail on any non-200.
3. New `src/notebooks/demo_campaign_seed.ipynb` + `resources/jobs/demo_campaign_seed.job.yml` (key `demo_campaign_seed`, name `${var.app_display_name}-demo-campaign-seed`), tasks:
   * `grant_demo_access` (runs as deployer): resolve the app SPN via `w.apps.get(app).service_principal_client_id`; grant `CAN_READ` on the wanderBricks Git folder to the app SPN; grant `USE CATALOG`/`USE SCHEMA`/`SELECT` on `hls_fde_dev.dev_matthew_giglia_wb_metric_views_care` and `CAN_USE` on warehouse `0ea84986a23a47c3` to the M2M SPN (it is the OBO caller for import). Every grant is idempotent.
   * `seed` (M2M OAuth): register the source, scan, import 3 metric views (`mv_bookings`, `mv_reviews`, `mv_payments`) and all glossary terms from `rapid-ontology-standup/semantics/`, create manual campaign `Demo — WanderBricks semantics` assigned to `semantic-ground-truth-users` if absent, then pull up to 10 review cards and vote (mix approve/reject/edit). Idempotent: skip creation when the campaign exists. First run must cast at least 3 votes; later runs vote on whatever cards remain for the M2M SPN and succeed with 0 if none remain.
   * `verify`: `/api/leaderboard` non-empty and campaign asset count > 0.
4. Keep `deploy_verification` and `app_post_deploy_setup` names unchanged.

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-app`.
* Every notebook path in YAML matches a file on disk; no secret value or SPN id is hard-coded.
