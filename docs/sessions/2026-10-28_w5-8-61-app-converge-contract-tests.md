# Session 61 (wave 5-8): converge app, live contract tests at 100% (build-5 contracts)

* **Date:** 2026-10-28
* **Build run:** `229891579528310`, task `w5-8_session` · branch `mg-genie-build-5` (HEAD `952669a`, tree clean at start; read-only git)
* **Mode:** converge, runtime target `api_contract_tests` (job `443124502254957`)
* **Plan:** `docs/plans/build-5/61_app_converge_contract_tests.md` (same procedure as build-4 plan 40)
* **Status:** pass. 1 attempt, classified `stable`.

## Result

Job run `281019161761628` (task run `386574173508536`) returned SUCCESS: **153 pass, 0 fail, 201 skipped_live, 100.0% coverage** (53 routes, 13 tools, 1 resource). All rows are in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results` under `run_id = '281019161761628'`. The app `dev-semantic-ground-truth` stayed on deployment `01f1d3029bf11f6ba728ead47406d68a` (session 60, owner attempt 3), `RUNNING` / `ACTIVE`, for the whole session.

## Problem and root cause

The live harness `src/notebooks/api_contract_tests.ipynb` had not been updated since build 4 (session 40). Session 44 changed only the in-process suite (`tests/contract/**`) and the manifest. Against the build-5 manifest, the old harness would have:

* crashed in the coverage cell with `KeyError: 429`, because the 3 Share to Slack routes list 429 and `LIVE_SKIP_REASON` had no entry for it;
* run none of the new build-5 checks that plan 61 step 2 requires.

The server needed no changes: every new check passed on the first run.

## Changes (harness only, `ground-truth-app/src/notebooks/api_contract_tests.ipynb`)

I did not loosen any existing check, remove one, or change it to `skipped_live`.

| Plan 61 step 2 check | Live check | Result |
| --- | --- | --- |
| `/api/config` has `slackShareEnabled` | `route:GET /api/config:happy` also asserts that `slackShareEnabled` is a boolean | pass (`true`) |
| `resurfacedFromSkip` present on review cards | `route:GET /api/review/next:happy` asserts `false` on a card this identity never skipped; `happy_after_skip` asserts a boolean | pass |
| Edit vote with no proposed value gives 400 (REST) | `route:POST /api/review/vote:error_400_edit_without_value` / `error_400_edit_blank_value` (400 `BAD_REQUEST`), plus `invariant:vote …: zod issue at edits` (the issue path is `['edits']`). The later A1 recompute still expects `edits: 0`, so it shows nothing was written | pass |
| Same rule over MCP `submit_vote` | `tool:review_submit_vote:error_edit_without_value` / `error_edit_blank_value` (`Error [BAD_REQUEST]: An edit vote needs …`) | pass |
| `FeedbackBranch.htmlUrl` shape | `route:GET /api/steward/feedback-branches:happy` asserts that every item's `htmlUrl` is null or `https://…/tree/<branchName>` | pass (`https://github.com/mkgs-databricks-demos/semanticGroundTruth/tree/mg-genie-feedback-20261026`) |
| Same-status upsert sends no notification | `invariant:feedback-branch same-status upsert sends no notification`: re-upserts an existing `proposed`/`failed` batch with the same fields, then compares that batch's notifications before and after | **skipped_live**: dev has no `proposed` or `failed` batch (the only one, `21bb95ea…`, is `rejected`). Covered in-process (`invariants.contract.test.ts`, `stewardService.test.ts`) |
| The 3 Slack routes are `skipped_live: obo-only` | For each manifest route with `skippedLive: 'obo-only'`, the harness writes happy + every error status as `skipped_live` with an `obo-only:` reason (24 rows) | as required |

I also added a 429 entry to `LIVE_SKIP_REASON` (upstream Slack rate limit, covered in-process).

## Attempts

| n | Job run | App deployment | Result | Notes |
| --- | --- | --- | --- | --- |
| 1 | `281019161761628` | `01f1d3029bf11f6ba728ead47406d68a` | **stable** | 0 fail, 100% coverage. App logs for the deployment (1646 rows, 19:07:58Z to 20:08:17Z): 0 error lines under the manifest `error_patterns`/`ignore_patterns`; `listening on` is present. Spans since 20:05Z: 428, 0 `STATUS_CODE_ERROR`. Self-soak to 20:12:43Z: same deployment, still `RUNNING`, no new ERROR rows |

`bundle deploy --target dev` updated the other resources and failed only on the known no-op `apps update` (`400 Invalid delegation claim present in Ctx`, follow-up 10). The deployment is source-linked, so the job runs the notebook straight from the working tree. The app code did not change in this session (HEAD = session 60's commit), so I did not run `bundle run app`.

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` (ground-truth-app, final code) | pass |
| Notebook code cells parse (`ast.parse`) | pass |
| `api_contract_tests` run `281019161761628` | SUCCESS: 153 pass / 0 fail / 201 skipped_live, coverage 100.0% |
| `api_contract_results` rows for the run | 354 |
| Cleanup | `route:PATCH /api/campaigns/:campaignId/status:happy_archive`, `error_409` and `GET …:happy_after_cleanup` (status `archived`) pass. The MCP campaign was archived by `tool:campaign_update_status:happy`. I could not list campaigns separately: the session guardrail blocks HTTP calls to the app URL |
| App runtime (logs, marker, spans, soak) | pass (see attempt 1) |

## Decisions

* **Notify-once is `skipped_live`, not `pass`.** A live test needs an existing `proposed`/`failed` batch. Creating one would notify real stewards and leave a row that no API can delete. The check runs automatically whenever such a batch exists (and the SPN holds `steward`). Otherwise it records why it was skipped.
* The Slack `obo-only` skips come from the manifest (`skippedLive`), not from a hard-coded list, so the harness and `coverage.contract.test.ts` stay in step.

## Files modified

* `ground-truth-app/src/notebooks/api_contract_tests.ipynb`

## Requests

* None blocking. Optional (owner): the notify-once live check passes only when dev has a `proposed` or `failed` feedback batch. The next feedback-pipeline run that proposes a branch makes it a real live check.
* Still open from session 60 (follow-up 10): run `bundle deploy --target dev` once from a terminal to refresh the app's stale `source_code_path` in state.
