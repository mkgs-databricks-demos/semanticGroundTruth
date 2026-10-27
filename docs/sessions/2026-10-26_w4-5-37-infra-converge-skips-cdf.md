# Session 37: Converge infra (skips through CDF, bronze, metric views; G10 cleanup deployed)

**Build 4 · wave 4-5 · converge · target `infra_metric_view_deploy` · run 655172288447819 · branch mg-genie-build-4 · 2026-10-26**

Plan: [`docs/plans/37_infra_converge_metric_views_skips.md`](../plans/37_infra_converge_metric_views_skips.md). Result: **pass**. Attempt 3 was stable.

## Steps taken

1. `lb_review_skips_history` and `lb_user_settings_history` did not exist, because Lakehouse Sync skips empty tables. I created one skip with the M2M SPN through the app: `POST /api/review/skip` on campaign "Healthcare Finance 2", asset `30f6918a-...`, which returned 201 with skip `aaa9f414-...`. I also sent `PUT /api/me/settings {theme: system}`, which keeps the default value. Both history tables appeared within about 10 s. I did not write to Lakebase directly.
2. I added `review_skips` (keys `[id]`) and `user_settings` (keys `[user_id]`) to `fixtures/pipelines/cdf_bronze_tables.yaml`. This was session 28's request 1. The PKs come from migration 009.
3. `setup_cdf_config.py` was not changed by session 28, so I did not run `setup_lakebase_cdf`. `post_deploy_setup` was not run, as the plan requires.

## Attempts

| n | Result | Errors | Fix |
|---|---|---|---|
| 1 | deploy_failed | `jobs/reset` 400 "Unsupported task type for the 'output' namespace" on `feedback_pipeline`, which blocked `post_deploy_setup` | `register_feedback_branch.genie_response` is now `""`. The `{{tasks.author_feedback_branch.output.response}}` reference is invalid while `author_feedback_branch` is the notebook placeholder at deploy time. The notebook already falls back to `runs/get-output` (`genie_task_output.agent_output.response`). SKILL.md wording updated to match. |
| 2 | unhealthy | (a) `cdf_bronze` update 91e6aac2 FAILED: `bronze_from_votes` and `bronze_from_user_activity` hit `DELTA_SOURCE_TABLE_IGNORE_CHANGES` on a `wal2delta.resnapshot` commit (v4, 2026-10-26 03:55, caused by migration 009 ALTERs). (b) After the reset, `mv_review_activity` `Total Votes` = 26 against 13 real votes. | (a) Pipeline update with `reset_checkpoint_selection` on only those 2 flows (update 2454186f COMPLETED). **No full refresh**: the resnapshot dropped earlier change rows from the history tables, and bronze is the only copy of those LSNs (3 for votes, 3 for user_activity). (b) `mv_review_activity` now keeps the latest row per `_record_key` (no `update_preimage`, no `delete`) in both the votes and review_skips branches. This is the same pattern as the other 4 CDF views. |
| 3 | stable | none | `bundle deploy` (0 changed, fixture upload) and `metric_view_deploy` run 1010688749506000 SUCCESS |

## Verification (attempt 3, warehouse `0ea84986a23a47c3` / serverless)

* `bronze_lakebase_cdf`: every `_pg_lsn` in `lb_votes_history`, `lb_user_activity_history`, `lb_review_skips_history` and `lb_user_settings_history` is present. It has `review_skips` 1 row (`insert`), `user_settings` 1 row, and votes 26 CDF rows / 13 votes.
* Every measure of all 7 metric views executes (0 failures). No measure was removed. Added: `skips`, `skip_rate`, `total_skips`.
* Cross-check against the history tables, computed separately: 13 votes, 9 approve, 2 reject, 2 edit, 2 reviewers, 1 skip. The view returns Total Votes 13, Approval Rate 0.692, Reject Count 2, Edit Count 2, Unique Reviewers 2, skips 1, skip_rate 1/14 = 0.0714. `mv_user_leaderboard.total_skips` = 1.
* Executive dashboard `01f1cf0b38d31b7cbac5bdac6cafe3eb`: all 11 datasets pass `EXPLAIN` with no planning errors and execute successfully, including `ds_skipped_cards` and `ds_skip_rate_trend`. The draft's datasets and widgets (11) match `executive.lvdash.json`. The deploy reported it unchanged; it was published 2026-10-26 05:27Z.
* `post_deploy_setup` (159451853337655) is deployed without `setup_gateway_connection`, `setup_app_role_sp` and `check_m2m_secret_present` (G10).
* `bundle validate --strict --target dev --var=run_setup=false`: Validation OK, both before deploy and on the final code.

## Notes and requests

1. **feedback_pipeline genie_task reverted (needs post_deploy_setup).** Every bundle deploy resets `author_feedback_branch` to the notebook placeholder until `post_deploy_setup` / `setup_job_params` runs. This is expected and was not run here. The owner or integrator should run `post_deploy_setup` (run_setup=true) before the next feedback run, otherwise the placeholder fails on purpose.
2. **Future migrations will break bronze again.** Any migration that ALTERs a synced table triggers a Lakehouse Sync resnapshot, which is a non-append commit. Recovery: `reset_checkpoint_selection` on the affected `<catalog>.<schema>.bronze_from_<table>` flows. Do not full refresh. A runbook entry is worth adding (session 41 / owner). A code-level option (`skipChangeCommits`) would drop the snapshot rows, so I did not apply it.
3. `bronze_lakebase_cdf` has some exact duplicate `(_record_key, _pg_lsn)` rows (user_activity 8/6, and assets/campaigns from before this session). All CDF views take the latest row per key, so the measures are not affected.
4. The `run_post_deploy.job_run.yml` `app_sp_client_id` cleanup (session 28's optional request 3) was not done here. Session 28's request 2 (PROJECT_MEMORY) is still open for session 41.

## Files modified

* `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml`
* `ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`
* `ground-truth-infra/fixtures/skills/ground-truth-feedback-author/SKILL.md`
* `ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml`

Assets: `lb_review_skips_history`, `lb_user_settings_history` (created by Lakehouse Sync after the app writes); `bronze_lakebase_cdf` (2 flow checkpoints reset, new rows); the 7 metric views were redeployed; jobs `feedback_pipeline` and `post_deploy_setup` were updated by the deploy.
