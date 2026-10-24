# Session 41: Docs, project memory, gap status (build 4)

**Build 4 · wave `4-9` · edit · root**

## Tasks

1. Read every build-4 status file in `.build-status/` and session summaries in `docs/sessions/` and `ground-truth-*/docs/sessions/`.
2. `PROJECT_MEMORY.md` (root) and each bundle `PROJECT_MEMORY.md`: new tables (`app.review_skips`, `app.user_settings`, migration 009), new routes (49) and tools (13), MCP App, operations dashboard id, `api_contract_tests` job id and results table, feedback branch convention `mg-genie-feedback-<yyyymmdd>` and the first branch name, skill `ground-truth-feedback-author` version, removed G10 items, Node toolchain runbook. Replace stale facts; do not append duplicates.
3. READMEs: root `README.md` (architecture + jobs table), `ground-truth-app/README.md` (API table regenerated from `ROUTE_CONTRACTS`, MCP tool table, testing section: `pnpm test`, contract job), `ground-truth-agent/README.md` (dashboard), `ground-truth-infra/README.md` (feedback pipeline flow).
4. `docs/plans/gap_analysis_2026-10.md`: update G4, G5 (link `docs/research/05_slack_mcp_notifications.md`), G6 (backend done; UI in build 5), G9 (MCP App), G10, G17 (contract tests) with evidence links. `docs/plans/INDEX.md`: fill the build-4 status column only.
5. `docs/runbooks/`: add `contract_tests.md` (how to run, read `api_contract_results`, add a route) and `feedback_pipeline.md` (how a steward reviews/merges a `mg-genie-feedback-*` branch).
6. Build summary `docs/sessions/<date>_build-4-summary.md` + `docs/sessions/INDEX.md` row (reverse-chronological).

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
