# 02 — Infra: Lakebase CDF setup job

**Wave 0 · edit · owns `ground-truth-infra/src/notebooks/setup_cdf_config.py`, `ground-truth-infra/resources/jobs/setup_lakebase_cdf.job.yml`, `ground-truth-infra/src/lib/lakebase_cdf.py`**

## Context
* `setup_cdf_config.py` is a stub that raises `NotImplementedError` and targets the branch. The CDF API works at the **database** level: `w.postgres.list_cdf_configs(parent=<database resource>)` returned `[]` on 2026-10-22. `list_cdf_statuses` returned "No API found" — do not depend on it.
* Rules: build_conventions §6; `/memories`-style notes are in `docs/research/02_wilson_score_and_lakebase_cdf.md`.
* Infra notebooks are `.py` (Databricks source format). Jobs use serverless `environments` with `client: "1"`.

## Steps
1. `src/lib/lakebase_cdf.py`: class `LakebaseCdfConfigurator(w, database, source_schema, dest_catalog, dest_schema)` with `ensure()` (list → create if absent → wait on the long-running operation), `history_tables()` (query `information_schema.tables` for `lb_%_history` in the destination), and `wait_for_tables(expected, timeout_s)`. Inspect the installed SDK (`help(w.postgres.create_cdf_config)` and the `CdfConfig` dataclass) and use its real field names; record them in a module docstring.
2. `setup_cdf_config.py`: first cell **Install latest Databricks SDK**; widgets `database` (full resource path), `source_schema` (`app`), `catalog`, `schema`, `expected_tables` (comma list, default `votes,assets,user_activity,campaigns,campaign_assets,app_config,_migrations`), `wait_timeout_seconds` (default `900`). Call `ensure()`, then `wait_for_tables`. Exit with JSON `{config_name, created: bool, tables: [...]}` via `dbutils.notebook.exit`. Fail (raise) if any expected table is missing after the timeout.
3. `resources/jobs/setup_lakebase_cdf.job.yml`: job key `setup_lakebase_cdf`, name `Semantic Ground Truth — Setup Lakebase CDF`, one serverless notebook task pointing at `../../src/notebooks/setup_cdf_config.py`, parameters from `${resources.postgres_databases.app_db.id}`, `${var.catalog}`, `${resources.schemas.ground_truth_schema.name}`. Idempotent: re-running with an existing config only waits and reports.

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-infra`.
* No `NotImplementedError` remains in `setup_cdf_config.py`; the notebook never passes a branch path as the CDF parent.
