# Session 28: Skip metrics in the data plane + G10 infra cleanup

**Build 4 · wave `4-0` · edit · infra**

## Scope

Carry the new app tables (`app.review_skips`, `app.user_settings`, plan 25) through CDF → bronze → metric views and the executive dashboard, and delete the G10 scaffolding the owner approved removing. Edit only; session 37 deploys.

## Context

* Lakebase CDF replicates the whole `app` Postgres schema (`src/lib/lakebase_cdf.py`, `CdfConfig(catalog, schema, postgres_schema)`) to `lb_<table>_history`. Expected new history tables: `lb_review_skips_history`, `lb_user_settings_history`. Confirm by reading `lakebase_cdf.py` / `setup_cdf_config.py` whether new tables are picked up automatically or need a config refresh; implement the refresh in `setup_cdf_config.py` if needed (idempotent).
* Bronze: SDP pipeline `src/pipelines/cdf_bronze.py` writes `bronze_lakebase_cdf` (`_source_table`, `_record_key`, `_pg_change_type`, `data` VARIANT, ...). Check whether its source-table list is discovered or fixed; add the two tables if fixed.
* Metric views: `fixtures/metric_views/*.yaml`, deployed by the `metric_view_deploy` job. Pinned names other sessions depend on: in `mv_review_activity` add measures **`skips`** (count of `review_skips` inserts) and **`skip_rate`** (`skips / (votes + skips)`, null-safe); in `mv_user_leaderboard` add **`total_skips`**. Keep every existing measure and dimension name unchanged (agent Genie space and executive dashboard use them).
* Executive dashboard: `src/dashboards/executive.lvdash.json` (published `01f1cf0b38d31b7cbac5bdac6cafe3eb`). Its runtime gate executes every dataset.
* G10 (owner-approved deletions, 2026-10-24): `src/notebooks/setup_gateway_connection.py` and `src/notebooks/setup_app_role_sp.py` raise `NotImplementedError`; their tasks in `resources/jobs/post_deploy_setup.job.yml` (`setup_gateway_connection`, `setup_app_role_sp`) and any condition task used only by them (`check_m2m_secret_present` feeds only `setup_gateway_connection`; verify) go too. Empty secret YAMLs: `resources/secrets/git_token.secret.yml`, `slack_webhook.secret.yml`, `teams_webhook.secret.yml` (G5 webhooks are deferred; session 30 researches Slack MCP instead).
* Old OTel tables `ground_truth_app_otel_{logs,spans,metrics,annotations}` are empty since 2026-10-19 and unused (app exports to `semantic_ground_truth_otel_*`). The owner approved dropping them; the interactive planner could not (blocked by the approval layer), so it is a manual step listed in `INDEX.md`. Do not drop them from a session.

## Tasks

1. CDF/bronze: make sure `review_skips` and `user_settings` reach `bronze_lakebase_cdf` after migration 009 (session 36 runs it). Do not hard-code row counts.
2. Metric views: add the pinned measures; add dimension `skip_reason` to `mv_review_activity` (null for votes). Update the YAML header comment with the source tables.
3. Executive dashboard: add a "Skipped cards" counter and a skip-rate line next to the existing review-activity widgets, using the new measures through `MEASURE()`. Keep brand tokens from `docs/plans/ui_brand_plan.md`.
4. G10: delete the two notebooks, their tasks and orphaned conditions, and the three secret YAMLs; remove references in `databricks.yml` `include`, `deploy.sh`, READMEs and `PROJECT_MEMORY.md` under `ground-truth-infra/` (record a request for root files you do not own).
5. Run `bundle validate --strict --target dev` for `ground-truth-infra`.

## Acceptance Criteria

- [ ] `mv_review_activity` has `skips`, `skip_rate`, `skip_reason`; `mv_user_leaderboard` has `total_skips`; existing names unchanged (diff shows additions only).
- [ ] Executive dashboard JSON has the two new widgets, each dataset references only existing views/measures.
- [ ] `grep -rn "NotImplementedError" ground-truth-infra/src` returns nothing; the three secret YAMLs are gone; `post_deploy_setup` has no dangling `depends_on`.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths

- `ground-truth-infra/fixtures/metric_views/**`
- `ground-truth-infra/src/pipelines/**`
- `ground-truth-infra/src/lib/lakebase_cdf.py`
- `ground-truth-infra/src/notebooks/setup_cdf_config.py`
- `ground-truth-infra/src/notebooks/setup_gateway_connection.py`
- `ground-truth-infra/src/notebooks/setup_app_role_sp.py`
- `ground-truth-infra/src/dashboards/**`
- `ground-truth-infra/resources/jobs/post_deploy_setup.job.yml`
- `ground-truth-infra/resources/secrets/**`
- `ground-truth-infra/databricks.yml`
- `ground-truth-infra/README.md`
- `ground-truth-infra/PROJECT_MEMORY.md`

## Dependencies

- None for editing (wave `4-0`); table and column names come from plan 25.
