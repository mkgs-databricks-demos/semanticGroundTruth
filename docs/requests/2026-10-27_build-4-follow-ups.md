# Build 4 follow-ups

**Source:** build 4 (runs `110489694161084` + `655172288447819`, `BUILD_PASSED` 2026-10-27), session status files under `.build-status/655172288447819/`, the [build 4 summary](../sessions/2026-10-26_build-4-summary.md) and the [unblock and close session](../sessions/2026-10-27_build-4-unblock-and-close.md).

**Closed on 2026-10-27 (not repeated below):** app `voteIds` (session 38, `e7c8736`); `feedback_pipeline` default `repo_path` -> `semanticGroundTruth-feedback` (session 38); `api_contract_tests` `max_retries: 0` (session 40); re-snapshot recovery runbook + infra PROJECT_MEMORY (session 37); `post_deploy_setup` after infra deploy (session 37); probe helper return values in the build-waves runner skill (session 36, mbp PR #8).

**Closed by build 5 on 2026-10-28** (run `229891579528310`, branch `mg-genie-build-5`; [build 5 summary](../sessions/2026-10-28_build-5-summary.md)): **1** one Genie Code automation (sessions 46 `f2312cd` + 57 `2038e82`: three `post_deploy_setup` runs kept `20536fcd...`, `e9bdf433...` deleted); **2** `deploy.sh --infra` always runs `post_deploy_setup` (46 `f2312cd`, runbook rule; 57 proved the `genie_task` is restored); **4** UUID string ids (47 `f2312cd` in the metric views, so no dashboard edit; 59 `98ba3de`: 17/17 datasets, `agent_verification` 29/29; tie-break moved to build-5 follow-up 7); **5** notify once (44 `a1e25fb`, contract invariant); **6** no-value edit votes (44 `a1e25fb` rejects them, 46 `f2312cd` records old ones `no_proposed_value`; first real run is build-5 follow-up 6); **7** test data (57 `2038e82`: batch `21bb95ea...` rejected through the app; owner deleted `mg-genie-feedback-20261026` on the remote; asset `efaa7f30...` and vote `644eff17...` kept by convention); **8** `setup_cdf_config` widget + `bundle_target` parameter (46 `f2312cd`; `app_sp_client_id` cleanup is build-5 follow-up 14); **9** build 5 preparation (plan `08766ac`, own manifest and instance `-sgt-build-5`); **11** build 5 UI (sessions 49-56: `72040a2`, `0bdf4f0`, `7f0fc22`, `0abf2c0`, `a3bd850`; `htmlUrl` + `resurfacedFromSkip` in 44 `a1e25fb`; Chromium gate 44/44 in 62 `3d74b2a`) except the manual checks (build-5 follow-up 13); **12** partially: G5 Share to Slack (50 `0bdf4f0`, 56 `a3bd850`) and `@mlflow/core` (45 `f2312cd`, AppKit 0.89.0 in 60 `952669a`) done; G11 monitor prod-only (owner D-B5-4 `9ec1219`, build-5 follow-ups 1-2).

**Still open, carried to [`2026-10-28_build-5-follow-ups.md`](2026-10-28_build-5-follow-ups.md):** 3 (build-5 #4), 10 (build-5 #3), the manual part of 11 (build-5 #13), G11 in 12 (build-5 #1, #2). The sections below are kept for history.

Priority: **P1** = fix before the next build, **P2** = next build, **P3** = when convenient.

| # | P | Bundle | Item |
|---|---|--------|------|
| 1 | P1 | infra | `post_deploy_setup` creates a new Genie Code automation on every run |
| 2 | P1 | infra / root | Infra deploy always leaves `author_feedback_branch` as the failing placeholder |
| 3 | P1 | build tooling | Waves: a blocked session's successful `for_each` iteration cannot be repaired |
| 4 | P2 | agent | Ops dashboard: UUID strings instead of BINARY ids (tested SQL below) |
| 5 | P2 | app | Re-registering a proposed feedback branch re-notifies stewards |
| 6 | P2 | app / infra | Edit votes with no proposed value stay unprocessed forever |
| 7 | P2 | root | Clean up build-4 test data and the test feedback branch |
| 8 | P2 | infra | `post_deploy_setup` leftovers from the build 4 summary |
| 9 | P2 | root | Build 5 preparation (manifest, job defaults) |
| 10 | P3 | app | Unattended `bundle deploy` from a Genie Code task: "Invalid delegation claim" |
| 11 | P3 | app | Build 5 UI and manual checks (existing outline) |
| 12 | P3 | infra / agent | G11 Lakehouse Monitoring, G5 Slack sharing, `@mlflow/core` |

## 1. `post_deploy_setup` creates a new Genie Code automation on every run (P1, infra)

* **Evidence:** `setup_genie_automation` returned a different `configuration_id` each run: `…/e9bdf433cfbb4aaa9a0cf9bcb9cef6e7` (run `74554223298567`, session 38), `…/20536fcdc3b647448babc91f3e5e44ae` (run `1115453808467683`, 2026-10-27). Older automations are probably still there.
* **Change:** make `setup_genie_automation` (`ground-truth-infra/src/notebooks/`) find and update the existing automation by name (or delete the old one after `setup_job_params` points the job at the new id). List and delete the duplicates once.
* **Done when:** two consecutive `post_deploy_setup` runs (`run_setup=true`) give the same `configuration_id`, and exactly one feedback-author automation exists.

## 2. Infra deploy leaves `author_feedback_branch` as the failing placeholder (P1, infra / root)

* **Evidence:** every `bundle deploy` of `ground-truth-infra` resets the task to the notebook placeholder (bundle YAML cannot express `genie_task`); `post_deploy_setup` with `run_setup=true` must follow by hand (sessions 37, 38; 2026-10-27).
* **Change:** have `deploy.sh --infra` always run `post_deploy_setup` with `run_setup=true` after the deploy, or add a `job_run` resource that triggers it; document the rule in `docs/runbooks/deploy_order_and_permissions.md`. Revisit when DABs support `genie_task`.
* **Done when:** a single `./deploy.sh --target dev --infra` leaves `author_feedback_branch` a `genie_task`.

## 3. Build waves: a blocked session cannot be re-run by repair (P1, build tooling: `mbp/genie-build-waves`)

* **Evidence:** repair `134534050891462` of `w4-6_sessions` finished in about 1 s and reused iteration `600058177095301`, because a session that writes `status: blocked` ends its task SUCCESS. Jobs does not re-run a successful `for_each` iteration. Recovery was manual: finish the step, edit `38.json`, repair from `w4-6_integrate`.
* **Change (upstream, generic):** either the runner fails its iteration when its final status is `blocked`/`fail` (so repair re-runs it), or the README / integrator skill documents this recovery. Also: session 41 hit the step limit after writing its final status; the gate already treats that as a warning.
* **Done when:** repairing `w<w>_sessions` after a blocked session re-runs that session.

## 4. Ops dashboard: UUID strings instead of BINARY ids (P2, agent; session 39 request)

* **Why:** `campaign_id` / `asset_id` are BINARY in the metric view, so 3 datasets render unreadable bytes (they also break pandas/Arrow conversion).
* **Status:** SQL written and tested on 2026-10-27 against `mv_review_activity` (all dates): row-for-row identical results except the id format. Not applied because `ground-truth-agent/src/dashboards/operations.lvdash.json` is a workspace DASHBOARD object (the file editor cannot write it) and the agent safety layer blocked `workspace/import` with overwrite. Apply it by hand (or approve the import), then `bundle deploy` the agent bundle and run `agent_verification`.
* **Change:** keep the column aliases (widgets bind by field name); `GROUP BY ALL`; tie-break the top 10.
  In `ds_top_skipped_assets`, 13 of 14 assets tie at 0 skips today, so the old top 10 was nondeterministic.

```sql
-- ds_votes_skips_daily
SELECT vote_date, regexp_replace(lower(hex(campaign_id)), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5') AS campaign_id, MEASURE(`Total Votes`) AS vote_count, MEASURE(`skips`) AS skip_count FROM mv_review_activity WHERE (vote_date BETWEEN :date_range.min AND :date_range.max OR :date_range IS NULL) GROUP BY ALL

-- ds_skips_by_campaign
SELECT regexp_replace(lower(hex(campaign_id)), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5') AS campaign_id, MEASURE(`Total Votes`) AS vote_count, MEASURE(`skips`) AS skip_count, MEASURE(`skip_rate`) AS skip_share, MEASURE(`Unique Reviewers`) AS active_reviewers FROM mv_review_activity WHERE campaign_id IS NOT NULL AND (vote_date BETWEEN :date_range.min AND :date_range.max OR :date_range IS NULL) GROUP BY ALL

-- ds_top_skipped_assets
SELECT regexp_replace(lower(hex(asset_id)), '^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5') AS asset_id, MEASURE(`skips`) AS skip_count, MEASURE(`Total Votes`) AS vote_count, MEASURE(`skip_rate`) AS skip_share FROM mv_review_activity WHERE (vote_date BETWEEN :date_range.min AND :date_range.max OR :date_range IS NULL) GROUP BY ALL ORDER BY skip_count DESC, asset_id LIMIT 10
```

* **Done when:** the 3 datasets return `string` ids, `agent_verification` passes, the dashboard shows readable ids.

## 5. Re-registering a proposed feedback branch re-notifies stewards (P2, app)

* **Evidence:** `POST /api/steward/feedback-branches` for the existing `mg-genie-feedback-20261026` (to send `voteIds`) sent a second `feedback.branch_ready` (2026-10-27). `StewardService.upsertFeedbackBranch` notifies on every `proposed`/`failed` upsert.
* **Change:** notify only when the row is created or its status changes. Add a contract test.
* **Done when:** an upsert with the same status sends no notification.

## 6. Edit votes with no proposed value stay unprocessed (P2, app / infra)

* **Evidence:** vote `3e792f67-71f2-4c3b-81ec-85e3f84452a5` (edit, "Suggested edit: clarify the description.", no `edit_*` value) is skipped by `collect_feedback` (`select_unprocessed_edits`) and so is never marked processed; it counts in steward "unprocessed" figures forever.
* **Change (pick one):** the app rejects an edit vote with no proposed field, or the steward queue lets a steward resolve it, or the pipeline marks such votes processed with a reason.
* **Done when:** no edit vote can stay unprocessed without a path to resolution.

## 7. Clean up build-4 test data (P2, root; owner action)

* Reject (and delete on the remote) the test branch `mg-genie-feedback-20261026` (`38fb38e`, `[contract-test]` text) via `POST /api/steward/feedback-branches/21bb95ea-95e1-44c3-a58f-b33d12165fe5/status` `{status: rejected}`.
* Decide whether to keep the fixture-backed test asset `efaa7f30-c071-4718-bce1-6166aa96e89a` (`mv_review_activity/Edit Count`) and vote `644eff17` (`[contract-test]`).

## 8. `post_deploy_setup` leftovers (P2, infra; from the build 4 summary)

* `setup_cdf_config` widget mismatch; optional `app_sp_client_id` cleanup; optional `bundle_target` parameter.

## 9. Build 5 preparation (P2, root)

* Archive build 4 in `docs/plans/waves.json` (`"archived": true` on waves 4-0..4-9, frozen copy under `docs/plans/manifests/build-4_*.json`), set the new feature branch in the manifest and in the Build Waves job defaults (`1079028753739581`), then run the genie-build-waves setup (no build may be running).
* Use the dedicated `semanticGroundTruth-feedback` Git folder for any feedback pipeline run during a build.

## 10. Unattended `bundle deploy` of the app from a Genie Code task (P3, app)

* **Evidence:** in build tasks, `bundle deploy` plans a no-op `apps update` (redacted `config.env` value) that fails with "Invalid delegation claim"; sessions continue with `bundle run app`. Interactive deploys (2026-10-26/27) work.
* **Change:** find the drift source (likely `config.env` / env var diff) so the no-op update is not planned.

## 11. Build 5 UI and manual checks (P3, app; existing plan)

* Build 5 per [`../design/ui/build5_outline.md`](../design/ui/build5_outline.md) after the Figma Make export: Settings page, steward Feedback queue / Conflicts / Feedback branches, `resurfacedFromSkip` on `ReviewCard`, a repo URL on `FeedbackBranch`.
* Manual: MCP App render check in Genie One / Genie Code; Lighthouse / keyboard / theme toggle.

## 12. Other gaps (P3)

* G11 Lakehouse Monitoring on bronze (infra/agent); G5 Slack sharing through `system.ai.slack` (OBO); optional `@mlflow/core` for MLflow agent traces (app).
