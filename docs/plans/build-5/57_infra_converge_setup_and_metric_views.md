# Session 57: Converge infra: post-deploy setup, metric views, test-data cleanup

**Build 5 · wave `5-4` · converge (alone) · target `post_deploy_setup`; the wave gate also checks `infra_metric_view_deploy`, `mv_review_activity`**

## Steps

1. From the repo root: `./deploy.sh --target dev --infra` (session 46: it runs `post_deploy_setup` with `run_setup=true` and waits). Fix failures inside `ground-truth-infra/**`, `deploy.sh` or the runbook.
2. **Automation idempotency (P1 #1):** read the `author_feedback_branch` task of `feedback_pipeline`: it is a `genie_task` and its `configuration_id` = X. Run `post_deploy_setup` (`run_setup=true`) a second time: `configuration_id` is still X; exactly one feedback-author automation exists (list them; duplicates were deleted by `cleanup_duplicates`). Record ids in the status file.
3. **Metric views:** `bundle run metric_view_deploy --target dev --var=run_setup=false`; `DESCRIBE` `mv_review_activity`: `campaign_id`, `asset_id` are `string`; `SELECT campaign_id, MEASURE(\`Total Votes\`) FROM mv_review_activity GROUP BY ALL LIMIT 5` returns UUID strings matching `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Same for every other metric view session 47 changed.
4. **Unprocessed edits (P2 #6):** run `collect_feedback` from this checkout (the build branch; the `semanticGroundTruth-feedback` folder is still on `main`) in dry-run (or the selector) and confirm vote `3e792f67-71f2-4c3b-81ec-85e3f84452a5` is marked processed with reason `no_proposed_value` (or would be, in dry-run; do not run the full `feedback_pipeline`, which would author a branch).
5. **Test-data cleanup (P2 #7, owner-approved):** as the M2M SPN (root conventions §9), `POST /api/steward/feedback-branches/21bb95ea-95e1-44c3-a58f-b33d12165fe5/status` `{"status":"rejected"}`; delete the remote branch `mg-genie-feedback-20261026` (Git CLI from the `semanticGroundTruth-feedback` folder, or the Repos API). Keep asset `efaa7f30-c071-4718-bce1-6166aa96e89a` and vote `644eff17…`. Do not touch any other branch.
6. `post_deploy_validation` passes.

## Stable when

The last `post_deploy_setup` run succeeded and kept the same `configuration_id` as the previous run; `metric_view_deploy` succeeded; `mv_review_activity` ids are strings; the test branch is rejected and gone from the remote.

## Owned paths

* `ground-truth-infra/**` (excluding `ground-truth-infra/.databricks/**`)
* `deploy.sh`, `docs/runbooks/deploy_order_and_permissions.md`, `docs/runbooks/cdf_bronze_operations.md`

## Dependencies

46, 47, 48
