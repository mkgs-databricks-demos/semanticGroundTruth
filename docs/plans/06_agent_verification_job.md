# 06 — Agent bundle: verification job

**Wave 0 · edit · owns `ground-truth-agent/src/**`, `ground-truth-agent/resources/jobs/**`**

## Context
* Supersedes the verification half of `ground-truth-agent/docs/plans/02_metric_views_and_deploy_jobs.md`. Metric view deployment moved to infra (plan 04) — do not create `deploy_metric_views` here.

## Steps
1. `src/notebooks/agent_verification.ipynb`: first cell **Install latest Databricks SDK**; widgets `catalog`, `schema`, `warehouse_id`, `space_title`. Checks, each reported in a result table and failing the run on any failure:
   * the 7 metric views exist and `SELECT MEASURE(<first measure>) FROM <view>` succeeds;
   * `bronze_lakebase_cdf` has rows for `votes` and `assets`;
   * the Genie space with the exact title exists (`w.genie` list), its warehouse equals `warehouse_id`;
   * one Genie conversation question ("How many votes were cast in total?") returns a SQL attachment whose query succeeds.
2. `resources/jobs/agent_verification.job.yml`: key `agent_verification`, name `Ground Truth Agent — Verification`, serverless environment `client: "1"`, notebook path with the `.ipynb` extension, parameters from bundle variables (plan 05 defines them).

## Done when
* `bundle validate --strict --target dev` passes in `ground-truth-agent` (with plan 05's `databricks.yml`; if run before it lands, the integrator re-validates after both).
* Notebook path in YAML matches the file on disk.
