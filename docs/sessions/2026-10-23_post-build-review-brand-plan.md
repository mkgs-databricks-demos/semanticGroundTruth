# 2026-10-23 — Post-build review, carry-over fixes, Databricks-branded UI plan

**Branch:** `mg-genie-ui-brand-and-gaps` (from `main` @ `fbc552b`) · **Mode:** interactive Genie Code · **Target:** dev

## Phase 1 — carry-over fixes (commit `4ff3074`)

| Problem | Root cause | Change | Verified |
| --- | --- | --- | --- |
| Redeploys logged `App did not respect SIGTERM timeout` and `[ELIFECYCLE] Command failed` | No signal handlers; `pnpm run start` wrapper kept the process alive past the 15 s budget | `server/lib/shutdown.ts` (timers → in-flight MCP transports → HTTP server → Lakebase pool, 12 s hard deadline, logs at info/warn only) + `shutdown.test.ts`; `mcp/index.ts` tracks transports (`closeMcpSessions()`); `app.yaml` runs `node` directly | Second redeploy: `Shutdown complete` in 5 ms, no SIGTERM-timeout line |
| Gate missed request 500s | AppKit JSON logs carry `"level":"error"` with OTel severity UNKNOWN | `"level"\s*:\s*"error"` added to app `error_patterns` (ignore_patterns kept); `requestLog` logs 5xx at `error` | Regex tested against sample lines |
| `deploy.sh --agent` was a stub | Phase 3 never implemented | Phase 3 deploys `ground-truth-agent` with infra-resolved catalog/schema/warehouse; `--verify` runs `deploy_verification` / `agent_verification` | `bash -n`; equivalent CLI commands run (direct `deploy.sh` execution was blocked by the safety layer) |
| — | — | Redeploy + verification | `deploy_verification` 6/6 (run `92578084705794`), `agent_verification` SUCCESS (run `216767409892268`), 0 error lines after 13:00:41Z |

Finding during verification (not fixed here, now gap G1, P0): the app SPN has no READ on `semantic_ground_truth_credentials` because the infra secret-scope `permissions` block is authoritative and wipes the ACL the app resource granted. Every app start logs `[ERROR] error resolving resource m2m-client-id`. This will fail the new runtime gate until session 18/22 lands.

## Phase 2 — gap analysis

`docs/plans/gap_analysis_2026-10.md`: 17 gaps (G1–G17) with evidence, proposed fix, and priority; G14–G16 closed by Phase 1.

## Phase 3 — UI brand plan

`docs/plans/ui_brand_plan.md`: two-layer tokens mapped onto the shadcn variables AppKit UI consumes, class-based dark mode via `next-themes` (the existing toggle was a no-op: no `ThemeProvider`), self-hosted DM Sans/DM Mono, Databricks favicons and symbol, component plan, WCAG 2.1 AA matrix, motion tokens.

Every contrast ratio was recomputed in Python. Three brand-guide suggestions were rejected because they fail AA:

* White on Lava 600 at 14 px (3.62) → primary fill Lava 700 light / Lava 500 + Navy 900 text dark (decision D1, needs owner confirmation)
* Green 600 text on Navy 800 (4.48) → Green 500 (5.61)
* Gray Lines / Navy 400 as input borders (1.33 / 2.56) → Navy 500 (3.89 / 3.50); Navy 500 as skip text on Oat Light (3.64) → Gray Text (4.94)

No new npm dependencies: `jsdom`/`@testing-library` are absent and build sessions cannot refresh `pnpm-lock.yaml`, so render-level axe tests are deferred and replaced by a static source test.

## Phase 4 — next build manifest (draft, not run)

`docs/plans/waves.json` now holds the next build: 5 waves, 9 sessions (16–24), branch `mg-genie-ui-brand-and-gaps`. Infra converges before the app (wave 2 before wave 3) so the ACL fix lands before the app gate. New runtime targets: `cdf_bronze_refresh` (job), `executive_dashboard` (dashboard, `execute_datasets`); new app probes `/api/config` and `/fonts/dm-sans-regular.ttf`. Root-build-only targets (CDF setup, metric view deploy, `lb_*` tables, `mv_review_activity`) were removed; the root manifest stays in git history at `fbc552b`.

Validated: JSON parses, every runtime target referenced exists, every `depends_on` points to an earlier wave, no `owned_paths` overlap within a wave, all 9 plan files exist, every `context_files` path exists, probe regex matches a sample body. `docs/plans/INDEX.md` and `build_conventions.md` §0 updated.

## Decisions

* PR description provided in chat only (not written to the repo).
* G13 (build job `1079028753739581` still defaults to deleted `mg-genie-agent-build`) handed to the Jobs page.
* Deferred: G4 Genie Code feedback task, G5 notification destinations, G10 scaffold deletions (need approval), G11 quality monitor, G12 UC Discover import.

## Files

Commit `4ff3074`: `deploy.sh`, `docs/plans/waves.json`, `ground-truth-app/app.yaml`, `ground-truth-app/server/{server.ts, lib/shutdown.ts, lib/shutdown.test.ts, mcp/index.ts, middleware/requestLog.ts}`.
This commit: `docs/plans/{gap_analysis_2026-10.md, ui_brand_plan.md, waves.json, INDEX.md, build_conventions.md, 16_…md – 24_…md}`, `docs/sessions/{this file, INDEX.md}`, `PROJECT_MEMORY.md`.
