# 2026-10-26: Agent skills UC volume, OTel table grants, wave 4-4 unblock

**Branch:** `mg-genie-build-4` · **Build run:** `110489694161084` (build 4) · **Mode:** owner (interactive) + planner review · **Status:** done; build paused before the wave 4-4 repair

## Problems

1. **Session 36 (wave 4-4, app converge) ended `blocked`** (`8be12a8`):
   * The app SPN `9f3db838-9415-46fe-9722-9654a6856ecc` lost `USE CATALOG` on `hls_fde_dev` when the grant to `account users` was removed (2026-10-24 03:37Z). OTel export to `semantic_ground_truth_otel_*` stopped, so the runtime gate saw no markers, errors or traces.
   * From an unattended `genie_task`, `bundle deploy` fails at `apps update` with `Invalid delegation claim`, so the session could not apply the app config.
2. **Agent skills** were served from `server/agents/skills/` in the app source. During the owner's work the app logged `Agent 'review-assistant' lists skill '…' in 'skills:', but no global or per-agent skill with that name exists` (05:31 and 05:37 UTC starts).
3. **Session 35's two open requests** (MCP bare-array `structuredContent`; `requireObo` throws a plain `Error`) had no owner.

## Root causes

* Telemetry depended on a catalog grant to `account users` instead of a grant tied to the app.
* `apps update` needs a user delegation claim that a scheduled Genie Code task does not carry.
* AppKit's agents plugin reads catalog skills from a UC volume (`DATABRICKS_VOLUME_AGENT_SKILLS`); the commented-out `agents-skills` resource left it without a volume path.

## Changes (owner, interactive, continuing session 35's conversation)

* **OTel grants:** `resources/app.app.yml` adds `otel-logs`, `otel-spans`, `otel-metrics` as `uc_securable` `TABLE` resources with `MODIFY`. Databricks then grants the app SPN `USE CATALOG`/`USE SCHEMA` on the parents. Needs the deployer to have `MANAGE` on the catalog.
* **Agent skills volume:**
  * `git mv ground-truth-app/server/agents/skills/* ground-truth-app/agent_skills/` (`review-guide`, `scoring-model`, `tracer-bullets`; content unchanged).
  * Infra: `ground-truth-infra/resources/agent_skills.volume.yml` (managed volume `agent_skills`, `prevent_destroy`).
  * App: `agents-skills` resource (`READ_VOLUME` on `${var.agents_skills_path}`, new variable, default `<catalog>.<schema>.agent_skills`) and `config.env` `DATABRICKS_VOLUME_AGENT_SKILLS=/Volumes/<catalog>/<schema>/agent_skills`.
  * Job `sync_agent_skills` (`resources/jobs/sync_agent_skills.job.yml`, notebook `src/notebooks/sync_agent_skills.ipynb`): `mirror` validates each skill folder (has `SKILL.md`, frontmatter `name` = folder name), uploads new/changed files, deletes stale ones, verifies the volume equals git, sets task value `changed`; `restart` waits for in-flight deployments, then stops and starts the app (re-runs the active deployment with its bundle env vars; a plain `apps deploy` would build with `NODE_ENV=production` and fail `prebuild`).
  * Deploy hook `resources/jobs/run_sync_agent_skills.job_run.yml` (`on_file_change: ../../agent_skills/*/*`).
* **app.yaml:** `GT_EXEC_DASHBOARD_URL` default is now `""`; the real value comes from `app.app.yml` `config.env` → `${var.exec_dashboard_url}`. Comment notes where `DATABRICKS_VOLUME_AGENT_SKILLS` is set.
* **README:** server tree notes that skills load from the volume.
* **Interactive deploy:** infra (volume) then app; app deployment `01f1d103d536117fab60caa95e43fdb8` at 06:09 UTC.

## Changes (planner, this session)

* `ground-truth-app/databricks.yml` dev target: `exec_dashboard_url` was already the real published URL; the comment block above said "placeholder values". Added a comment that it is the real value for `resources.dashboards.executive` id `01f1cf0b38d31b7cbac5bdac6cafe3eb` (checked: dashboard `ACTIVE`, published 2026-10-26 05:27 UTC, same id in `ground-truth-infra` `bundle summary`). Value unchanged.
* `docs/plans/36_app_converge.md`: new "Carried in" section with step 0 (session 35's requests, done when `toolCases.ts` has no `knownDefect`: today 4 `bareArrayStructuredContent` + 3 `oboErrorIsInternal`) and the known `apps update` / `Invalid delegation claim` limit (continue with `bundle run app` if that is the only failure; record a suppression).
* `docs/plans/41_root_docs_project_memory.md`: new task 6 (deploy order infra → app, deployer `MANAGE` on the catalog, agent skills sync flow, exec dashboard URL); build summary is now task 7.

## Verification (planner review, 2026-10-26 ~06:30 UTC)

| Check | Result |
| --- | --- |
| OTel rows since 06:09 | logs 5,735 · spans 110 · metrics 48,184 |
| Skills resolve | no "no … skill with that name exists" warnings from the 05:45 start on; both agents loaded |
| App | `RUNNING` / compute `ACTIVE`, `listening on port 8000`; `ERROR` lines in logs are contract-test stderr from `prebuild` |
| Volume | `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.agent_skills` with the 3 skill folders |
| `sync_agent_skills` | latest run `750352885186398` SUCCESS (3 earlier runs failed during iteration) |
| `bundle validate --strict --target dev` | pass for `ground-truth-app` and `ground-truth-infra` |

Not verified: `/api/config` on the deployed app (auth sidecar blocks calls from here); session 36 checks it in its probes.

## Decisions

* Keep `exec_dashboard_url` as a full URL variable (no switch to an id variable); `deploy.sh` and the dev default build the same URL.
* Session 35's requests go to session 36 (owns `ground-truth-app/**`); deploy-order and permission docs go to session 41.
* Next: repair run `110489694161084` from `w4-4_sessions` (fresh session 36). Waiting for the owner.

## Files modified

* `ground-truth-app/README.md`, `ground-truth-app/app.yaml`, `ground-truth-app/databricks.yml`, `ground-truth-app/resources/app.app.yml`
* `ground-truth-app/agent_skills/**` (renamed from `ground-truth-app/server/agents/skills/**`)
* `ground-truth-app/resources/jobs/sync_agent_skills.job.yml`, `ground-truth-app/resources/jobs/run_sync_agent_skills.job_run.yml`, `ground-truth-app/src/notebooks/sync_agent_skills.ipynb`
* `ground-truth-infra/resources/agent_skills.volume.yml`
* `docs/plans/36_app_converge.md`, `docs/plans/41_root_docs_project_memory.md`
* `docs/sessions/2026-10-26_agent-skills-volume-otel-grants.md`, `docs/sessions/INDEX.md`
