# Session 06 — Agent verification job

**Wave:** 0 · **Mode:** edit · **Run:** 991892831639332 · **Date:** 2026-10-22

## Scope

agent_verification.ipynb and its job YAML in the agent bundle. No metric view deployment in this bundle.

## Files created

| File | Description |
|---|---|
| `ground-truth-agent/src/notebooks/agent_verification.ipynb` | 7-cell verification notebook (SDK install, params, 4 check categories, results) |
| `ground-truth-agent/resources/jobs/agent_verification.job.yml` | Job YAML: key `agent_verification`, serverless `client: "1"`, params from bundle vars |

## Notebook checks

1. **Metric views (7):** Verifies each exists and `SELECT MEASURE(<first_measure>) FROM <view>` succeeds. Measures discovered dynamically via `DESCRIBE TABLE EXTENDED ... AS JSON`.
2. **Bronze CDF:** `bronze_lakebase_cdf` has rows where `_source_table IN ('votes', 'assets')`.
3. **Genie space:** Space with exact title exists, warehouse matches `warehouse_id`. Found via `GET /api/2.0/genie/spaces`.
4. **Genie conversation:** "How many votes were cast in total?" returns a SQL attachment whose query result is `SUCCEEDED`.

All checks reported in a result DataFrame; any failure raises `AssertionError` to fail the job run.

## Decisions

- Widget `schema` maps to bundle variable `schema_name` via `base_parameters` in the job YAML.
- Metric view measure discovery is dynamic (parses DESCRIBE AS JSON), not hard-coded to specific measure names — resilient to session 04 naming choices.
- Genie space lookup uses the REST API list endpoint, not SDK model, because the SDK lacks `list_spaces()`.
- Genie conversation status detection handles both `statement_response.status.state` and `status` attribute paths for SDK version resilience.

## Checks run

| Check | Result | Detail |
|---|---|---|
| YAML syntax | pass | Parsed with PyYAML |
| Notebook path vs disk | pass | `git ls-files` confirms `agent_verification.ipynb` |
| `bundle validate --strict` | skipped | Missing `${var.*}` variables (session 05 parallel dep); plan says integrator re-validates |
| Include pattern | pass | `resources/*/*.yml` matches `resources/jobs/agent_verification.job.yml` |

## Assumptions

- Session 05 (parallel) defines variables `catalog`, `schema_name`, `warehouse_id`, `space_title` with the documented dev defaults in `ground-truth-agent/databricks.yml`.
- Session 04 (parallel) creates 7 metric views: mv_review_activity, mv_coverage_metrics, mv_user_leaderboard, mv_feedback_pipeline, mv_campaign_progress, mv_otel_error_rate, mv_otel_request_latency. Each has at least one measure discoverable via `DESCRIBE TABLE EXTENDED ... AS JSON`.

## Requests

None.
