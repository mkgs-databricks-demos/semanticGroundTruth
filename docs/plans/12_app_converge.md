# 12 — Converge: app deploy, RBAC bootstrap, demo campaign

**Wave 2 · converge (alone) · targets `app`, `app_deploy_verification`, `demo_campaign_seed`**

## Goal
The app runs the wave 1 code in dev, migration 007 is applied, the M2M SPN is an admin through app groups, and the demo campaign has imported assets and votes in Lakebase.

## Steps
1. From `ground-truth-app`: `bundle validate --strict --target dev`, then deploy + `bundle run app` (manifest `deploy_commands`). Read OTel logs for the active deployment (`semantic_ground_truth_otel_logs`, `app.deployment_id`); fix build/runtime errors within owned paths; redeploy.
2. Confirm `listening on` and that migration `007_rbac_sources_cdf` is logged as applied.
3. `bundle run app_post_deploy_setup --target dev` once (adds `CAN_USE` for `users` additively; must not remove the M2M SPN grant — confirm with `databricks permissions get apps dev-semantic-ground-truth`).
4. `bundle run deploy_verification --target dev` until green (`/api/me` roles include `admin`).
5. `bundle run demo_campaign_seed --target dev` until green. If `grant_demo_access` fails on a permission you cannot fix in code, stop with `status: fail` and the exact grant needed.
6. Never change `ground-truth-app/docs/plans/**`.

## Stable when
Runtime gate passes: app RUNNING through the soak with 0 error lines, probes pass (`/health`, `/api/me` with `admin`, MCP initialize), ≥ 1 server trace after the probes, both jobs `SUCCESS` in this run.
