---
name: ground-truth-feedback-author
description: Turns one batch of Semantic Ground Truth reviewer edit votes (feedback_staging rows for a batch_id) into proposed metric-view YAML and glossary markdown changes on a Git branch named mg-genie-feedback-<yyyymmdd>, then reports a JSON summary. Used by the feedback_pipeline job's author_feedback_branch Genie Code task.
version: 1.0.0
---

# Ground Truth Feedback Author

You run unattended inside the `feedback_pipeline` job (task `author_feedback_branch`). The job has already collected one batch of unprocessed **edit** votes into a staging table. Your job: apply the edits that are safe to apply to this repo's fixture files, commit them to a new feature branch, push it, and report what you did. A steward reviews the branch in the app; you never merge.

## Inputs (from the automation prompt)

| Name | Meaning |
|---|---|
| `run_date` | Batch date, `yyyymmdd` |
| `batch_id` | The batch to process; read only staging rows with this `batch_id` |
| `branch_prefix` | Must be exactly `mg-genie-feedback-` |
| `feedback_table` | Fully qualified staging table (`<catalog>.<schema>.feedback_staging`) |
| `repo_path` | Workspace Git folder of the `semanticGroundTruth` repo |
| `base_branch` | Branch to start from (normally `main`) |
| `skill_path` | Path of this file; report its `version` as `skill_version` |

If any input is empty or still looks like a `{{placeholder}}`, do nothing and report `branch: null` with the reason in `skipped`.

## Hard rules

1. **Branch name.** Only ever create a branch named `<branch_prefix><run_date>` (for example `mg-genie-feedback-20261024`). If that branch already exists on the remote, use `-2`, then `-3`, and so on (`mg-genie-feedback-20261024-2`). Never use any other name or prefix, and never put asset names in the branch name. If `branch_prefix` is not `mg-genie-feedback-`, stop and report `branch: null`.
2. **Files you may change** (paths relative to `repo_path`):
   * `ground-truth-infra/fixtures/metric_views/*.yaml` (metric view fixtures)
   * glossary markdown in the Page format of the root `docs/plans/build_conventions.md` §5, i.e. `docs/semantics/*.md`
   Nothing else: no code, no bundle YAML, no plans, no `PROJECT_MEMORY.md`.
3. **Never invent text.** Every changed value must be the exact text of a reviewer's edit (after the resolution rule below). Do not rephrase, merge or "improve" reviewer text. Trim leading and trailing whitespace only.
4. **Never change identity or logic.** Never change a `name`, a glossary `### <Term>` heading, an `expr`, the `source` query, `format`, `synonyms` or the `CREATE OR REPLACE VIEW` header.
5. **Git.** Work only in `repo_path`. Before starting, note the current branch and confirm the working tree is clean; if it is not clean, stop and report `branch: null` (reason `working_tree_dirty`). Create your branch from the latest `base_branch`, commit, push, then switch the Git folder back to the branch it was on. Never commit to or push `main` / `base_branch`, never force-push, never merge, never delete branches.
6. **No changes, no branch.** If no edit can be applied, do not create a branch; report `branch: null` and list every asset in `skipped`.
7. Never print secret values. Do not write to any table.

## Steps

1. Read this file and remember its `version` (`skill_version`).
2. Read the batch: `SELECT * FROM <feedback_table> WHERE batch_id = '<batch_id>'`. One row per asset with columns `asset_id`, `asset_type`, `asset_name`, `display_name`, `fixture_path`, `current_description`, `current_plain_english_logic`, `current_display_name`, `vote_ids` (array), `vote_count`, `edits_json` (all edit votes, oldest first: `vote_id`, `user_id`, `created_at`, `feedback`, `description`, `plain_english_logic`, `display_name`) and `resolved_json` (per-field resolution precomputed by the job with the rule below: `{field: {value, support, total, conflict}}`).
3. For each asset, locate the file:
   * `fixture_path` set and inside the allowed files: use it.
   * `asset_type` in (`metric_view`, `measure`, `dimension`): the metric view name is the last dot-separated part of `asset_name` before any `/` (for `cat.sch.mv_x/paid_amount` it is `mv_x`). Use `ground-truth-infra/fixtures/metric_views/<mv name>.yaml` if it exists and its `name:` matches.
   * `asset_type = 'page'`: the glossary file named in `fixture_path`, and the `### <asset_name>` term block in it.
   * Otherwise skip the asset with reason `no_fixture_in_repo`.
4. Apply the resolved values using the field mapping. Skip a field (not the whole asset) when its resolved value equals the current value in the file.
5. Validate every changed YAML file still parses and every changed glossary block still has its `- **Definition:**` bullet.
6. If at least one file changed: create the branch (rule 1), commit (format below), push, switch back.
7. Finish with the JSON summary block.

## Field mapping

| Edit vote field | `measure` / `dimension` (entry with that `name` under `measures:` / `dimensions:` in the `$$ ... $$` YAML body) | `metric_view` (top level of the YAML body) | `page` (glossary term block) |
|---|---|---|---|
| `edit_description` | `comment` | `comment` | `- **Definition:**` bullet |
| `edit_display_name` | `display_name` | skip (`field_not_supported`) | skip (`field_not_supported`; the heading is the term's identity) |
| `edit_plain_english_logic` | skip (`logic_change_requires_steward`; it maps to `expr`) | skip (`field_not_supported`) | `- **Business Context:**` bullet |

The free-text `feedback` comment is context only; never copy it into a file.

## Resolving several edits for the same field

1. Ignore empty values. Compare values after trimming whitespace.
2. **Majority:** the value proposed by the most votes wins.
3. **Tie:** the most recent of the tied values (`created_at`) wins.
4. A field with two or more distinct proposed values is a `conflict` (the same rule the app's steward conflict view uses): still apply the winner, and mention the conflict in the commit body so the steward can see it.

Use `resolved_json` when present; it already applies this rule. If you disagree with it, follow `resolved_json` and say so in the commit body.

## Commit message

```
feedback(<run_date>): <n> asset(s) from batch <first 8 chars of batch_id>

- <asset_name>: <field> (<support>/<total> votes)[, conflict]
...
Votes: <comma-separated vote ids>
skill: ground-truth-feedback-author <skill_version>
```

One commit per batch.

## Final JSON summary (required)

Keep your final response short (at most 5 lines of prose), then end it with exactly one fenced `json` block and nothing after it. The `register_feedback_branch` task reads your final response through `{{tasks.author_feedback_branch.output.response}}` and parses the last `json` block; very long responses can be cut off.

```json
{
  "branch": "mg-genie-feedback-20261024",
  "files": ["ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml"],
  "asset_ids": ["9c476136-250e-498e-9d2b-e66f42a491c4"],
  "skipped": [{"asset_id": "5991...", "reason": "no_fixture_in_repo"}],
  "batch_id": "<batch_id>",
  "skill_version": "1.0.0"
}
```

* `branch`: the pushed branch, or `null` when nothing was committed.
* `files`: repo-relative paths changed in the commit.
* `asset_ids`: assets with at least one applied field.
* `skipped`: assets (or `asset_id:field`) not applied, with a reason from: `no_fixture_in_repo`, `outside_allowed_files`, `field_not_supported`, `logic_change_requires_steward`, `unchanged`, `invalid_after_edit`, `working_tree_dirty`, `bad_input`.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-24 | First versioned skill (build 4, session 27). Replaces the inline rules of `fixtures/prompts/feedback_loop_prompt.md` 1.1.0: edit votes only, field mapping, majority-then-recent resolution, `mg-genie-feedback-<yyyymmdd>` branches, JSON summary. |
