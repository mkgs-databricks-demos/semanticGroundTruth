# Deploy order and permissions

What must exist before each bundle deploys, which permissions the deployer needs, and how agent skills reach the app. Recorded from the owner changes of 2026-10-26 ([`docs/sessions/2026-10-26_agent-skills-volume-otel-grants.md`](../sessions/2026-10-26_agent-skills-volume-otel-grants.md)) and the build-4 converge sessions.

## Deploy order

1. **`ground-truth-infra` first.** It owns the schema, warehouse, Lakebase, secret scope, M2M SPN, jobs, the bronze pipeline, the executive dashboard, and the `agent_skills` volume (`ground-truth-infra/resources/agent_skills.volume.yml`, managed volume, `prevent_destroy`).
2. **`ground-truth-app` second.** Its `agents-skills` resource (`READ_VOLUME` on `${var.agents_skills_path}`, default `<catalog>.<schema>.agent_skills`) needs the infra volume to exist. App migrations create the Lakebase `app` schema.
3. **Data plane** (from `ground-truth-infra/`): `setup_lakebase_cdf` -> `cdf_bronze` -> `metric_view_deploy`. Run `post_deploy_setup` with `run_setup=true` after every infra deploy, so `feedback_pipeline.author_feedback_branch` is a `genie_task` again (see [`feedback_pipeline.md`](feedback_pipeline.md)).
4. **`ground-truth-agent` last** (Genie space, operations dashboard, `agent_verification`).

`./deploy.sh --target dev` deploys the bundles in this order (infra -> app -> agent); the data-plane jobs are run separately (root `README.md`, "End-to-end deploy"). On a fresh environment the infra bundle is deployed again after the app exists, so the scope permissions can name the app SPN.

## Deployer permissions

* **`MANAGE` on the target catalog** (dev: `hls_fde_dev`). The app's OTel `TABLE` resources in `ground-truth-app/resources/app.app.yml` (`otel-logs`, `otel-spans`, `otel-metrics`, privilege `MODIFY` on `semantic_ground_truth_otel_{logs,spans,metrics}`) make Databricks grant the app SPN `USE CATALOG` / `USE SCHEMA` on the parents. That automatic grant needs the deployer to have `MANAGE` on the catalog.
* Removing those resources also revokes the grants, and OTel export stops (no logs, spans or metrics, so the build-waves gate sees no markers or traces).
* Telemetry no longer depends on the `account users` catalog grant, which was removed on 2026-10-24 03:37Z. That removal is what blocked session 36's first run.

## Apps deploy from unattended jobs

* From a scheduled Genie Code task, `bundle deploy` fails at `apps update` with `400 Invalid delegation claim present in Ctx`. The planned change is a no-op (`config.env` values are redacted by the API, so old == new). Use `bundle run app --target dev` to deploy the app code; an interactive `bundle deploy` applies config changes.
* Never redeploy the app with a plain `apps deploy` (API or UI) without the bundle env vars: it builds with `NODE_ENV=production`, the `prebuild` client tests fail, and the app becomes `UNAVAILABLE`. Use `bundle run app`, or stop/start the app.

## Agent skills

* **Source:** `ground-truth-app/agent_skills/<skill>/SKILL.md` (moved from `server/agents/skills/`; today `review-guide`, `scoring-model`, `tracer-bullets`). Frontmatter `name` must equal the folder name.
* **Sync:** job `sync_agent_skills` (`ground-truth-app/resources/jobs/sync_agent_skills.job.yml`, notebook `src/notebooks/sync_agent_skills.ipynb`). Task `mirror` validates each folder, uploads new or changed files to `/Volumes/<catalog>/<schema>/agent_skills`, deletes stale ones, checks the volume equals Git, and sets the task value `changed`. Task `restart` runs only when something changed: it waits for in-flight deployments, then stops and starts the app (not a new `apps deploy`).
* **Trigger:** `ground-truth-app/resources/jobs/run_sync_agent_skills.job_run.yml` (`on_file_change: ../../agent_skills/*/*`) runs the sync on deploy when a skill file changed.
* **Runtime:** AppKit reads `DATABRICKS_VOLUME_AGENT_SKILLS` at boot. It is set in `app.app.yml` `config.env` (`/Volumes/<catalog>/<schema>/agent_skills`); an `app.yaml` `valueFrom` for the volume resource did not reach AppKit.
* Do not edit the volume by hand. Change the files in Git and deploy.

## Executive dashboard URL

The app dev target's `exec_dashboard_url` (`ground-truth-app/databricks.yml`) is the real published URL of `resources.dashboards.executive` (id `01f1cf0b38d31b7cbac5bdac6cafe3eb`). `deploy.sh` rebuilds the same URL from the infra bundle. If the dashboard is recreated, update the variable; `/api/config` returns it as `executive_dashboard_url` (the build gate probes it for an `https://` URL).

## Lakebase migrations and bronze

A migration that ALTERs a synced table makes Lakehouse Sync re-snapshot it, which breaks the bronze streams. Recover with `reset_checkpoint_selection`, never a full refresh: [`cdf_bronze_operations.md` §1](cdf_bronze_operations.md#1-cdf-re-snapshot-recovery-reset-the-flow-checkpoint).
