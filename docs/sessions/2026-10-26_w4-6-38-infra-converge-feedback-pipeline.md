# Session 38: Converge infra (feedback pipeline creates a `mg-genie-feedback-<yyyymmdd>` branch)

**Build 4 · wave 4-6 · converge · target `feedback_pipeline` · run 655172288447819 · branch mg-genie-build-4 · 2026-10-26**

Plan: [`docs/plans/38_infra_converge_feedback_pipeline.md`](../plans/38_infra_converge_feedback_pipeline.md). Result: **blocked**. Attempt 1 ran end to end: branch pushed, registered in the app, steward notified. The votes were **not** marked processed, because the app ignores `voteIds`. That is outside the infra paths. For the same reason the idempotency run was not executed.

## Problems and root causes

1. **The register POST would get a 404.** `register_feedback_branch.build_upsert_body` sent `batchId` = the staging batch id from `collect_feedback`. In the app contract, `batchId` is the id of an existing `app.feedback_batches` row, and `upsertFeedbackBranch` throws `notFound` when that row does not exist. Fix (owned): `batchId` is no longer sent, so the app upserts by `branchName`. The staging batch id now goes in `summary`. The unit test was updated to match.
2. **Shared Git folder.** The job default `repo_path` is the build's own Git folder (`/Users/matthew.giglia@databricks.com/semanticGroundTruth`). Because of this session's uncommitted fix, its tree is dirty, so the skill would stop with `working_tree_dirty`. If it ran on a clean tree, it would also switch the build folder's branch while the build is running. I created a dedicated Git folder, `/Users/matthew.giglia@databricks.com/semanticGroundTruth-feedback` (repo id 1397479021974305, on `main`), and ran the job with `repo_path` overridden to it. The YAML default is unchanged (see request 2).
3. **No edit vote targeted a repo fixture.** The registry held only `mv_bookings` / `mv_payments` / `mv_reviews` / `healthcare_finance` assets. None of them have a fixture here, so the run would always end with `branch: null`. As the M2M SPN, I registered measure `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.mv_review_activity/Edit Count` (`POST /api/assets/register`, asset `efaa7f30-c071-4718-bce1-6166aa96e89a`, fixturePath `ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml`). I then cast one edit vote, `644eff17-327b-4a18-9563-68ebc160dd81`, with description `[contract-test] Number of edit proposal votes cast by reviewers.`.
4. **Votes are not marked processed (blocking).** `UpsertFeedbackBranchRequestSchema` has no `voteIds` (zod strips it), and `stewardService.upsertFeedbackBranch` never updates `app.votes.is_processed`. This was session 27's open request, and no build-4 app session implemented it. After the run, both staged votes (`644eff17`, `4f81557c`) are still `is_processed = false` in `lb_votes_history`.

## Attempts

| n | Result | Run / ids | Errors | Fix |
|---|---|---|---|---|
| 1 | stable for the pipeline; votes-processed not met | deploy (1 changed: `feedback_pipeline`), `post_deploy_setup` run 74554223298567 SUCCESS, `feedback_pipeline` run 799084267984677 SUCCESS (5 min) | none in the run. Vote processing is missing in the app | before deploy: `batchId` removed from the register body |

## Verification (run 799084267984677)

* After `post_deploy_setup`, `jobs get`: `author_feedback_branch` is a `genie_task` with `configuration_id` `genie_code/users/1081964970114387/scheduled_insights/e9bdf433cfbb4aaa9a0cf9bcb9cef6e7` and parameters `base_branch, batch_id, branch_prefix, feedback_table, repo_path, run_date, skill_path`. The id differs from before this deploy (`93eeb615...`); see note 3.
* All 4 tasks SUCCESS. `collect_feedback` staged batch `6cb38d65-a77f-45de-a78f-8e67fca8cff4` (2 assets).
* Genie Code summary: branch `mg-genie-feedback-20261026`, files `[ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml]`, `asset_ids [efaa7f30...]`, skipped `599184c5... no_fixture_in_repo` (mv_bookings), `skill_version 1.0.0`. The clone is back on `main` with a clean tree.
* `git ls-remote`: `refs/heads/mg-genie-feedback-20261026` = `38fb38e`. `git diff main..38fb38e`: 1 file, 1 line (`Edit Count` comment = the exact reviewer text, quoted for YAML). The commit message follows the skill format.
* `GET /api/steward/feedback-branches` (M2M): 1 row, `branchName mg-genie-feedback-20261026`, `status proposed`, `files` = the fixture, app batch `21bb95ea-95e1-44c3-a58f-b33d12165fe5`.
* Steward notification: `lb_notifications_history` has `feedback.branch_ready` for recipient `steward`, titled "Feedback branch ready for review: mg-genie-feedback-20261026" (19:26:14Z).
* Votes processed: **no** (both are still `is_processed = false`).
* Idempotency run: **not run**. With the votes still unprocessed, a second run would re-stage the same vote and push `mg-genie-feedback-20261026-2`, a duplicate branch that nobody may delete.
* `bundle validate --strict --target dev --var=run_setup=false`: Validation OK on the final code. `pytest ground-truth-infra/tests/test_feedback_pipeline.py`: 58 passed.

## Feedback branch for the owner to review

* `mg-genie-feedback-20261026` (commit `38fb38e`). It is a contract-test edit, so it is safe to reject in the steward UI. It was not merged or deleted.

## Requests

1. **App owner / next app session (blocking):** add optional `voteIds: uuid[]` to `UpsertFeedbackBranchRequestSchema`. In `stewardService.upsertFeedbackBranch`, set `app.votes.is_processed = true` for those ids in the same transaction as the `feedback_batches` upsert. Then re-run session 38 (or just `feedback_pipeline` twice). Run 1 marks `644eff17` / `4f81557c` processed. Run 2 must end at `check_has_feedback` with no branch.
2. **Owner (infra):** make the dedicated Git folder the job default. Change `repo_path` in `resources/jobs/feedback_pipeline.job.yml` to `/Workspace/Users/${workspace.current_user.userName}/semanticGroundTruth-feedback`, or document that it must not be the build folder. The nightly schedule (paused in dev) would otherwise switch branches in the build folder.
3. **Session 41 (docs):** record the dedicated feedback Git folder and the `batchId` contract meaning in `ground-truth-infra/PROJECT_MEMORY.md`.

## Notes

1. The data change is app data only, created through the app APIs as the M2M SPN: 1 registered asset (efaa7f30) and 1 edit vote (644eff17). Nothing was written to Lakebase directly.
2. `feedback_staging` now holds batch `6cb38d65...` (2 rows).
3. `setup_genie_automation` returned a different `configuration_id` than the one in the job before this deploy. Check the Genie Code scheduled tasks for a duplicate "Ground Truth Feedback Author (dev)" automation.

## Files modified

* `ground-truth-infra/src/notebooks/register_feedback_branch.py`
* `ground-truth-infra/tests/test_feedback_pipeline.py`

Assets: job `feedback_pipeline` (deployed, then re-patched by `post_deploy_setup`), Git folder `semanticGroundTruth-feedback`, app asset `efaa7f30...`, vote `644eff17...`, remote branch `mg-genie-feedback-20261026`, app `feedback_batches` row `21bb95ea...`, `feedback_staging` batch `6cb38d65...`.
