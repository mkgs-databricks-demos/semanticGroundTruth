# 03 — Infra: Lakebase CDF → bronze Spark Declarative Pipeline

**Wave 0 · edit · owns `ground-truth-infra/fixtures/pipelines/**`, `ground-truth-infra/src/lib/cdf_bronze/**`, `ground-truth-infra/src/pipelines/**`, `ground-truth-infra/resources/pipelines/**`**

## Context
* Bronze schema, keys and SDP style are fixed in build_conventions §7. Do not add silver, expectations that drop rows, masks, or Delta CDF.
* Verified on lakeLoom `lb_projects_history`: UUID PKs arrive as BINARY; `to_variant_object(struct(* EXCEPT (_pg_change_type,_pg_lsn,_pg_xid,_timestamp,_sort_by)))` keeps types and `variant_get(data,'$.name','string')` works.

## Steps
1. `fixtures/pipelines/cdf_bronze_tables.yaml`: `target_table: bronze_lakebase_cdf`, `history_table_pattern: lb_{table}_history`, `cdf_columns: [_pg_change_type, _pg_lsn, _pg_xid, _timestamp, _sort_by]`, and `tables:` — one entry per Postgres table in build_conventions §7 with `name` and `keys` (list).
2. `src/lib/cdf_bronze/` package: `config.py` (load + validate YAML), `keys.py` (Column expression for `_record_key`: BINARY length 16 → UUID text; other types cast to string; composite joined with `|`), `builder.py` class `CdfBronzeBuilder(spark, catalog, schema, config)` with `existing_sources()` (only history tables present in UC; log the skipped ones) and `define()` (one `dp.create_streaming_table` with `cluster_by=['_source_table']` and the exact column list, plus one `@dp.append_flow` per existing source named `bronze_from_<table>`).
3. `src/pipelines/cdf_bronze.py`: read `catalog`, `schema`, `config_path` from `spark.conf`, build config, call `CdfBronzeBuilder(...).define()`. Nothing else.
4. `resources/pipelines/cdf_bronze.pipeline.yml`: key `cdf_bronze`, name `Semantic Ground Truth — Lakebase CDF Bronze`, `serverless: true`, `catalog: ${var.catalog}`, `schema: ${resources.schemas.ground_truth_schema.name}`, `continuous: false`, library = the pipeline file, `configuration` passes catalog/schema/config path (workspace path under `${workspace.file_path}`), `root_path` so `src/lib` is importable, and an `event_log` table `cdf_bronze_event_log` in the same schema.
5. Unit test `src/lib/cdf_bronze/test_keys.py` for UUID formatting and composite keys (pure function on literals).

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-infra`.
* No `import dlt` / `dlt.` anywhere; column list in `builder.py` equals the 10 columns in build_conventions §7 in that order.
* Every Postgres table from migrations 001–007 appears in the YAML with keys.
