# Session 41: Docs, project memory, gap status (build 4)

**Build 4 · wave `4-9` · edit · root**

## Tasks

1. Read every build-4 status file in `.build-status/` and session summaries in `docs/sessions/` and `ground-truth-*/docs/sessions/`.
2. `PROJECT_MEMORY.md` (root) and each bundle `PROJECT_MEMORY.md`: new tables (`app.review_skips`, `app.user_settings`, migration 009), new routes (49) and tools (13), MCP App, operations dashboard id, `api_contract_tests` job id and results table, feedback branch convention `mg-genie-feedback-<yyyymmdd>` and the first branch name, skill `ground-truth-feedback-author` version, removed G10 items, Node toolchain runbook. Replace stale facts; do not append duplicates.
3. READMEs: root `README.md` (architecture + jobs table), `ground-truth-app/README.md` (API table regenerated from `ROUTE_CONTRACTS`, MCP tool table, testing section: `pnpm test`, contract job), `ground-truth-agent/README.md` (dashboard), `ground-truth-infra/README.md` (feedback pipeline flow).
4. `docs/plans/gap_analysis_2026-10.md`: update G4, G5 (link `docs/research/05_slack_mcp_notifications.md`), G6 (backend done; UI in build 5), G9 (MCP App), G10, G17 (contract tests) with evidence links. `docs/plans/INDEX.md`: fill the build-4 status column only.
5. `docs/runbooks/`: add `contract_tests.md` (how to run, read `api_contract_results`, add a route) and `feedback_pipeline.md` (how a steward reviews/merges a `mg-genie-feedback-*` branch).
6. **Owner changes from 2026-10-26** (`docs/sessions/2026-10-26_agent-skills-volume-otel-grants.md`), record in root and `ground-truth-app`/`ground-truth-infra` `PROJECT_MEMORY.md` + READMEs, and add a deploy-order section to `docs/runbooks/` (new `deploy_order_and_permissions.md`, or the existing deploy runbook if there is one):
   * **Deploy order:** `ground-truth-infra` first, then `ground-truth-app`. The app's `agents-skills` resource needs the infra `agent_skills` volume (`resources/agent_skills.volume.yml`) to exist.
   * **Deployer permission:** the app's OTel `TABLE` resources (`otel-logs`, `otel-spans`, `otel-metrics`, `MODIFY`) make Databricks grant the app SPN `USE CATALOG`/`USE SCHEMA` on the parents. That automatic grant needs the deployer to have `MANAGE` on catalog `hls_fde_dev` (or the target catalog). Removing those resources also revokes the grants. Telemetry no longer depends on the `account users` catalog grant (removed 2026-10-24 03:37Z).
   * **Agent skills:** sources live in `ground-truth-app/agent_skills/<skill>/SKILL.md` (moved from `server/agents/skills/`). The `sync_agent_skills` job mirrors them into `/Volumes/<catalog>/<schema>/agent_skills` and restarts the app (stop/start, not a new `apps deploy`) only when something changed; `run_sync_agent_skills` (job_run, `on_file_change: ../../agent_skills/*/*`) triggers it on deploy. AppKit reads `DATABRICKS_VOLUME_AGENT_SKILLS` at boot. Do not edit the volume by hand.
   * **Exec dashboard URL:** the app dev target's `exec_dashboard_url` is the real published URL of `resources.dashboards.executive` (id `01f1cf0b38d31b7cbac5bdac6cafe3eb`); `deploy.sh` rebuilds the same URL. Update it if the dashboard is recreated.
7. Build summary `docs/sessions/<date>_build-4-summary.md` + `docs/sessions/INDEX.md` row (reverse-chronological).

## Owned Paths

- `PROJECT_MEMORY.md`, `README.md`
- `ground-truth-app/PROJECT_MEMORY.md`, `ground-truth-app/README.md`
- `ground-truth-infra/PROJECT_MEMORY.md`, `ground-truth-infra/README.md`
- `ground-truth-agent/PROJECT_MEMORY.md`, `ground-truth-agent/README.md`
- `docs/runbooks/**`
- `docs/sessions/**`
- `docs/plans/INDEX.md`, `docs/plans/gap_analysis_2026-10.md`

## Dependencies

- 36, 37, 38, 39, 40
