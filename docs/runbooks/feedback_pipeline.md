# Feedback pipeline: review and merge a `mg-genie-feedback-*` branch

How reviewer edit votes become a Git branch, and how a steward reviews, merges or rejects it. Built in build 4 (sessions 27 and 38, gap G4). Design: [`docs/design/L200-C6_feedback_pipeline.md`](../design/L200-C6_feedback_pipeline.md).

## Flow

Job `feedback_pipeline` (`ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`; daily 23:00 UTC, paused in dev):

1. `collect_feedback` stages the unprocessed **edit** votes (latest CDF row per vote from `lb_votes_history`, joined to `lb_assets_history`) per asset under a new `batch_id` in `feedback_staging`.
2. `check_has_feedback` stops the run (success, no branch) when `vote_count = 0`.
3. `author_feedback_branch` is a **Genie Code task** that follows the versioned skill `ground-truth-feedback-author` (`ground-truth-infra/fixtures/skills/ground-truth-feedback-author/SKILL.md`, version `1.0.0`). It edits only `fixtures/metric_views/*.yaml` and `docs/semantics/*.md` (never `name`/`expr`/`source`), commits, pushes `mg-genie-feedback-<yyyymmdd>` (`-2`, `-3` ... when the name exists), switches the clone back to the base branch, and returns `{branch, files, asset_ids, skipped, batch_id, skill_version}`.
4. `register_feedback_branch` reads that summary (`runs/get-output`) and calls `POST /api/steward/feedback-branches` with `branchName`, `files`, `summary` and `voteIds`. The app upserts the `app.feedback_batches` row by `branchName`, then (for a `proposed` branch) marks the still-unprocessed `voteIds` `is_processed = true` in a second statement (not one transaction, so a retry is safe; app commit `e7c8736`), and notifies stewards (`feedback.branch_ready`). `batchId` in that contract is an `app.feedback_batches` id, not the staging batch id, so the job does not send it.

The first branch: `mg-genie-feedback-20261026` (commit `38fb38e`, run `799084267984677`), one comment line in `ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml` from a contract-test edit vote. It is safe to reject.

## Prerequisites

* **Dedicated Git folder.** Genie Code commits and switches branches in `repo_path`. Never point it at a folder someone builds in. Use `/Workspace/Users/<you>/semanticGroundTruth-feedback` (dev: repo id `1397479021974305`, on `main`). Since 2026-10-27 this is the job default (`/Workspace/Users/${workspace.current_user.userName}/semanticGroundTruth-feedback`), so create that Git folder once (clone of the repo, on `main`) before the first run. Override `repo_path` only to point at another dedicated folder.
* **`post_deploy_setup` after every infra deploy.** A bundle deploy resets `author_feedback_branch` to a notebook placeholder that fails on purpose; `post_deploy_setup` (`run_setup=true`, task `setup_job_params`) patches it back to a `genie_task`. Check with `databricks jobs get <feedback_pipeline id>`: the task must have `genie_task.configuration_id`.
* Each `setup_genie_automation` run creates a new Genie Code scheduled task ("Ground Truth Feedback Author (dev)"): the `configuration_id` changed on every run in build 4 (`e9bdf433…`, then `20536fcd…`). Remove the old ones in Genie Code; making setup idempotent is follow-up 1 in [`../plans/requests/2026-10-27_build-4-follow-ups.md`](../plans/requests/2026-10-27_build-4-follow-ups.md).

## Run it by hand

```bash
cd ground-truth-infra
databricks bundle run feedback_pipeline --target dev
# default repo_path = /Workspace/Users/<you>/semanticGroundTruth-feedback; override with --params repo_path=...
```

`dry_run=true` stages and authors but does not register the branch with the app.

## Review a branch (steward)

1. **Find it.** `GET /api/steward/feedback-branches` (steward role) lists branches with `branchName`, `status` (`proposed` after registration), `files`, `summary` and the app batch id. Stewards also get an in-app `feedback.branch_ready` notification. (The steward Feedback branches screen is build 5; until then use the API or the Git provider.)
2. **Read the diff.** In the Git provider, or in any clone: `git fetch origin && git diff main..origin/mg-genie-feedback-<yyyymmdd>`. Check that each change matches the reviewer text exactly, touches only allowed files, and keeps YAML valid.
3. **Mark it in review** (optional): `POST /api/steward/feedback-branches/<appBatchId>/status` with `{"status": "in_review"}`.
4. **Merge:** open a PR from the branch to `main` and merge it the normal way (never push to `main` directly). Then deploy the change: `bundle deploy` + `bundle run metric_view_deploy --target dev` for metric view fixtures. Set `{"status": "merged"}`.
5. **Reject:** set `{"status": "rejected"}` and delete the remote branch in the Git provider if you do not want to keep it.

Status rules (`StewardService.updateFeedbackBranchStatus`): a `proposed` or `in_review` branch can move to `in_review`, `merged` or `rejected`. A `pending`, `failed`, `merged` or `rejected` branch answers 409. An unknown batch id answers 404. The reviewer and time are recorded (`reviewedBy`, `reviewedAt`).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `author_feedback_branch` fails at once with the placeholder message | Deploy reset the task to the placeholder | Run `post_deploy_setup` with `run_setup=true` |
| Genie Code stops with `working_tree_dirty` | `repo_path` has uncommitted changes (often the build folder) | Use the dedicated Git folder |
| Run ends at `check_has_feedback` with no branch | No unprocessed edit votes, or every edit vote proposes no field value | Expected. A second run after a successful one must end here (idempotency) |
| Summary has `branch: null` and every asset under `skipped` (`no_fixture_in_repo`) | The voted assets have no fixture in this repo | Expected for external metric views |
| Same votes staged again on the next run | Votes not marked processed (app older than `e7c8736`, or `voteIds` not sent) | Deploy the current app; re-register the branch with `voteIds` |
| `jobs/reset` 400 "Unsupported task type for the 'output' namespace" | A `{{tasks.author_feedback_branch.output...}}` reference while the task is the placeholder | Keep `genie_response` empty; the notebook reads `runs/get-output` |
