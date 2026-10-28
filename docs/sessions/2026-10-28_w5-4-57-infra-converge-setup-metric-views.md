# Session 57 (build 5, wave 5-4, converge): infra post-deploy setup, metric views, test-data cleanup

* **Run:** `229891579528310` (job `884230801831394`), branch `mg-genie-build-5`, mode `converge`, runtime target `post_deploy_setup`.
* **Plan:** `docs/plans/build-5/57_infra_converge_setup_and_metric_views.md`. Scope: deploy infra; prove follow-ups 1, 2, 4 (metric views), 6 (dry-run), 7 (reject and delete the test branch).
* **Status:** **blocked**. Steps 2, 3, 4 and 6 are proven and the first half of step 5 is done. Two things are outside this session's control: (1) `bundle deploy` never finishes because creating the new quality monitor returns HTTP 429 (the 1000-monitor limit is reached), and (2) the safety guardrail blocked the remote branch delete.

## How the deploy was run

The Databricks CLI cannot run from this session's shell. `/usr/local/bin/databricks` is the web-terminal trampoline and exits unless `ENABLE_DATABRICKS_CLI=true`. So `./deploy.sh --target dev --infra` could not be run as a script. I did its infra steps one by one, the same way the script does them:

1. `capture_author_configuration_id`: before the deploy, `author_feedback_branch` had `genie_code/users/1081964970114387/scheduled_insights/20536fcdc3b647448babc91f3e5e44ae` (= X).
2. App SPN for the scope ACL: `dev-semantic-ground-truth` → `9f3db838-9415-46fe-9722-9654a6856ecc`.
3. `bundle deploy --target dev --var run_setup=false --var app_service_principal_id=9f3db838-…` (runDatabricksCli tool, from `ground-truth-infra`).
4. `post_deploy_setup` with `run_setup=true,previous_configuration_id=X` (the first run also had `duplicate_automation_ids=e9bdf433cfbb4aaa9a0cf9bcb9cef6e7`). I started it with `jobs run-now` on job `159451853337655` and waited for it, the same as `bundle run`.

## Problem 1: the infra deploy never completes (quality monitor quota)

* **Symptom:** both `bundle deploy` attempts ran past the tool's 300 s limit and were cancelled. `bundle plan` then showed `create quality_monitors.bronze_lakebase_cdf` as the only change left (23 unchanged). Job and file changes were applied each time: the post_deploy_validation params and notebook were live after attempt 2, and `author_feedback_branch` was reset to the placeholder.
* **Root cause:** calling the create API with the same body the bundle sends (`POST /api/2.1/unity-catalog/tables/<bronze_lakebase_cdf>/monitor`) returns **`429 RESOURCE_EXHAUSTED: Cannot create Monitor because it exceeds the number of limit 1000.`** The CLI retries 429 instead of failing, so the deploy hangs. No monitor exists on the table. The limit is shared across the workspace or metastore, outside this bundle.
* **Side finding:** in dev, the resolved monitor has no `schedule`, because development mode drops it. The API also rejects `schedule.pause_status` ("required to be absent"). Session 58 should check how the schedule behaves in non-dev targets.
* **Not done:** I did not remove the monitor from dev and did not add a target override. Either one would turn off G11 to make the deploy pass (guardrail 13). Request below.

## Step 2: automation idempotency (follow-up 1): proven

| post_deploy_setup run | Inputs | Result | configuration_id on `author_feedback_branch` after |
|---|---|---|---|
| `144193078229744` | after deploy 1 (placeholder), previous = X, duplicates = e9bdf433 | SUCCESS (all Group A tasks; setup_cdf_config excluded, app_url empty) | X |
| `464635523512320` | job patched, no previous id | SUCCESS | X |
| `327615726616874` | after deploy 2 (placeholder), previous = X | SUCCESS | X |

* State file `/Workspace/Users/matthew.giglia@databricks.com/.bundle/ground-truth-infra/dev/setup_state/genie_automation.json` records X (display name `Ground Truth Feedback Author (dev)`).
* `e9bdf433cfbb4aaa9a0cf9bcb9cef6e7` now returns `NotFound`, so it was deleted. X still resolves, and its prompt starts with the feedback-author prefix.
* "Exactly one" cannot be shown by listing: `scheduled-insights-list/GENIE_CODE` returns 16 automations, none of them feedback-author ones, because unscheduled automations are not listed (session 46 found the same). The evidence is that X was kept on all 3 runs, none of them created a new automation, and the known duplicate is gone.

## Step 3: metric views (follow-up 4): proven

* `metric_view_deploy` run `244859253802206` succeeded (list_fixtures, deploy_metric_views). `mv_review_activity` was re-created at 2026-10-28 08:01:13 UTC.
* `DESCRIBE`: `asset_id` and `campaign_id` are `string` ("lowercase UUID string").
* Grouping by `campaign_id` with `MEASURE(\`Total Votes\`)` returns `3b22404e-d91a-4e17-8f43-9ad2028d2238` (1) and `d6afc432-a9b7-4e29-be4b-c8420af1327a` (12). `asset_id` gives the same shape. An `RLIKE` check against the UUID pattern finds 0 distinct values that do not match, for both columns. Session 47 changed only `mv_review_activity`.

## Step 4: unprocessed edits (follow-up 6, dry-run): proven

I ran `collect_feedback` from this checkout (`semanticGroundTruth/ground-truth-infra/src/notebooks/collect_feedback`) as a one-time run, `987733913612827`, with `dry_run=true`. Output: 7 edit-vote CDF rows, 0 with a proposed value, 1 without. The run printed "would record vote `3e792f67-71f2-4c3b-81ec-85e3f84452a5` (asset `9c476136-…`) as processed, reason `no_proposed_value`" and `vote_count=0`. Nothing was staged or recorded. I did not run the full `feedback_pipeline`.

## Step 5: test-data cleanup (follow-up 7): half done

* **Rejected:** as the M2M SPN (`/api/me` 200, roles reviewer/admin/steward), `POST /api/steward/feedback-branches/21bb95ea-95e1-44c3-a58f-b33d12165fe5/status {"status":"rejected"}` → 200. The list now shows that batch as `rejected`, `reviewedBy` = the SPN. It was the only feedback branch. The app was `RUNNING` (deployment `01f1d2a5…`) by then; at the start of the session it was UNAVAILABLE.
* **Not deleted:** `git push origin --delete mg-genie-feedback-20261026` from `semanticGroundTruth-feedback` was **blocked by the safety guardrail** (a destructive remote operation). The branch is still on the remote (`38fb38e`). I did not try another route. Asset `efaa7f30…` and vote `644eff17…` were not touched.

## Step 6: post_deploy_validation: fixed, passes

The first run, `1123691422151934`, failed 6 of 11 checks. All 6 were bugs in the notebook, not in the deployment:

1. `SHOW SCHEMAS ... filter(namespace = ...)`: the serverless column is `databaseName`. Now `w.schemas.get("<catalog>.<schema>")`.
2. `w.postgres` is missing from the pre-installed SDK 0.122.0. Enabled the commented-out `%pip install --upgrade databricks-sdk` + `dbutils.library.restartPython()` cell (titled "Install latest Databricks SDK"). The bundle passes `projects/<id>`, and the notebook prefixed `projects/` a second time; it now accepts both forms.
3. Four jobs were looked up by resource key (`feedback_pipeline`, …), but deployed names have the `[dev matthew_giglia] Semantic Ground Truth — …` prefix. The job YAML now passes `${resources.jobs.<key>.id}`, plus `{{job.id}}` for itself, and the notebook does `w.jobs.get(id)`.

The re-run after deploy 2, `395060117290125`, succeeded: **11/11 PASS**.

## Attempts

| # | Deploy | Classification | Errors | Fix |
|---|---|---|---|---|
| 1 | `bundle deploy` (cancelled at 300 s; jobs and files applied) | deploy_failed | monitor create 429 RESOURCE_EXHAUSTED (limit 1000); post_deploy_validation 6 failing checks | notebook + job YAML fixes for validation |
| 2 | `bundle deploy` (cancelled at 300 s; jobs and files applied) | deploy_failed | same monitor 429 only; post_deploy_setup and validation SUCCESS | none possible in owned paths |

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev --var run_setup=false` (ground-truth-infra), on final code | pass |
| `bundle deploy --target dev` completes | **fail** (monitor quota 429; everything else applied) |
| post_deploy_setup ×3 keeps the same configuration_id | pass |
| metric_view_deploy + UUID string ids | pass |
| collect_feedback dry_run marks 3e792f67 `no_proposed_value` | pass |
| test batch rejected via the app | pass |
| remote branch `mg-genie-feedback-20261026` deleted | **fail** (blocked by safety guardrail) |
| post_deploy_validation | pass (run 395060117290125, 11/11) |
| pytest ground-truth-infra/tests | skipped (the changed notebook and YAML have no unit tests) |

## Requests

* **Owner / workspace admin:** the workspace or metastore is at the 1000-monitor limit. Free capacity (or raise the limit), then run `cd ground-truth-infra && databricks bundle deploy --target dev --var run_setup=false --var app_service_principal_id=9f3db838-9415-46fe-9722-9654a6856ecc` (or `./deploy.sh --target dev --infra` from a web terminal). That deploy resets `author_feedback_branch` again, and deploy.sh then re-runs post_deploy_setup. Otherwise decide whether G11 should skip dev; that is a plan change, not a session fix.
* **Owner:** delete the remote branch `mg-genie-feedback-20261026` (`38fb38e`), e.g. `git push origin --delete mg-genie-feedback-20261026` from `semanticGroundTruth-feedback`, or the GitHub UI. Then set `.build-status/229891579528310/57.json` to `pass` (or resume this session) and repair from `w5-4_integrate`.
* **Session 58 (monitor runtime proof):** depends on the monitor existing, so it needs the quota fix above first.

## Files modified

* `ground-truth-infra/src/notebooks/post_deploy_validation.py`
* `ground-truth-infra/resources/jobs/post_deploy_validation.job.yml`

Assets changed: `feedback_pipeline` job (`author_feedback_branch` re-patched to X by setup_job_params), automation `e9bdf433…` deleted, metric views re-created, feedback batch `21bb95ea…` set to `rejected`.
