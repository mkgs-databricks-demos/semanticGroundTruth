# 2026-10-24 — Build 4 planning + plan/manifest consolidation

Interactive planning session with the owner. Branch `mg-genie-build-4` (cut from `main` at `0741bc7`). Nothing deployed; no build run.

## Problems

* Gaps left after build 3: skip was stored as a vote (`VOTE_TYPES`) and could not be tracked; no user settings; steward triage APIs missing (G6); feedback pipeline still a stub (G4); no notifications (G5); MCP card not an MCP App (G9); dead infra (G10); no contract tests (G17).
* Plans and manifests were spread across three places (`docs/plans/`, `ground-truth-app/docs/plans/`, `ground-truth-agent/docs/plans/`), with mixed file naming and wave ids reused per build.
* Build sessions were told there is no Node toolchain, so dependency changes and `tsc`/`vitest` could only be checked at deploy time.

## Root causes

* Each build started a new manifest instead of extending one.
* The "no Node toolchain" rule dated from build 1 and was never re-tested.

## Changes

* **Node toolchain re-tested:** nodeenv Node 22.16.0 + pnpm 11.0.8 in /tmp (8 s); `pnpm install --frozen-lockfile`, 331 vitest tests, both `tsc -b` configs pass. Runbook `docs/runbooks/node_toolchain_genie_code.md`. Proof inside a `genie_task` is session 26's job.
* **Consolidation (all `git mv`):** app plans -> `docs/plans/app/`, agent plans -> `docs/plans/agent/`, frozen manifests -> `docs/plans/manifests/` (build-1 app, build-2 root restored from `fbc552b`, build-3 brand gaps, superseded agent). Nine root plans renamed to `<session>_<bundle>_[converge_]<topic>.md`. Superseded READMEs left in the old bundle folders.
* **One manifest:** `docs/plans/waves.json` now holds builds 1-3 as archived waves (`1-0`..`3-6`, condensed) plus build 4 (`4-0`..`4-9`, sessions 25-41). New runtime targets: `infra_setup_cdf`, `infra_metric_view_deploy`, `lb_votes_history`, `lb_assets_history`, `mv_review_activity` (history), `lb_review_skips_history`, `feedback_pipeline`, `agent_ops_dashboard`, `api_contract_tests`, `api_contract_results`; app probes `/api/me/settings` and `/api/review/stats/me`.
* **Build 4 plans 25-41** written (see `docs/plans/INDEX.md`). `build_conventions.md` §0 = build 4 overrides (old §0 -> §0b).
* **Request to mbp:** `docs/requests/2026-10-24_mbp_archived_waves.md` (wave-level `archived` support).
* Stale cross-references fixed in plans 01, 05, 06 and `INDEX.md`.

## Decisions (owner, 2026-10-24)

* Skip is not a vote: `app.review_skips`, counted, never affects scores; cooldown `skip_cooldown_hours` (default 24).
* Feedback branches `mg-genie-feedback-<yyyymmdd>`; pipeline runs as a Genie Code task with versioned skill `ground-truth-feedback-author` 1.0.0.
* G5 webhooks deferred; session 30 researches the workspace Slack MCP connection (`system_ai_agent_slack_mcp`, `OAUTH_U2M_MAPPING`). No messages sent this build.
* `@modelcontextprotocol/ext-apps` pinned at 1.7.5 (2.x needs MCP SDK v2).
* UI redesign goes through Figma Make: build 4 writes the brief, build 5 implements.
* G10 deletions approved (`setup_gateway_connection.py`, `setup_app_role_sp.py`, their tasks, three empty secret YAMLs).
* Old `ground_truth_app_otel_*` tables (empty, unused) approved for drop; the DROP was blocked by the approval layer, so it is a manual step.

## Verification

* `waves.json` parses and passes the genie-build-waves `validate_manifest` from mbp (0 errors, 1 existing warning about `agent_space` without id); 32 waves, 63 unique session ids; every `plan_file` exists; every `depends_on` points at an earlier wave; no `owned_paths` overlap inside any build-4 wave; every context file exists.
* All links in `docs/plans/INDEX.md` resolve.

## Open items

* Commit and push `mg-genie-build-4`, then run setup `818046072228128` and start the build with `only` = `w4-*` task keys.
* Manual: drop the four old OTel tables.

## Files

`docs/plans/waves.json`, `docs/plans/INDEX.md`, `docs/plans/build_conventions.md`, `docs/plans/25_*.md`..`41_*.md`, `docs/plans/manifests/*`, `docs/plans/app/**`, `docs/plans/agent/**`, plans 01/05/06, `docs/runbooks/node_toolchain_genie_code.md`, `docs/requests/2026-10-24_mbp_archived_waves.md`, `ground-truth-app/docs/plans/README.md`, `ground-truth-agent/docs/plans/README.md`, `docs/sessions/INDEX.md`.
