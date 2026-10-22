# 2026-10-22 — First deploy completion: interactive controller session

## Summary

Interactive controller session spanning 2026-10-21 through 2026-10-22. Managed the genie-build-waves build of `ground-truth-app` from wave 6 planning through the passing of wave 8 (deploy verification). Resolved five blocking issues across seven build runs before achieving a clean pass on run `645309454613045` (waves 7–8 only, new framework).

The app is deployed as `dev-semantic-ground-truth` on `fevm-hls-fde`, RUNNING on deployment `01f1cdc76e341d749b3d5248807e3334`. All 18 Lakebase tables are present and owned by the app's service principal. The deploy verification job passed 12/12 checks.

## Problems and root causes

### 1. Branch switching mid-session swapped pnpm-lock.yaml
**Problem:** Session 19 (run 963652240700815) failed all 5 deploy attempts with `ERR_PNPM_OUTDATED_LOCKFILE` / `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`.
**Root cause:** The interactive session created branch `mg-genie-agent-build` from `main` for Part B (agent) planning while session 19 was running. The workspace git folder checkout switched the working tree to the new branch, which had the original scaffold lockfile (missing `@modelcontextprotocol/sdk`, `@tanstack/react-query`, `framer-motion`). Session 19's deploy attempts read the scaffold lockfile.
**Resolution:** Consolidated agent planning artifacts onto `mg-genie-app-first-deploy` via `git checkout mg-genie-agent-build -- <paths>`. Deleted `mg-genie-agent-build` (local + remote). The regenerated lockfile was restored.
**Framework fix (pending):** genie-build-waves commit `2a41681` adds a branch check before each deploy; sessions now stop with `status: "error"` if the git folder was switched.

### 2. Stray session files from failed integrators
**Problem:** Runs 376065156883918 and 743159204973081 both failed wave 0 gate with `"1 stray file"`. The gate detected untracked session summary `.md` files in the working tree.
**Root cause:** When `wN_integrate` hits a transient `INTERNAL_ERROR: start_agent_run`, it exits before committing session summaries already written by the session task. Those files remain untracked and fail subsequent run gates.
**Resolution:** Manually committed all stray files before each retry. Three files total: `2026-10-21_w3-09-rest-routes-revalidate.md`, `2026-10-21_w0-01-shared-contracts-revalidate2.md`, and a modified `2026-10-21_w0-02-server-foundation.md`.
**Framework fix (pending):** Integrator now classifies leftovers as `carryover_files` and auto-commits summaries.

### 3. Transient `INTERNAL_ERROR: start_agent_run` on integrators
**Problem:** `w3_integrate` failed on runs 376065156883918 and 775796262964574. `w6_integrate` also hit this on run 775796262964574.
**Root cause:** Platform-level transient in the Genie Code agent runner. No code or config issue.
**Resolution:** Full restarts (should have been repair runs — lesson learned).
**Framework fix (pending):** Genie Code tasks now get `max_retries: 2` with 60s intervals.

### 4. Session 19 status file format mismatch
**Problem:** Run 187770715982911 wave 7 gate failed with `session 19: status=None` even after all gate checks passed and the stray file was committed.
**Root cause:** Session 19 wrote `result: "pass"` + `attempts: 7` (integer count) instead of the schema the gate notebook expects: `status: "pass"` + `attempts: [...]` (list with last entry `result: "stable"`).
**Resolution:** Manually reformatted `19.json` to match the `genie-build-session-runner` schema using data from the session summary. Repaired `w7_gate` — but that alone didn't work because the gate reads from the integrator's JSON (see #5). Eventually repaired `w7_integrate` with dependents, which rewrote the gate JSON and unlocked the cascade.
**Framework fix needed:** The session runner skill or integrator should validate status file format before accepting it.

### 5. Lakebase schema ownership — `permission denied for schema app/appkit`
**Problem:** Run 187770715982911 wave 7 runtime gate failed: 2 OTel error lines from AppKit's persistent cache migration (`permission denied for schema appkit`) and the app's own migration runner (`permission denied for schema app`). Plus the `listening on` startup marker was never logged.
**Root cause:** The `app` and `appkit` Postgres schemas were owned by `matthew.giglia@databricks.com` (created during local development / scaffold run). The app's service principal (`9f3db838-…`) has `CAN_CONNECT_AND_CREATE` — it can create new schemas but cannot use schemas owned by others.
**Resolution:** Dropped both schemas (`DROP SCHEMA app CASCADE` / `DROP SCHEMA appkit CASCADE`) so the app SPN recreates and owns them on first startup. Also updated plan 19 to: (a) add a `listening on port <port>` log line, (b) remove the `runMigrations` try-catch workaround, (c) verify no permission errors after deploy.
**Result on run 645309454613045:** Session 19 passed in 2 attempts (vs 7 previously). Schemas owned by `9f3db838-…`, 18 tables created, 0 error lines, startup marker present.

## Runs

| Run ID | Waves | Outcome | Blocking issue |
|--------|-------|---------|----------------|
| `963652240700815` | 6–8 | w7 blocked | #1 lockfile swap (branch change) |
| `376065156883918` | 0–8 (full) | w0 fail | #2 stray `w3-09` summary + #3 transient integrate |
| `743159204973081` | 0–8 (full) | w0 fail | #2 stray `w0-01` summary (repair race) |
| `187770715982911` | 0–8 (full) | w7 fail (3 repairs) | #4 status format + #5 schema ownership + missing marker |
| `645309454613045` | 7–8 (`only`) | **PASS** | — |

## Key decisions

1. **Full restarts → repair runs.** Early runs were restarted from scratch after transient errors, wasting completed wave work. Changed to `repair_run(rerun_tasks=[...], rerun_dependent_tasks=True)` for subsequent failures. Learned that repairing `wN_gate` alone doesn't work — must repair `wN_integrate` with dependents.

2. **Drop schemas, don't grant.** Infra can't know the app SPN before first deploy. The lakeLoom pattern (app-owned migrations) requires the app SPN to CREATE the schemas so it becomes the owner. Dropping and letting the app recreate is the correct first-deploy workflow.

3. **Consolidated branches.** Merged agent planning onto the active `mg-genie-app-first-deploy` branch and deleted `mg-genie-agent-build`. One active branch at a time in a monorepo workspace.

4. **Upgraded genie-build-waves framework.** Deployed `2a41681` (from `mg-genie-build-waves-init` in `mbp`) after run 187770715982911 terminated. New features: automatic task retries, carryover-file classification, branch safety check. Used `only` parameter to skip waves 0–6.

5. **Session 19 plan updated for rerun.** Added context about already-committed TS fixes, schema ownership reset, startup marker requirement, migration catch removal, and correct status file format.

## Changes made by the interactive session (not by build sessions)

| File | Action | Reason |
|------|--------|--------|
| `docs/plans/waves.json` | updated | Added waves 6–8, runtime_targets |
| `docs/plans/INDEX.md` | updated | Wave map for waves 6–8 |
| `docs/plans/17_fix_error_code_casts.md` | created | Wave 6 session plan |
| `docs/plans/18_campaign_completed_at_rbac.md` | created | Wave 6 session plan |
| `docs/plans/19_converge_app.md` | created + updated twice | Wave 7 converge plan; added schema ownership, marker, catch removal |
| `docs/plans/20_converge_deploy_verification.md` | created | Wave 8 verification plan |
| `pnpm-lock.yaml` | regenerated | 10,107 lines; `pnpm install --no-frozen-lockfile` |
| `.npmrc` | created | `frozen-lockfile=false` (informational; build ignores it) |
| `server/middleware/roles.ts` | committed | Undeclared TS6133 fix from session 19 (req → _req) |
| `ground-truth-agent/` (8 files) | created | Agent bundle planning (sessions 01–03, waves.json, PROJECT_MEMORY.md) |
| `.build-status/187770715982911/19.json` | reformatted | Status file format mismatch (.gitignored) |

## Verification

| Check | Result | Method |
|-------|--------|--------|
| App RUNNING | ✅ | `w.apps.get()` — deployment `01f1cdc76e341d749b3d5248807e3334` |
| Schema ownership | ✅ | `pg_namespace` query — `app` + `appkit` owned by `9f3db838-…` |
| Table count | ✅ 18 | `pg_tables WHERE schemaname='app'` |
| OTel: `listening on` marker | ✅ | Gate runtime check (wave 7, run 645309454613045) |
| OTel: 0 error lines | ✅ | Gate runtime check |
| Post-deploy job | ✅ SUCCESS | Gate runtime check |
| Deploy verification (12/12) | ✅ | Session 20, job run `225279116725097` |
| `bundle validate --strict` | ✅ | Gate static check |
| Branch clean | ✅ | `git status --short` = empty |
| Local = remote | ✅ | Both at `8459d5f` |

## Known gaps

1. **API routes return 401 from job context.** The deploy verification job gets 401 on `/api/*` and `/mcp` because the sidecar doesn't propagate job identity to the app's `getUser()` middleware. Session 20 accepted 401 as "route exists" and verified MCP tool count from source code, not HTTP.
2. **MCP connection inactive.** `semantic-ground-truth-mcp` exists in Unity Catalog but `active=False`. Manual activation or post-deploy hook needed.
3. **Lakebase degradation logging.** The `runMigrations` try-catch is removed, so any future migration failure crashes the app. This is correct behavior, but monitoring should be in place.

## Next steps

1. PR `mg-genie-app-first-deploy` → `main`.
2. Check whether `lb_*_history` Lakehouse Sync tables are populating (required for the agent bundle).
3. Start the agent bundle build (Bundle 3) — plans are committed on this branch.
4. Follow-up wave for authenticated end-to-end verification (MCP tools over HTTP, Lakebase reads through API).
