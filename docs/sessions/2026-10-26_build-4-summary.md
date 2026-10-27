# Build 4 summary — skips, steward APIs, MCP App, contract tests, feedback pipeline

**Date:** 2026-10-26 (started 2026-10-24)
**Build job:** `1079028753739581`
**Runs:** `110489694161084` (waves 4-0..4-3) and `655172288447819` (waves 4-4..4-9)
**Branch:** `mg-genie-build-4`
**Manifest:** `docs/plans/waves.json` (sessions 25–41)
**Plans:** `docs/plans/INDEX.md` §Build 4

## Result

All 17 sessions passed. Waves 4-0..4-8 passed their gates; wave 4-9 (this docs session) closes the build.

| Wave | Sessions | Mode | Commit(s) | Result |
| --- | --- | --- | --- | --- |
| 4-0 | 25 contracts + migration 009, 26 Node toolchain + deps, 27 feedback genie_task, 28 skip metrics + G10, 29 ops dashboard, 30 research Slack MCP, 31 design MCP App, 32 UI review + Figma brief | edit | `c4a634d` | pass |
| 4-1 | 33 skip / settings / steward APIs | edit | `e9e4748`, `e14b56f` | pass |
| 4-2 | 34 `review_skip_card` + MCP App review card | edit | `339425c` | pass |
| 4-3 | 35 contract tests (in-process + live job) | edit | `914746f` | pass |
| 4-4 | 36 converge app | converge | `b83fd52` | pass (attempt 1 stable, after an owner unblock) |
| 4-5 | 37 converge infra: skips through CDF / bronze / metric views | converge | `1a987a8` | pass (attempt 3 stable) |
| 4-6 | 38 converge infra: feedback pipeline end to end | converge | `e7c8736`, `fe061da` | pass (first attempt blocked; repaired) |
| 4-7 | 39 converge agent: operations dashboard | converge | `6d26b3f` | pass (attempt 1 stable) |
| 4-8 | 40 converge app: live contract tests at 100% | converge | `e5156d4` | pass (attempt 3 stable) |
| 4-9 | 41 docs, project memory, gap status | edit | this wave | see status file |

## Gaps

| Gap | Before | After build 4 | Evidence |
| --- | --- | --- | --- |
| G4 feedback pipeline | Deferred | **Done** | Branch `mg-genie-feedback-20261026` (`38fb38e`) pushed by Genie Code and registered by the app; votes marked processed; idempotency run `885100203138696` created no branch |
| G5 Slack / notifications | Deferred | **Researched** | `docs/research/05_slack_mcp_notifications.md` |
| G6 steward triage | Partial | **Backend done; UI in build 5** | Migration 009 + 9 new routes; all pass the live contract job |
| G9 MCP App | Done (code) | **Done** | 13 contract-validated tools, `ui://ground-truth/review-card` |
| G10 dead scaffolding | Open | **Done** | 3 tasks, 2 notebooks, 3 secret YAMLs removed; `post_deploy_setup` `159451853337655` verified |
| G11 ops observability | Deferred | **Partial** | Ops dashboard `01f1d17bf9531f5ba79f838a0da0df35`; Lakehouse Monitoring still deferred |
| G17 tests | Done | **Done (contract tests)** | `api_contract_tests` run `687515436484443`: 147 pass, 0 fail, 176 `skipped_live`, 100% coverage |

Full table: `docs/plans/gap_analysis_2026-10.md` §6.

## What was built

**App (`ground-truth-app`)**

* Migration 009 (`009_skips_settings_triage`, applied 2026-10-26 03:55 UTC): `app.review_skips` (a skip is not a vote; cooldown 24 h, 0–720; reasons `not_sure`, `not_my_area`, `need_context`, `other`), `app.user_settings`, steward triage columns on `feedback_batches` and `votes`, `user_activity.total_skips`.
* 9 new routes (50 total in `ROUTE_CONTRACTS`): skip, settings (GET/PUT), steward feedback queue, conflicts + resolve, feedback branches (GET/POST) + status. Every route validates with `validate(spec)`.
* MCP: 13 tools via `registerContractTool`; new `review_skip_card`; MCP App review card (`text/html;profile=mcp-app`, ext-apps 1.7.5) with text fallback; `structuredContent` always an object.
* Tests: in-process contract suite (`tests/contract/**`, `manifest.json`), live `api_contract_tests` job `443124502254957` writing `api_contract_results`; vitest projects `node` + `client` (jsdom), 932 tests.
* Deps: `react-router` 7.18.4, Testing Library, `jsdom`, `vitest-axe`; `pnpm audit` high + critical 18 -> 13 (session 26).
* Final deployment `01f1d180ccfa147db429fdda372aea06`, 8/8 probes.

**Infra (`ground-truth-infra`)**

* `feedback_pipeline`: `collect_feedback` -> `check_has_feedback` -> `author_feedback_branch` (Genie Code `genie_task`, skill `ground-truth-feedback-author` 1.0.0) -> `register_feedback_branch`.
* Skip measures: `mv_review_activity` (`skips`, `skip_rate`, `skip_reason`; latest-row dedupe), `mv_user_leaderboard.total_skips`; executive dashboard 9 -> 11 datasets.
* Bronze: `review_skips`, `user_settings` added (23 tables).
* G10 cleanup; `agent_skills` UC volume (owner change).

**Agent (`ground-truth-agent`)**

* Operations dashboard (17 datasets, 5 pages); `agent_verification` dashboard checks; run `312880880434652` 29/29.

**Docs**

* Research 05 (Slack MCP), design L300-17 (MCP App card), UI review + Figma Make brief + build-5 outline (`docs/design/ui/`).
* Runbooks (session 41): `contract_tests.md`, `feedback_pipeline.md`, `deploy_order_and_permissions.md`; `cdf_bronze_operations.md` §1 rewritten for checkpoint resets.

## Problems and root causes

| Problem | Root cause | Fix |
| --- | --- | --- |
| Wave 4-4 blocked on grants | `account users` catalog grant removed; app SPN had no `USE CATALOG` | Owner session: OTel `uc_securable` `TABLE` resources grant the app SPN catalog/schema access (deployer needs `MANAGE`) |
| Unattended `bundle deploy` failed at `apps update` | `Invalid delegation claim present in Ctx` in scheduled Genie Code tasks | Ship code with `bundle run app`; config changes interactively |
| MCP clients rejected array `structuredContent` | MCP requires an object | `{ items: [...] }` for list tools (session 36) |
| Apps build logs tripped the error gate | Passing error-path tests print `"level":"error"` | `vitest.config.ts` `silent: 'passed-only'` (session 36) |
| Bronze missed change rows after migration 009 | ALTER on synced tables triggered a Lakehouse Sync re-snapshot | `reset_checkpoint_selection` on `bronze_from_votes` / `bronze_from_user_activity`; never full refresh (session 37) |
| `mv_review_activity` double-counted votes | Several CDF rows per record | Keep the latest row per `_record_key` (session 37) |
| `jobs/reset` failed for `feedback_pipeline` | `{{tasks.author_feedback_branch.output...}}` reference while the task is a placeholder notebook | `genie_response: ""`; the notebook reads `runs/get-output` (session 37) |
| Feedback votes stayed unprocessed | The job sent the staging `batchId`, which the app treats as a `feedback_batches` id | Job sends `voteIds`; app marks them processed (`e7c8736`, session 38) |
| Live contract job: wrong `/health`, missing 404s | AppKit registers its own `/health` first; real services returned empty results instead of 404 | `removeEarlierHealthRoutes`; `requireAsset()` / `orNotFound()` (session 40) |

## Decisions

* A skip is not a vote: separate table, no effect on confidence or approval rate.
* Feedback branches are `mg-genie-feedback-<yyyymmdd>[-n]`, written in a dedicated Git folder; stewards merge or reject.
* Contract first: routes and tools come from `shared/contracts/schemas.ts`; the manifest is generated; coverage must stay 100%.
* Webhooks stay deferred; Slack goes through `system.ai.slack` when built (G5).

## Open items for build 5

> **Update 2026-10-27:** the build finished `BUILD_PASSED`. The `repo_path` default and `max_retries: 0` items below are closed; the rest moved to [`../requests/2026-10-27_build-4-follow-ups.md`](../requests/2026-10-27_build-4-follow-ups.md) ([close-out session](2026-10-27_build-4-unblock-and-close.md)).

* UI: Settings page, steward Feedback queue / Conflicts / Feedback branches screens, `resurfacedFromSkip` on `ReviewCard`, branch URL on `FeedbackBranch` (sessions 32, 33).
* ~~`feedback_pipeline` `repo_path` default -> dedicated folder (session 38).~~ Done 2026-10-27.
* `post_deploy_setup`: `setup_cdf_config` widget mismatch, optional `app_sp_client_id` cleanup, optional `bundle_target` param; check for duplicate Genie Code scheduled tasks.
* Ops dashboard: `hex()` for BINARY ids (session 39; SQL tested, follow-up 4). ~~`api_contract_tests`: optional `max_retries: 0` (session 40).~~ Done 2026-10-27.
* Manual: MCP App render check in Genie One / Genie Code; reject test branch `mg-genie-feedback-20261026`.
* G11 Lakehouse Monitoring; G5 Slack sharing.

## Files

Per-session file lists are in each session summary (`docs/sessions/INDEX.md`, sessions 25–41) and in `.build-status/110489694161084/` and `.build-status/655172288447819/`.
