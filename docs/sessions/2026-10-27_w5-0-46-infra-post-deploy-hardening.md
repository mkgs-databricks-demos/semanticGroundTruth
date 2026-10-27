# Session 46 (wave 5-0, edit): infra post-deploy hardening

**Run:** `229891579528310` · **Branch:** `mg-genie-build-5` · **Plan:** `docs/plans/build-5/46_infra_post_deploy_hardening.md` · **Scope:** follow-ups 1, 2, 6 (pipeline side), 8 of `docs/requests/2026-10-27_build-4-follow-ups.md`. Static only; session 57 proves the runtime behaviour.

## 1. One Genie Code automation (follow-up 1)

**Root cause (verified read-only on 2026-10-27):** an automation created without a schedule is **not returned** by `GET /api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE` (16 automations listed, all scheduled; neither build-4 id is among them), and the create call does not keep `display_name` (both `e9bdf433…` and `20536fcd…` resolve with GET but have no display name). The old lookup by display name therefore never matched, so every run created a new automation.

**Change:** `ground-truth-infra/src/notebooks/genie_automation_lib.py` (new, pure, no Databricks imports) picks the automation to keep, in order:

1. `genie_task.configuration_id` on `feedback_pipeline.author_feedback_branch` (when the job is still patched);
2. `previous_configuration_id`: the id `deploy.sh` reads from that task just **before** the infra deploy resets it (covers the first run, before any state file exists);
3. the id recorded in `<root_path>/setup_state/genie_automation.json` (dev: `/Workspace/Users/matthew.giglia@databricks.com/.bundle/ground-truth-infra/dev/setup_state/genie_automation.json`), outside the synced `files/`, written by every run;
4. the newest listed automation with the expected display name.

A candidate that no longer exists (GET → `NotFound`, verified) is `stale` and skipped. The kept automation is PATCHed in place (`user_prompt`, `display_name`); one is created only when no candidate exists. `setup_genie_automation` now has widgets `feedback_job_id`, `previous_configuration_id`, `cleanup_duplicates` (default `true`), `duplicate_ids`. With cleanup on, it deletes the other candidates and any `duplicate_ids`, logging each id, and deletes an automation only if its prompt starts with the feedback-author prefix or it has the expected name. Task value key `configuration_id` is unchanged, so `setup_job_params` (unchanged) keeps working.

**Live dry resolution (read-only, no writes):** today the job has `…/20536fcdc3b647448babc91f3e5e44ae`. Plan with the job patched: keep `20536fcd` (source `job`). Plan after a deploy reset it (placeholder, `previous_configuration_id` = `20536fcd`): keep `20536fcd` (source `previous`), no create. `e9bdf433…` is a feedback-author automation (prompt prefix matches), so it is deleted when it is passed in `duplicate_automation_ids`.

## 2. Infra deploy always restores the genie_task (follow-up 2)

`deploy.sh`:

* infra deploys pass `--var run_setup=false` (the `run_post_deploy` job_run, config changes only, becomes a gated no-op);
* `capture_author_configuration_id` reads the automation id on `author_feedback_branch` before each infra deploy (`FEEDBACK_JOB_ID` now comes from `resolve_infra_vars`);
* `run_post_deploy_setup` then **always** runs `bundle run post_deploy_setup --params run_setup=true,previous_configuration_id=<id>` and waits; a failure (or an unresolvable job id) is fatal (`fail`, exit 1) and prints the run URL. It also runs after the second infra deploy that a first-time `./deploy.sh` makes once the app SPN exists;
* `--run-setup` is a no-op alias (prints a note); the old `ensure_post_deploy_run` / `post_deploy_run_is_fresh` are removed; help text and header updated.

`post_deploy_setup.job.yml`: `max_concurrent_runs: 1` + `queue.enabled: true` (a run started while the job_run's no-op run is active waits instead of being skipped; dev-mode presets may still raise concurrency, which is harmless because that run is gated off). Runbook `docs/runbooks/deploy_order_and_permissions.md`: new section "Infra deploys always run `post_deploy_setup`".

## 3. Edit votes with no proposed value (follow-up 6, pipeline side)

`collect_feedback.py`:

* pure helpers `has_proposed_value`, `select_edits_without_value`, `disposition_rows`, `parse_bool`, constant `NO_PROPOSED_VALUE = 'no_proposed_value'`;
* new cell records each unprocessed free-text-only edit vote **once** in the Delta table `<catalog>.<schema>.feedback_vote_dispositions` (`vote_id, asset_id, user_id, feedback, processed_reason, recorded_at`, created on first use) and emits task values `no_value_vote_ids` (JSON list) and `no_value_vote_count`;
* new widget `dry_run` (default `false`): prints what would be staged and recorded, writes nothing, and leaves `vote_count` 0 so the run ends at `check_has_feedback`. Session 57 can run the notebook with `dry_run=true` to confirm vote `3e792f67-71f2-4c3b-81ec-85e3f84452a5` would be recorded with `no_proposed_value`.

**Plan conflict (recorded, not worked around):** the plan asks to mark these votes processed "with whichever the processed marker already supports". The only processed marker is `app.votes.is_processed` in Lakebase, and only the app writes it (the `voteIds` of a `proposed` feedback-branch upsert). Infra does not write Lakebase (project rule: no psycopg in infra notebooks), and no app route marks votes processed without registering a branch. So the pipeline now records the reason and exposes the ids, but steward "unprocessed" counts drop only when the app marks them: see the request below.

## 4. Leftovers (follow-up 8)

* **`setup_cdf_config` widget mismatch:** `post_deploy_setup` passed `lakebase_branch_id`, which matches no widget, so `database` stayed empty. It now passes `database: ${resources.postgres_databases.app_db.id}` and `source_schema: app` (the same as `setup_lakebase_cdf.job.yml`; the deployed default resolves to `projects/dev-matthew-giglia-ground-truth/branches/production/databases/ground-truth-app`). The notebook now fails fast with a clear message when `database` is not a `projects/…/databases/…` path or catalog/schema are empty.
* **`bundle_target` job parameter** (default `${bundle.target}`) passed to `ensure_m2m_service_principal` and `setup_genie_automation`.
* `app_sp_client_id` kept (cleanup deferred, per plan).

## Checks

| Check | Result |
|---|---|
| `python -m pytest ground-truth-infra/tests` (incl. other wave sessions' tests) | pass, 109 passed (22 new in `test_genie_automation_lib.py`, 12 new in `test_collect_feedback.py`; existing `test_feedback_pipeline.py` 58 passed) |
| `bundle validate --strict --target dev` (`ground-truth-infra`, with and without `--var=run_setup=false`) | pass |
| `bash -n deploy.sh` | pass |
| deploy.sh `capture_author_configuration_id` parser on the live job JSON | pass (returns `…/20536fcd…`; empty for a placeholder and for bad JSON) |
| Live read-only resolution of the automation plan | pass (see §1) |
| Runtime: two `post_deploy_setup` runs give the same id; `author_feedback_branch` is a `genie_task` after `./deploy.sh --target dev --infra` | skipped: edit session (no deploy/execute); session 57 |

The Databricks CLI is not usable from this session's shell (`databricks` prints the web-terminal notice), so the deploy.sh flow itself was not executed.

## Files

`deploy.sh`, `docs/runbooks/deploy_order_and_permissions.md`, `ground-truth-infra/resources/jobs/post_deploy_setup.job.yml`, `ground-truth-infra/src/notebooks/{genie_automation_lib.py (new), setup_genie_automation.py, collect_feedback.py, setup_cdf_config.py}`, `ground-truth-infra/tests/{test_genie_automation_lib.py, test_collect_feedback.py}` (new). `setup_job_params.py` unchanged.

## Requests / hand-over

* **Session 57:** on the first `post_deploy_setup` run after `./deploy.sh --target dev --infra`, pass `duplicate_automation_ids=e9bdf433cfbb4aaa9a0cf9bcb9cef6e7` (the build-4 duplicate known today; older ones may exist from build-4 runs and are invisible to the list API, so look for ids in old `post_deploy_setup` run outputs, task value `configuration_id`). Expected kept id: `genie_code/users/1081964970114387/scheduled_insights/20536fcdc3b647448babc91f3e5e44ae`.
* **App (follow-up 6, app side; contracts owned by session 44 in build 5):** a way to mark votes processed without registering a branch, e.g. an admin route `POST /api/steward/votes/processed {voteIds, reason}` that the M2M SPN calls from `register_feedback_branch` or `collect_feedback` with `no_value_vote_ids`; or have `register_feedback_branch` (infra, session 57's ownership) add `no_value_vote_ids` to `voteIds`, which covers only runs that register a branch. Until then `feedback_vote_dispositions` holds the reason and the votes still count as unprocessed in the app.
