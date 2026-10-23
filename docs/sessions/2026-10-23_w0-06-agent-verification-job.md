# Session 06 — Agent verification job

**Wave:** 0 · **Mode:** edit · **Run:** 713417549836954 · **Date:** 2026-10-23

## Scope

`agent_verification.ipynb` and its job YAML in the agent bundle. No metric view deployment in this bundle.

## Findings

Both deliverables already existed and matched the plan requirements exactly. No edits were necessary.

### Notebook: `ground-truth-agent/src/notebooks/agent_verification.ipynb`

7 cells implementing all 4 plan checks:

1. **Install latest Databricks SDK** — `%pip install --upgrade databricks-sdk` + `dbutils.library.restartPython()` (function form per conventions)
2. **Parameters** — widgets `catalog`, `schema`, `warehouse_id`, `space_title` with dev defaults
3. **Verify metric views** — all 7 metric views listed (`mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`, `mv_campaign_progress`, `mv_otel_error_rate`, `mv_otel_request_latency`); uses `DESCRIBE TABLE EXTENDED AS JSON` to discover first measure, then `SELECT MEASURE(<measure>) FROM <view>`
4. **Verify bronze CDF** — checks `bronze_lakebase_cdf` has rows for `_source_table = 'votes'` and `'assets'`
5. **Verify Genie space** — exact title match via `GET /api/2.0/genie/spaces`, warehouse equality check
6. **Verify Genie conversation** — asks "How many votes were cast in total?", requires SQL attachment with SUCCEEDED status
7. **Results summary** — displays result table, raises `AssertionError` on any failure

### Job YAML: `ground-truth-agent/resources/jobs/agent_verification.job.yml`

- Key: `agent_verification`
- Name: `Ground Truth Agent — Verification` (dev mode adds `[dev matthew_giglia]` prefix)
- Serverless environment: `client: "1"`
- Notebook path: `../../src/notebooks/agent_verification.ipynb` (matches `.ipynb` file on disk)
- Parameters: `catalog`, `schema`, `warehouse_id`, `space_title` from bundle variables

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` | pass |
| Notebook path in YAML matches file on disk | pass |
| Notebook implements all 4 plan checks | pass |
| Job YAML fields match plan 06 spec | pass |

## Files modified

None — both files were already present and correct.

## Decisions

- Files were already present from a prior session/run; verified they match plan 06 exactly rather than overwriting.

## Requests

None.
