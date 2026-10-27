# Build 4 — unblock wave 4-6, finish waves 4-7..4-9, close open requests

**Date:** 2026-10-26 20:00Z – 2026-10-27 04:45Z · **Mode:** interactive (owner + Genie Code) · **Branch:** `mg-genie-build-4` · **Build run:** `655172288447819` (job `1079028753739581`)

## Result

Build 4 is complete. `build_verdict`: **BUILD_PASSED: 6 wave gate(s) passed** (run TERMINATED SUCCESS, 2026-10-27 03:46Z).

| Wave | Session | Gate | Commit | Notes |
|------|---------|------|--------|-------|
| 4-6 | 38 | pass | `fe061da` | after the app fix, vote marking and a manual idempotency run (below) |
| 4-7 | 39 | pass | `6d26b3f` | ops dashboard 17/17 datasets, `agent_verification` 29/29, Genie probes 2/2 |
| 4-8 | 40 | pass | `e5156d4` | app deployment `01f1d180ccfa`, `api_contract_tests` run `687515436484443` |
| 4-9 | 41 | pass | `c62d428` | docs; hit the Genie Code step limit once, resumed by the owner |

## Problems and root causes

1. **Wave 4-6 blocked (session 38).** The feedback pipeline worked end to end (run `799084267984677`, branch `mg-genie-feedback-20261026` = `38fb38e`), but the app ignored `voteIds`, so votes stayed `is_processed = false` and the idempotency run could not be done without pushing a duplicate branch. Fixed before this session in `e7c8736` (`UpsertFeedbackBranchRequest.voteIds`, `StewardService` marks proposed-branch votes processed in a second statement).
2. **Repairing `w4-6_sessions` did not re-run session 38.** Repair `134534050891462` finished the `for_each` parent in about 1 s: Jobs reuses an iteration that already **succeeded** (`600058177095301`). A session that writes `status: blocked` still ends SUCCESS, so `38.json` was unchanged and the gate failed again. Recovery: finish the session's remaining step outside the build, update the status file, repair from `w<w>_integrate`.
3. **Session 41 hit the Genie Code step limit** (conversation `1397479021976267`) with `41.json` `in_progress`; wave 4-9 gate failed. The owner resumed the conversation; it finished and wrote `status: pass`.
4. **Workspace import of `operations.lvdash.json` blocked.** The file is a DASHBOARD object (not writable by the file editor) and the agent safety layer blocks `workspace/import` with overwrite. The tested dashboard change was deferred (see follow-ups).

## What was done

1. **App deploy.** `bundle deploy --target dev` (ground-truth-app) interactively, including the app update (no delegation error): deployment `01f1d178b1311dba856c88c44d6c553d`. Checked the deployed source snapshot contains `voteIds` (`shared/contracts/api.ts`) and the `UPDATE app.votes SET is_processed` (`stewardService.ts`). App probes 8/8 (`probe_client` + `run_app_probes`, M2M SPN).
2. **Votes marked processed through the app.** `POST /api/steward/feedback-branches` `{branchName: mg-genie-feedback-20261026, files, status: proposed, voteIds: [644eff17…, 4f81557c…]}` without `batchId` (upsert by branch name): HTTP 200, same row `21bb95ea`, no new branch. `lb_votes_history` shows both `update_postimage` with `is_processed = true` (20:11:16Z); app log `Feedback votes marked processed` requested 2, marked 2. Side effect: stewards got a second `feedback.branch_ready` notification.
3. **Repair 1** from `w4-6_sessions` (`134534050891462`): gate fail (problem 2).
4. **Idempotency run (session 38's last step).** `feedback_pipeline` run `885100203138696` with `repo_path=/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth-feedback`: `check_has_feedback` outcome false, author + register EXCLUDED, remote `mg-genie-feedback-*` unchanged. The one remaining unprocessed edit vote (`3e792f67`) proposes no field value, so `collect_feedback` correctly ignores it.
5. **`38.json` updated** (status pass, attempt 2, checks "votes marked processed" and "idempotency run" pass). `.build-status/` is gitignored.
6. **Repair 2** from `w4-6_integrate` (`1070497367704414`): waves 4-6, 4-7, 4-8 passed; 4-9 failed (problem 3).
7. **Repair 3** from `w4-9_integrate` (`1062217734579238`) after the owner resumed session 41: wave 4-9 pass, `BUILD_PASSED`.
8. **Open requests closed after the build:**
   * `ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`: default `repo_path` is now `/Workspace/Users/${workspace.current_user.userName}/semanticGroundTruth-feedback` (session 38 request). `bundle validate --strict` OK; infra deploy (`--var=run_setup=false`, 7 jobs updated); `post_deploy_setup` run `1115453808467683` (`run_setup=true`) SUCCESS; `jobs get`: default updated, `author_feedback_branch` is a `genie_task` again (`configuration_id` …`/20536fcdc3b647448babc91f3e5e44ae`, a new id on every setup run).
   * `ground-truth-app/resources/jobs/api_contract_tests.job.yml`: task `max_retries: 0` (session 40 request). `bundle validate --strict` OK; app deploy, deployment `01f1d1bf1da21e6d9178db9ae66ac99e` RUNNING; probes 8/8.
   * Session 37 requests (re-snapshot recovery runbook, infra PROJECT_MEMORY) and session 38 docs requests were completed by session 41. Plan 40 "run `deploy_verification`" is documented in the app README.
   * Deferred: ops dashboard UUID ids (session 39), see [`../requests/2026-10-27_build-4-follow-ups.md`](../requests/2026-10-27_build-4-follow-ups.md).
9. **Docs.** This summary, session INDEX row, follow-up requests, PROJECT_MEMORY (root, infra, app, agent), README and runbook updates for the closed requests.

## Decisions

* Votes were marked processed by re-registering the existing branch through the app API (no raw SQL, no new branch).
* The idempotency check was run by the owner outside the Genie session, because a `for_each` repair cannot re-run a successful iteration.
* The dashboard id change was deferred rather than forced through the blocked import.

## Files modified (this session's commit)

* `ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`
* `ground-truth-app/resources/jobs/api_contract_tests.job.yml`
* `docs/sessions/2026-10-27_build-4-unblock-and-close.md` (new), `docs/sessions/INDEX.md`
* `docs/requests/README.md` (new), `docs/requests/2026-10-27_build-4-follow-ups.md` (new), `docs/plans/INDEX.md` (first committed under `docs/plans/requests/` in `8683803`, moved to `docs/requests/` next to the existing `2026-10-24_mbp_archived_waves.md` request)
* `PROJECT_MEMORY.md`, `README.md`, `ground-truth-infra/PROJECT_MEMORY.md`, `ground-truth-infra/README.md`, `ground-truth-app/PROJECT_MEMORY.md`, `ground-truth-agent/PROJECT_MEMORY.md`
* `docs/runbooks/feedback_pipeline.md`, `docs/runbooks/contract_tests.md`, `docs/sessions/2026-10-26_build-4-summary.md` (open items marked closed)
