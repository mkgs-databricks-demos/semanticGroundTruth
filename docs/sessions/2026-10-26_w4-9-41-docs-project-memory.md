# Session 41 (wave 4-9): docs, project memory, gap status

**Date:** 2026-10-26 (finished 2026-10-27 UTC)
**Job / run / task:** `1079028753739581` / `655172288447819` / `w4-9_session`
**Mode:** edit (workflow `git`, branch `mg-genie-build-4`, HEAD `e5156d4` at start; no git writes)
**Depends on:** 36, 37, 38, 39, 40 (all pass in run `655172288447819`)
**Plan:** `docs/plans/41_root_docs_project_memory.md`

## What was done

* **Gap status** (`docs/plans/gap_analysis_2026-10.md`): update note at the top, note that the §5 follow-ups closed in build 4, new §6 "Status after build 4" (G4, G9, G10, G17 Done; G6 backend done, UI in build 5; G11 partial; G5 researched) with evidence links.
* **Plan index** (`docs/plans/INDEX.md`): build 4 row status; Status column on the build 4 session table (commit, attempt, blocking notes for 36 and 38).
* **Runbooks (new):** `docs/runbooks/contract_tests.md` (in-process vs live layers, run, read `api_contract_results`, add a route/tool, regenerate manifest + schema), `docs/runbooks/feedback_pipeline.md` (4-task flow, `voteIds` marking, dedicated Git folder, manual run, steward review and status transitions, troubleshooting), `docs/runbooks/deploy_order_and_permissions.md` (infra -> app -> data plane -> agent, deployer `MANAGE`, OTel `TABLE` grants, unattended deploy limit, agent skills volume, executive dashboard URL).
* **Runbook (updated):** `docs/runbooks/cdf_bronze_operations.md` §1 rewritten as CDF re-snapshot recovery with `reset_checkpoint_selection` (never full refresh, never `skipChangeCommits`); §3 adds `lb_review_skips_history` and `lb_user_settings_history`; §4 `mv_review_activity` sources and skip measures.
* **Project memory x4:** root (build 4 status log row, targets row, notifications decision, design/research/runbook inventory), app (routes 50, tools 13, migration 009, contract jobs, skills volume, OTel grants, final deployment), infra (feedback pipeline, `batchId` vs `voteIds`, dedicated feedback Git folder, `genie_response` via `runs/get-output`, `mv_review_activity` dedupe, G10 removals; closes requests from sessions 28, 37, 38), agent (ops dashboard id, 29/29 verification, build 4 complete).
* **READMEs x4:** root (build 4 status, manifest/summary links), app (route table from `manifest.json`, MCP tool table, MCP App card, bundle jobs, Testing section, unattended deploy note), infra (feedback pipeline flow), agent (operations dashboard, deploy order).
* **Build summary (new):** `docs/sessions/2026-10-26_build-4-summary.md` (waves, gaps, what was built, problems and root causes, decisions, open items for build 5).

## Decisions

* `docs/sessions/INDEX.md` not edited: SKILL step 6 says the integrator updates it, and the session scope does not name it. Rows for session 41 and the build 4 summary go in at integration.
* The app README keeps a `POST /mcp` row outside `ROUTE_CONTRACTS`, labelled as such.

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| Branch | pass | `mg-genie-build-4`, HEAD `e5156d4` |
| App README route table vs `tests/contract/manifest.json` | pass | 50/50 routes match (plus the labelled `/mcp` row) |
| App README MCP tool table vs manifest | pass | 13/13 tools; resource `ui://ground-truth/review-card` |
| Stale counts grep (old route/tool/bronze counts) | pass | none in PM, READMEs, runbooks |
| Relative links in runbooks and READMEs | pass | no broken targets |
| Changed files inside `owned_paths` | pass | `git status`: 11 modified + 5 new, all owned |
| `bundle validate --strict` | skipped | no YAML touched |

## Requests (open, for build 5)

* infra: `feedback_pipeline` default `repo_path` -> dedicated folder `semanticGroundTruth-feedback` (session 38).
* infra: `post_deploy_setup` `setup_cdf_config` widget mismatch, optional `app_sp_client_id` cleanup, optional `bundle_target` param (sessions 27, 28).
* agent: `hex()` for BINARY ids in 3 ops dashboard datasets (session 39).
* app: optional `max_retries: 0` on `api_contract_tests` (session 40); `resurfacedFromSkip` on `ReviewCard`, branch URL on `FeedbackBranch` (session 32).
* integrator: add session 41 and build 4 summary rows to `docs/sessions/INDEX.md`.

## Files

Modified: `PROJECT_MEMORY.md`, `README.md`, `docs/plans/INDEX.md`, `docs/plans/gap_analysis_2026-10.md`, `docs/runbooks/cdf_bronze_operations.md`, `ground-truth-{app,infra,agent}/PROJECT_MEMORY.md`, `ground-truth-{app,infra,agent}/README.md`.
New: `docs/runbooks/contract_tests.md`, `docs/runbooks/feedback_pipeline.md`, `docs/runbooks/deploy_order_and_permissions.md`, `docs/sessions/2026-10-26_build-4-summary.md`.
