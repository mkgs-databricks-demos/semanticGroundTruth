# Session 02 — Infra: Lakebase CDF setup job

**Wave:** 0 | **Mode:** edit | **Run:** 991892831639332 | **Date:** 2026-10-22

## Summary

Implemented the Lakebase CDF setup job: a reusable library module, a fully functional notebook replacing the stub, and a standalone job YAML.

## Changes

### Created: `ground-truth-infra/src/lib/lakebase_cdf.py`

New library module with `LakebaseCdfConfigurator` class:
- `ensure()` — idempotent create via `w.postgres.create_cdf_config(parent=<database>, cdf_config=CdfConfig(catalog, schema, postgres_schema))`. Lists existing configs first; creates and waits on the LRO only if absent.
- `history_tables_spark(spark)` — queries `information_schema.tables` for `lb_%_history` pattern in the destination schema.
- `wait_for_tables(expected, timeout_s, spark)` — polls until all expected `lb_{name}_history` tables appear or timeout.

Module docstring records the real SDK API signatures verified via `inspect.signature` on databricks-sdk >= 0.154.0:
- `CdfConfig` dataclass: `catalog`, `schema`, `postgres_schema`, `cdf_config_id?`, `create_time?`, `name?` (from `databricks.sdk.service.postgres`)
- `create_cdf_config(parent, cdf_config)` → `CreateCdfConfigOperation` with `.wait() → CdfConfig`
- `list_cdf_configs(parent)` → `Iterator[CdfConfig]`

### Rewritten: `ground-truth-infra/src/notebooks/setup_cdf_config.py`

Replaced the `NotImplementedError` stub with a working implementation:
1. Cell 1 (md): Updated design source references and CDF parent note.
2. Cell 2: Install latest SDK + `restartPython()` (unchanged).
3. Cell 3: Widgets — `database` (full resource path), `source_schema` (default `app`), `catalog`, `schema`, `expected_tables` (7 defaults from build_conventions), `wait_timeout_seconds` (default 900).
4. Cell 4: Loads `src/lib/lakebase_cdf.py` via the established `sys.path` pattern (matches `ensure_m2m_service_principal`), calls `ensure()` then `wait_for_tables()`, exits with JSON `{config_name, created, tables}`.

Key change from the stub: uses `database` widget (database resource path) instead of `lakebase_branch_id` (branch path). The CDF API parent must be the database, not the branch.

### Created: `ground-truth-infra/resources/jobs/setup_lakebase_cdf.job.yml`

Standalone job `setup_lakebase_cdf`:
- Name: `Semantic Ground Truth — Setup Lakebase CDF`
- One serverless notebook task pointing at `../../src/notebooks/setup_cdf_config.py`
- Parameters: `database` from `${resources.postgres_databases.app_db.id}`, `catalog` from `${var.catalog}`, `schema` from `${resources.schemas.ground_truth_schema.name}`, plus `source_schema`, `expected_tables`, `wait_timeout_seconds` with sensible defaults.
- Idempotent: re-running with an existing config only waits and reports.

## Checks

| Check | Result |
|---|---|
| `bundle validate --target dev` | pass |
| `bundle validate --strict --target dev` | 1 warning from `resources/pipelines/cdf_bronze.pipeline.yml` (session 03's file, `unknown field: log_name`) — not from my files |
| No `NotImplementedError` in setup_cdf_config.py | pass |
| Notebook never passes branch path as CDF parent | pass — uses `database` widget mapped to `${resources.postgres_databases.app_db.id}` |
| SDK field names verified via introspection | pass |

## Decisions

- Used the same `sys.path` / `Path` import pattern established by `ensure_m2m_service_principal` notebook for loading `src/lib/`.
- Kept the existing `setup_cdf_config` task in `post_deploy_setup.job.yml` untouched (outside my owned_paths). The new standalone job is the primary interface for the converge session.

## Requests

- Session 03: `cdf_bronze.pipeline.yml` has `event_log.name` → bundle CLI warns `unknown field: log_name` under `--strict`. May need `log_name` instead of `name`, or the `event_log` config may need adjustment.
