# Session 46: Infra post-deploy hardening (P1 #1, P1 #2, P2 #6 pipeline side, P2 #8)

**Build 5 · wave `5-0` · edit (parallel)** · source: `docs/requests/2026-10-27_build-4-follow-ups.md` §1, §2, §6, §8.

## Steps

1. **One automation** (§1): `ground-truth-infra/src/notebooks/setup_genie_automation.py` resolves the existing feedback-author automation in this order: the `configuration_id` currently on the `author_feedback_branch` task of `feedback_pipeline` (if it still exists), else the newest automation with the expected name; it **updates** that automation in place (prompt, skill, repo path, schedule none) and only creates one when none exists. Add an optional `cleanup_duplicates` widget (default `true` in dev): delete other automations with the same name, logging each id. Output the final `configuration_id` as a task value (unchanged key) so `setup_job_params` keeps working.
2. **Pure helper + tests:** move the selection logic into `ground-truth-infra/src/notebooks/genie_automation_lib.py` (no Databricks imports at module level) with pytest tests in `ground-truth-infra/tests/test_genie_automation_lib.py`: existing id on job wins; falls back to newest by name; creates when none; duplicates listed for deletion.
3. **Deploy always restores the Genie task** (§2): `deploy.sh --infra` runs `post_deploy_setup` with `run_setup=true` after every infra deploy (not only when `--run-setup` is given) and waits for it; failure is fatal with the run URL. Keep `--run-setup` as a no-op alias. Update `docs/runbooks/deploy_order_and_permissions.md`.
4. **Unprocessed edit votes** (§6, pipeline side): `collect_feedback.py` marks edit votes with no proposed `edit_*` value as processed with `processed_reason = 'no_proposed_value'` (column or metadata key, whichever the processed marker already supports; no schema migration in Lakebase from infra), so steward counts stop including them. Unit test for the selector if it lives in a pure function; otherwise a dry-run mode printed by the converge session.
5. **Leftovers** (§8): fix the `setup_cdf_config` widget name mismatch (widget names must match the job task `base_parameters`); add an optional `bundle_target` parameter to `post_deploy_setup` passed through to notebooks that need it. Do not remove `app_sp_client_id` (optional cleanup deferred).
6. `bundle validate --strict --target dev` for `ground-truth-infra`; `bash -n deploy.sh`; pytest for the new tests.

## Acceptance

Validate passes; pytest passes; the converge session 57 proves the runtime behaviour (two runs, same `configuration_id`; `author_feedback_branch` is a `genie_task` after `./deploy.sh --target dev --infra`).

## Owned paths

* `ground-truth-infra/src/notebooks/setup_genie_automation.py`, `genie_automation_lib.py`, `setup_cdf_config.py`, `setup_job_params.py`, `collect_feedback.py`
* `ground-truth-infra/resources/jobs/post_deploy_setup.job.yml`
* `ground-truth-infra/tests/test_genie_automation_lib.py`, `ground-truth-infra/tests/test_collect_feedback.py` (session 47 owns `tests/test_metric_view_ids.py` in the same wave; neither session edits a shared `conftest.py`)
* `deploy.sh`
* `docs/runbooks/deploy_order_and_permissions.md`

## Dependencies

None.
