# Session 27: Feedback pipeline as a Genie Code task with a versioned skill (G4)

**Build 4 · wave `4-0` · edit · infra**

## Scope

Finish gap G4. The `feedback_pipeline` job (`811289891166091`, never run) must turn reviewer edits into proposed metric-view/glossary YAML on a Git branch named `mg-genie-feedback-<yyyymmdd>`, register the branch with the app so stewards see it, and mark the votes processed. The YAML-writing step is a **Genie Code task** (`genie_task`) whose rules come from a **versioned skill file in this repo**. Edit only; session 38 deploys and runs it.

## Context

* Current job (`ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`): task 1 `collect_feedback` (`src/notebooks/collect_feedback.py`, writes a staging Delta table), task 2 `create_feature_branch` = a placeholder `notebook_task` that `setup_job_params` (run by `post_deploy_setup`) patches to a `genie_task` at deploy time, because bundle validation drops the Beta `genie_task` field. Daily cron `0 0 23 * * ?` UTC (dev mode pauses it).
* `setup_genie_automation.py` creates the automation from `fixtures/prompts/feedback_loop_prompt.md` (its § Skill Prompt section) via `POST /api/2.0/alerts-internal/scheduled-insights` and sets task value `configuration_id`.
* Genie Code job task facts: the automation must have **no schedule and no trigger** (the job drives it); `configuration_id` is the full `genie_code/users/<uid>/scheduled_insights/<id>` name; per-run values go in `genie_task.parameters` and replace `{{name}}` placeholders in `user_prompt` (values can reference `{{job.parameters.*}}` and `{{tasks.<key>.values.*}}`/`.output.response`). Deleting the task does not delete the automation.
* The branch convention is the owner's: `mg-genie-feedback-<yyyymmdd>` (owner decision 2026-10-24). If the branch exists for today, append `-2`, `-3`.
* App API (session 33): `POST /api/steward/feedback-branches` (admin/M2M) upserts `app.feedback_batches` and notifies stewards in-app; `GET /api/steward/feedback-branches` lists them. M2M auth pattern: `ground-truth-infra/src/lib/mcp_client.py` and the app's `deploy_verification.ipynb` (secret scope `semantic_ground_truth_credentials`, keys `m2m_client_id_dev` / `m2m_client_secret_dev`, `WorkspaceClient(...).config.authenticate()` headers).
* Votes with edits: `app.votes` (`vote_type='edit'`, `edit_description`, `edit_plain_english_logic`, `edit_display_name`, `is_processed`) replicated to `lb_votes_history`.

## Tasks

1. **Versioned skill.** Create `ground-truth-infra/fixtures/skills/ground-truth-feedback-author/SKILL.md` (YAML frontmatter `name`, `description`, `version: 1.0.0`) from the rules in `fixtures/prompts/feedback_loop_prompt.md`: which YAML files may change (`ground-truth-infra/fixtures/metric_views/*.yaml`, glossary markdown per root `build_conventions.md` §5), field mapping from edit votes, how to resolve multiple edits (majority, then most recent; never invent text), commit message format, and a final JSON summary block `{branch, files, asset_ids, skipped:[{asset_id, reason}]}`. Make `feedback_loop_prompt.md` a thin pointer to the skill (keep the file; bump its version).
2. **Skill delivery.** The automation prompt tells Genie Code to read the skill at the bundle-deployed path (`${workspace.file_path}/fixtures/skills/ground-truth-feedback-author/SKILL.md`, passed as a `{{skill_path}}` parameter) and to report `skill_version` in its summary. In `setup_genie_automation.py`, also copy the skill into the job owner's `/Workspace/Users/<owner>/.assistant/skills/ground-truth-feedback-author/SKILL.md` only if the folder exists and the copy is older (compare `version`); never overwrite a newer one.
3. **Automation lifecycle** (`setup_genie_automation.py`): idempotent by display name `Ground Truth Feedback Author (<target>)`: create once with no schedule/trigger, update `user_prompt` when the skill version changes, set task value `configuration_id`. Prompt placeholders: `{{run_date}}`, `{{branch_prefix}}`, `{{feedback_table}}`, `{{skill_path}}`, `{{repo_path}}`, `{{base_branch}}`.
4. **Job** (`feedback_pipeline.job.yml`): job parameters `branch_prefix` (default `mg-genie-feedback-`), `base_branch` (default `main`), `dry_run` (default `false`), `repo_path` (workspace Git folder of this repo). Tasks: `collect_feedback` → `check_has_feedback` (condition on task value `vote_count > 0`) → `author_feedback_branch` (placeholder notebook task patched to `genie_task` with `parameters` above) → `register_feedback_branch` (new notebook `src/notebooks/register_feedback_branch.py`: parse the Genie summary from `{{tasks.author_feedback_branch.output.response}}`, verify the branch exists on the remote with `git ls-remote`, call `POST /api/steward/feedback-branches`, mark the batch's votes processed). Keep the job name and resource key.
5. **setup_job_params.py**: patch `author_feedback_branch` (not `create_feature_branch`) to `genie_task {configuration_id, parameters}`; keep early-exit when no automation id. Remove `create_feature_branch.py` only after nothing references it.
6. **collect_feedback.py**: read unprocessed edit votes from `lb_votes_history` (latest row per `id`, `_pg_change_type != 'delete'`), group by asset, write the staging table `feedback_staging` with `batch_id`, set task values `batch_id`, `vote_count`, `asset_count`. Exclude assets that only have skips (skips are not feedback).
7. Unit-test pure helpers (branch-name generation with collision suffix, summary parsing, vote grouping) in `ground-truth-infra/tests/test_feedback_pipeline.py`.

## Acceptance Criteria

- [ ] Skill file exists with `version: 1.0.0`; the automation prompt references it via `{{skill_path}}` and requires `skill_version` in the summary.
- [ ] No code path creates a branch that does not start with `mg-genie-feedback-`.
- [ ] `bundle validate --strict --target dev` passes for `ground-truth-infra`; notebook paths match files on disk.
- [ ] With zero unprocessed edit votes the job ends successfully at `check_has_feedback` without creating a branch.
- [ ] Helper tests pass with `python -m pytest ground-truth-infra/tests/test_feedback_pipeline.py`.

## Owned Paths

- `ground-truth-infra/resources/jobs/feedback_pipeline.job.yml`
- `ground-truth-infra/src/notebooks/collect_feedback.py`
- `ground-truth-infra/src/notebooks/create_feature_branch.py`
- `ground-truth-infra/src/notebooks/register_feedback_branch.py`
- `ground-truth-infra/src/notebooks/setup_genie_automation.py`
- `ground-truth-infra/src/notebooks/setup_job_params.py`
- `ground-truth-infra/fixtures/prompts/**`
- `ground-truth-infra/fixtures/skills/**`
- `ground-truth-infra/tests/test_feedback_pipeline.py`

## Dependencies

- None for editing (wave `4-0`). The app endpoint it calls is built by session 33; session 38 converges both.
