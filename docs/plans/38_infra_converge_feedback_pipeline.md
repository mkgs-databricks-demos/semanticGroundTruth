# Session 38: Converge infra: feedback pipeline creates a `mg-genie-feedback-<yyyymmdd>` branch

**Build 4 · wave `4-6` · converge (alone) · target `feedback_pipeline`**

## Steps

1. From `ground-truth-infra`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=run_setup=false`. Then run only the setup tasks session 27 changed so the automation exists and the `author_feedback_branch` task is patched to a `genie_task`: `bundle run post_deploy_setup --target dev` with `run_setup=true` is acceptable if it is idempotent (it was in build 3); confirm with `jobs get` that the task has `genie_task.configuration_id` and the expected `parameters`.
2. Make sure there is feedback to process: if `lb_votes_history` has no unprocessed `edit` vote, submit one edit vote through the app as the M2M SPN on a demo-campaign asset (`POST /api/review/vote`, `voteType: 'edit'`, a one-sentence `editDescription` prefixed `[contract-test]`).
3. `bundle run feedback_pipeline --target dev` (not `dry_run`). Expect: `collect_feedback` sets `vote_count > 0`; the Genie Code task pushes branch `mg-genie-feedback-<yyyymmdd>` (suffix `-2`.. if it exists) with changes only under `ground-truth-infra/fixtures/metric_views/` or the glossary; `register_feedback_branch` posts it to the app; the votes are marked processed.
4. Verify: `git ls-remote origin 'refs/heads/mg-genie-feedback-*'` shows the branch; `GET /api/steward/feedback-branches` (M2M) lists it with `status: 'proposed'` and the file list; a steward notification exists; the Genie summary reports `skill_version: 1.0.0`.
5. Do not merge or delete the feedback branch; list it in the session doc for the owner to review.
6. A second run the same day with no new edits ends at `check_has_feedback` without a new branch (run it once to prove idempotency).

## Stable when

The `feedback_pipeline` run started in this build succeeds end to end and the branch + app record exist; the idempotency run succeeds without a branch.

## Owned Paths

- `ground-truth-infra/**` (excluding `ground-truth-infra/.databricks/**`, `ground-truth-infra/docs/plans/**`)

## Dependencies

- 27, 36, 37
