# 13 — Converge: Lakebase CDF, bronze pipeline, metric views

**Wave 3 · converge (alone) · targets `infra_setup_cdf`, `cdf_bronze_pipeline`, `infra_metric_view_deploy`; table checks `lb_votes_history`, `lb_assets_history`, `bronze_lakebase_cdf`, `mv_review_activity`**

## Goal
Lakebase changes replicate to `lb_*_history`, the bronze pipeline lands them in `bronze_lakebase_cdf` with the confirmed schema, and the 7 metric views resolve over bronze.

## Steps
1. From `ground-truth-infra`: `bundle validate --strict --target dev`; deploy with `--var=run_setup=false` (do not re-run post-deploy setup).
2. `bundle run setup_lakebase_cdf --target dev`. Fix SDK field names / parent path issues in `src/lib/lakebase_cdf.py` and the notebook. Wave 2 already wrote assets, votes, campaigns and `app_config`, so the expected history tables must appear (initial snapshot); allow up to 15 minutes.
3. `bundle run cdf_bronze --target dev`. Fix graph/import errors (library path, `root_path`, YAML path). Check: 10 columns in order, `_record_key` UUID text for `votes`, `data` is VARIANT. If an `lb_*` table was re-snapshotted, full-refresh that flow.
4. `bundle run metric_view_deploy --target dev`. Fix fixture SQL until all 7 views create and `SELECT MEASURE(...)` returns.
5. Do not add masks, tags, silver tables, or Delta CDF.

## Stable when
Runtime gate passes: all three targets succeeded in this run, the pipeline had 0 failed/dropped records, `lb_votes_history` and `lb_assets_history` have rows, `bronze_lakebase_cdf` has the 10 required columns with rows written this run, and `mv_review_activity` resolves.
