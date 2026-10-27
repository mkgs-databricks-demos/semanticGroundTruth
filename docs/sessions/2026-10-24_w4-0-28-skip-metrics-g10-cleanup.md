# Session 28 — Skip metrics in the data plane + G10 infra cleanup

**Build 4 · wave 4-0 · edit · infra · run 110489694161084 · branch mg-genie-build-4 · 2026-10-24**

Plan: [`docs/plans/28_infra_skip_metrics_g10_cleanup.md`](../plans/28_infra_skip_metrics_g10_cleanup.md). Edit only; session 37 deploys.

## Findings

* **CDF:** Lakebase CDF is configured per Postgres schema (`CdfConfig(catalog, schema, postgres_schema='app')`). Every current and future table in `app` is captured, so `review_skips` and `user_settings` get `lb_review_skips_history` / `lb_user_settings_history` automatically once migration 009 has run and each table has at least one row (empty tables are not captured). No refresh is needed in `setup_cdf_config.py` or `lakebase_cdf.py`; both left unchanged.
* **Bronze:** the `cdf_bronze` pipeline reads a **fixed** table list from `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml` (`CdfBronzeBuilder.existing_sources()` filters that list by what exists in UC). That fixture is **not** in this session's owned paths, so the two entries are a request (below). Until they are added, the skip measures return 0 / null; the views and dashboard still plan and run.
* **Pre-existing, not changed:** `post_deploy_setup.setup_cdf_config` passes `lakebase_branch_id`, but the notebook reads a `database` widget (default `""`). Outside this session's scope; flagged for session 37 in case it runs that task.

## Changes

### Metric views (additions only)

* `mv_review_activity.yaml`: source is now `votes` rows `UNION ALL` `review_skips` inserts (`_pg_change_type = 'insert'`). Vote rows carry `id` and `skip_id = NULL`; skip rows carry `skip_id`, `id = NULL`, `vote_type = NULL`, and the same `asset_id`, `user_id`, `vote_source` (`source`), `campaign_id` and date columns, so existing dimensions slice skips too.
  * New measures `skips` = `COUNT(DISTINCT skip_id)` and `skip_rate` = `skips / NULLIF(votes + skips, 0)` (percentage format). New dimension `skip_reason` (null for votes).
  * Existing names unchanged. `Total Votes`, `Approval Rate`, `Reject Count`, `Edit Count` already count `id` / `vote_type`, so skip rows do not change their values. `Unique Reviewers` became `COUNT(DISTINCT user_id) FILTER (WHERE id IS NOT NULL)` so a user who only skipped is not counted as a reviewer (same value as before for vote data; expression change, not a rename).
  * Header comment lists both source tables.
* `mv_user_leaderboard.yaml`: new source column `total_skips` (`COALESCE(data:total_skips::INT, 0)`, column added by migration 009) and measure `total_skips` = `SUM(total_skips)`.

### Executive dashboard (`src/dashboards/executive.lvdash.json`)

* Datasets `ds_skipped_cards` (`MEASURE(skips)`, `MEASURE(skip_rate)`) and `ds_skip_rate_trend` (`vote_date`, `MEASURE(skip_rate)`, `MEASURE(skips)`), both on `mv_review_activity`.
* Widgets `w_skipped_cards` (counter "Skipped Cards", x0 y7 w3 h5) and `w_skip_rate_trend` (line "Skip Rate by Day", x3 y7 w9 h5, colour `#5A6F77` = brand `--vote-skip` Gray Text) directly under the review-activity row. The asset-status / error-rate / latency row moved from y7 to y12. No overlaps; grid width 12.
* Note: the file is a workspace `DASHBOARD` object, so the file edit tool could not open it; it was rewritten with the Workspace import API (JSON re-serialised with the same 2-space format; git diff is +122/-3, only the three `y` changes removed).

### G10 cleanup

* Deleted `src/notebooks/setup_gateway_connection.py`, `src/notebooks/setup_app_role_sp.py` (both `raise NotImplementedError`).
* `resources/jobs/post_deploy_setup.job.yml`: removed tasks `setup_gateway_connection`, `setup_app_role_sp` and `check_m2m_secret_present` (verified it fed only `setup_gateway_connection`); updated header comment and job description. The `app_sp_client_id` job parameter is kept because `run_post_deploy.job_run.yml` (not owned) still passes it.
* Deleted `resources/secrets/git_token.secret.yml`, `slack_webhook.secret.yml`, `teams_webhook.secret.yml` (all comment-only).
* `databricks.yml` uses `resources/*.yml` / `resources/*/*.yml` globs, so no include change was needed. `deploy.sh` has no references.
* `README.md`: removed the "UC Secrets" and "Unity Gateway HTTP connection" rows, updated the secrets folder line and dashboard row, added notes on skip metrics and the G10 removal.
* `PROJECT_MEMORY.md` (L58-61 list the three secret YAMLs as planned): **not edited** — the session runner guardrail makes `PROJECT_MEMORY.md` read-only for sessions, even though the plan lists it. Request below.

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` (ground-truth-infra) | pass ("Validation OK!") |
| `grep -rn NotImplementedError ground-truth-infra/src` | pass (no output) |
| Three secret YAMLs gone (`resources/secrets/` = `ground_truth_scope.secret_scope.yml` only) | pass |
| `post_deploy_setup` dangling `depends_on` (YAML parse) | pass (none) |
| Metric view names vs HEAD (YAML parse) | pass: no dimension/measure removed; added `skip_reason`, `skips`, `skip_rate`, `total_skips` |
| `UNION ALL` branches have identical column aliases/order | pass (13 columns) |
| Dashboard: every widget dataset exists; every `MEASURE()` on `mv_review_activity` is a measure in the YAML; no layout overlap | pass |
| `EXPLAIN` of new datasets / metric view DDL | skipped — edit session (`allow_execute` false), views not redeployed; session 37 runs `metric_view_deploy` and the dashboard gate |

## Requests

1. `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml` (session 37): add under `# --- Migration 009: skips, user settings ---` the entries `- name: review_skips` / `keys: [id]` and `- name: user_settings` / `keys: [user_id]`. Required for `skips`, `skip_rate`, `skip_reason` to return data.
2. `ground-truth-infra/PROJECT_MEMORY.md` (session 41 / integrator): drop the planned `slack_webhook`/`teams_webhook`/`git_token` secret YAMLs (L58-61), note G10 removal of `setup_gateway_connection` / `setup_app_role_sp`, and record the new skip measures.
3. Optional (session 37): `resources/jobs/run_post_deploy.job_run.yml` still passes `app_sp_client_id`; once removed there, the `post_deploy_setup` parameter can go too.
4. Root docs outside `ground-truth-infra/` that mention the removed notebooks/secret YAMLs (`ground-truth-infra/docs/plans/*`, `docs/PR_mg-genie-m2m-spn.md` are historical records) — leave as history or annotate in session 41.
