# Session 27 (wave 4-0): Feedback pipeline as a Genie Code task with a versioned skill (G4)

* **Build / run:** build 4, wave `4-0`, run `110489694161084`, branch `mg-genie-build-4`, mode `edit` (infra). Nothing deployed or run as a job; session 38 converges.
* **Plan:** `docs/plans/27_infra_feedback_pipeline_genie_task.md`

## Problem

The `feedback_pipeline` job (`811289891166091`, never run) read columns that do not exist (`vote_id`, `reviewer_id`, `comment`, `proposed_yaml`, `_change_type`), its task 2 was a Genie Spaces call that created `feedback/<date>` branches, and the automation prompt embedded inline rules. Gap G4.

## Changes

| File (under `ground-truth-infra/`) | Change |
|---|---|
| `fixtures/skills/ground-truth-feedback-author/SKILL.md` | **New** versioned skill `1.0.0`: inputs, hard rules (branch `mg-genie-feedback-<yyyymmdd>[-n]`, allowed files `fixtures/metric_views/*.yaml` + `docs/semantics/*.md`, never invent text, never touch `name`/`expr`/`source`, clean tree, push then switch back), file lookup, field mapping, majority-then-recent resolution, commit format, final JSON summary `{branch, files, asset_ids, skipped, batch_id, skill_version}` |
| `fixtures/prompts/feedback_loop_prompt.md` | 2.0.0: thin pointer; new § Automation Prompt (`text` block) with `{{run_date}} {{batch_id}} {{branch_prefix}} {{feedback_table}} {{repo_path}} {{base_branch}} {{skill_path}}` and `__SKILL_VERSION__`; 1.1.0 rules kept below it as history only (not sent) |
| `src/notebooks/collect_feedback.py` | Rewritten: unprocessed **edit** votes from `lb_votes_history` (latest row per `id` by `_sort_by`, pre-images ignored, deletes dropped), binary UUIDs formatted, joined to latest `lb_assets_history`, grouped per asset with `edits_json` + `resolved_json`, appended to `feedback_staging` under a new `batch_id`. Task values `batch_id`, `vote_count`, `asset_count`, `feedback_table`, `run_date`. Rejects any `branch_prefix` other than `mg-genie-feedback-`. |
| `src/notebooks/register_feedback_branch.py` | **New**: parse the Genie summary from `{{tasks.author_feedback_branch.output.response}}` (fallback: `/api/2.2/jobs/runs/get-output`), validate the branch name, `git ls-remote` it on the repo's remote, read the batch's `vote_ids`, `POST /api/steward/feedback-branches` as the M2M SPN (status `proposed`, `allow_redirects=False`); `dry_run=true` stops before the POST; `branch: null` registers nothing |
| `src/notebooks/setup_genie_automation.py` | Idempotent by `Ground Truth Feedback Author (<target>)` (target parsed from `.bundle/<name>/<target>/files` or `bundle_target` param); create with no schedule/trigger; PATCH `user_prompt` only when it changed; copies the skill to `/Workspace/Users/<owner>/.assistant/skills/ground-truth-feedback-author/SKILL.md` only if `.assistant/skills` exists and the copy is absent or strictly older; validates no schedule/trigger; task values `configuration_id`, `skill_version` |
| `src/notebooks/setup_job_params.py` | Patches `author_feedback_branch` (not `create_feature_branch`) to `genie_task {configuration_id, parameters}` with parameters copied from the placeholder's `base_parameters` (or kept from an existing genie_task); drops notebook-only fields; early exit (no change) without a configuration id; asserts parameters after reset |
| `src/notebooks/create_feature_branch.py` | Now only the `author_feedback_branch` placeholder: raises `RuntimeError` if it ever runs unpatched; the old Genie Spaces / `feedback/<date>` code is gone. Kept (still referenced as the placeholder notebook). |
| `resources/jobs/feedback_pipeline.job.yml` | Same resource key and name. Job params `branch_prefix` (`mg-genie-feedback-`), `base_branch` (`main`), `dry_run` (`false`), `repo_path` (`/Workspace/Users/${workspace.current_user.userName}/semanticGroundTruth`); `max_concurrent_runs: 1`; tasks `collect_feedback` → `check_has_feedback` (condition `vote_count > 0`) → `author_feedback_branch` (placeholder, `outcome: true`) → `register_feedback_branch` |
| `tests/test_feedback_pipeline.py` | **New**, 58 tests: branch name + collision suffix, prefix/date validation, ls-remote parsing, summary parsing (fenced/bare/last block/null/invalid), upsert body, latest-row/delete handling, edit selection (skips, approves, processed, feedback-only excluded), field resolution, grouping, skill version + copy rule, prompt rendering against the real fixture, placeholder → genie_task patch, legacy-prefix guard. Helpers are exec'd from each notebook's `# --- pure helpers` cell (stdlib only). |

## Decisions

* **Pure helpers live in the notebooks** (one marked cell each), because no shared `src/lib` file is in this session's owned paths. Tests exec that cell only.
* **`batch_id` added as a prompt placeholder/parameter** (beyond the six in the plan) so Genie Code reads exactly the staged batch.
* **Edit votes with no edited field** (free-text `feedback` only) are not staged (nothing to author); they stay unprocessed for the steward feedback queue. Skips are never staged.
* **Conflict** = two or more distinct proposed values for a field (same rule as the app's steward conflict view); the winner is still applied and the commit body names the conflict.
* `edit_plain_english_logic` on measures/dimensions maps to `expr`, so the skill skips it (`logic_change_requires_steward`); for pages it maps to `Business Context`.
* **Marking votes processed:** the plan 25 contract `UpsertFeedbackBranchRequest {batchId?, branchName, files, summary?, status}` has no vote list and infra has no Lakebase write path into the app-owned `app.votes`. The POST body adds `voteIds` (zod strips unknown keys by default, so it is harmless until supported). See request below.
* App URL from `w.apps.get(<app_name>)`; app name defaults to `dev-semantic-ground-truth` for `dev`, else `semantic-ground-truth`.
* `git ls-remote` works anonymously from serverless (repo is public; verified against `main`).

## Checks

* `bundle validate --strict --target dev` (ground-truth-infra): pass (twice, after the last YAML edit). Resolved config checked: 4 tasks, condition gate, `max_concurrent_runs: 1`, placeholder parameters, register notebook path resolved to a notebook.
* `PYTHONDONTWRITEBYTECODE=1 python -B -m pytest -p no:cacheprovider ground-truth-infra/tests/test_feedback_pipeline.py`: 58 passed.
* Read-only dry run of `collect_feedback`'s helper + read cells against `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`: 2 edit-vote CDF rows → 1 actionable vote on 1 asset (`mv_bookings/total_bookings`, metadata resolved, description resolved). An independent window-function SQL count also gives 1. No table written.
* All five notebooks parse (`ast.parse`); the rendered automation prompt from the real fixture + skill contains every placeholder and `expected skill version: 1.0.0`.
* Greps: no `NotImplementedError` in `ground-truth-infra/src`; no branch-creating code outside `mg-genie-feedback-`; the only remaining `feedback/` strings are in `ground-truth-infra/docs/plans/feedback_pipeline_rework_plan.md` (historical design doc, not owned).
* Not run (edit session): the job, `post_deploy_setup`, and the app POST. Session 38 deploys and runs them.

## Requests

* **Session 25 / 33 (app contracts + steward API):** accept optional `voteIds: string[]` in `UpsertFeedbackBranchRequest` and, in `POST /api/steward/feedback-branches`, set `app.votes.is_processed = true` for those ids in the same transaction as the `feedback_batches` upsert. Without it, staged votes are re-collected on the next run.
* **Session 28 (owns `post_deploy_setup.job.yml`):** optionally pass `bundle_target: "${bundle.target}"` to `setup_genie_automation` (it falls back to parsing the target from the bundle path, which works for the standard root_path).
* **Session 38 (converge):** run `post_deploy_setup` after deploy so `author_feedback_branch` is patched; then a `feedback_pipeline` run. With today's data the one actionable asset (`mv_bookings` in `dev_matthew_giglia_wb_metric_views_care`) has no fixture in this repo, so expect `branch: null` + `no_fixture_in_repo` unless a vote targets a repo fixture. Also test the zero-vote path (`check_has_feedback` false → run SUCCESS). The old automation "Ground Truth Feedback Loop" is no longer used; delete it if wanted (setup prints a note).
* **Session 41 (docs):** mark `ground-truth-infra/docs/plans/feedback_pipeline_rework_plan.md` as superseded by plan 27 (it still describes `feedback/YYYY-MM-DD-*` branches) and update `ground-truth-infra/PROJECT_MEMORY.md` / README job descriptions (owned by session 28 this wave).

## Risks

* The Genie Code task switches the branch of the shared Git folder (`repo_path`) while it works; the skill requires a clean tree and switching back. Do not run the job while a build session is editing that folder.
* `{{tasks.author_feedback_branch.output.response}}` may be cut for very long responses; the skill asks for a short response ending with the JSON block.
