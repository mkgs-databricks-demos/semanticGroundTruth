# Session 03 — Infra: CDF to bronze Spark Declarative Pipeline

**Wave:** 0 | **Mode:** edit | **Run:** 991892831639332 | **Date:** 2026-10-22

## Summary

Implemented the metadata-driven SDP pipeline that streams every `lb_*_history` table into a single `bronze_lakebase_cdf` streaming table. The pipeline uses the confirmed 10-column schema from build_conventions §7 with a VARIANT `data` column.

## Files created (8)

| File | Purpose |
|---|---|
| `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml` | Fixture YAML: 21 Postgres tables (migrations 001–007) with primary keys |
| `ground-truth-infra/src/lib/cdf_bronze/__init__.py` | Package init with public exports |
| `ground-truth-infra/src/lib/cdf_bronze/config.py` | YAML loader + validation (CdfBronzeConfig dataclass) |
| `ground-truth-infra/src/lib/cdf_bronze/keys.py` | `record_key_expr()` — BINARY(16) UUID → 8-4-4-4-12 hex; composite keys → pipe-joined |
| `ground-truth-infra/src/lib/cdf_bronze/builder.py` | `CdfBronzeBuilder` class — one `dp.create_streaming_table` + N `@dp.append_flow` per existing source |
| `ground-truth-infra/src/lib/cdf_bronze/test_keys.py` | 5 unit tests: UUID, string, integer, composite binary+string, composite non-binary |
| `ground-truth-infra/src/pipelines/cdf_bronze.py` | Pipeline source — reads spark.conf, calls CdfBronzeBuilder.define() |
| `ground-truth-infra/resources/pipelines/cdf_bronze.pipeline.yml` | Pipeline resource YAML — serverless, event_log, catalog/schema/config via spark.conf |

## Architecture

* **Metadata-driven**: config in YAML fixture, logic in reusable `CdfBronzeBuilder` class, pipeline source is 12 lines.
* **SDP style**: `from pyspark import pipelines as dp`, `dp.create_streaming_table`, `@dp.append_flow`, `spark.readStream.table`. No `import dlt`.
* **Graceful skip**: history tables not yet in UC are logged and skipped — the streaming table is still created.
* **UUID handling**: BINARY(16) PKs are formatted as lowercase 8-4-4-4-12 hex via `hex()` + `substring()`; non-binary keys are cast to string.
* **VARIANT column**: `data` = `to_variant_object(struct(* EXCEPT (cdf_columns)))` keeps all source data columns with types.
* **Import path**: `cdf_bronze.lib_path` spark.conf → `sys.path.insert` in the pipeline source, so `cdf_bronze` package resolves.

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | pass |
| No `import dlt` / `dlt.` in owned files | pass |
| 21 tables in YAML with keys | pass |
| 10 columns in BRONZE_COLUMNS match §7 order | pass |
| 5/5 unit tests (keys module) | pass |
| Pipeline library file exists on disk | pass |

## Decisions

* Used `sys.path.insert` with a `cdf_bronze.lib_path` spark.conf key (passed from the pipeline YAML) to make `src/lib/cdf_bronze` importable at pipeline runtime. Alternative was `root_path` but that has no direct mapping in the pipeline API.
* Kept `BRONZE_SCHEMA` StructType in builder.py for documentation; the actual streaming table schema is inferred from the append flows (no explicit schema passed to `dp.create_streaming_table`).

## Requests

None.
