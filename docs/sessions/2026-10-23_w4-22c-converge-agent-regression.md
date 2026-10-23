# Session 22c — Converge agent regression: agent_verification after infra changes

**Wave 4 · converge · run 745271774924215 · 2026-10-23**

## Objective

Regression-only: verify the agent bundle (Genie space + verification job) still works after the infra changes in waves 2–3 (secret ACL restored, bronze refresh job added, executive dashboard published).

## Attempt 1 — stable (first attempt)

### agent_verification job

* **Job:** `[dev matthew_giglia] Ground Truth Agent — Verification` (930756362224750)
* **Run:** 149451153256513, duration 91s, result **SUCCESS**
* All 7 metric views resolve and produce MEASURE results
* `bronze_lakebase_cdf` has votes and assets rows (774 total rows after wave 2 refresh)
* Genie space `01f1ceb0506f1c5d9f2024bfc5f95943` exists with correct warehouse `0ea84986a23a47c3`
* Genie conversation probe ("How many votes were cast in total?") returned SQL attachment SUCCEEDED

### agent_space static checks

* **Tables:** 9/9 data source identifiers resolve in UC (7 metric views + 2 OTel tables)
* **Column configs:** 0 (none defined; nothing stale)
* **Example SQLs:** 9/9 pass EXPLAIN
* **Probe questions (warn mode):** 2/2 pass
  - "How many votes were cast in total?" → SQL SUCCEEDED (MEASURE Total Votes)
  - "How many assets are in each status?" → SQL SUCCEEDED (MEASURE Total Assets GROUP BY status)

### bundle validate

* `bundle validate --strict --target dev` for ground-truth-agent: **Validation OK!**

## Problems

None. The infra changes from waves 2–3 did not break the agent.

## Files Changed

None — no fixes were needed.

## Assets Changed

* `jobs.agent_verification` — new run 149451153256513 triggered during this build

## Checks

| Check | Result | Detail |
|---|---|---|
| agent_verification job SUCCESS | pass | Run 149451153256513, 91s |
| 7 metric views resolve + MEASURE | pass | 7/7 |
| bronze_lakebase_cdf votes + assets rows | pass | 774 rows |
| Genie space exists + correct warehouse | pass | 01f1ceb0506f1c5d9f2024bfc5f95943 |
| Genie conversation probe | pass | SQL attachment SUCCEEDED |
| 9/9 tables resolve in space | pass | 7 MVs + 2 OTel tables |
| 9/9 example SQLs EXPLAIN | pass | All pass |
| 2/2 probe questions (warn) | pass | Both returned SQL |
| bundle validate --strict | pass | ground-truth-agent OK |

## Decisions

* Did not run `bundle deploy` for the agent — the agent bundle is unchanged in this build and `agent_space.require_fresh_deployment: false` in the manifest.

## Requests

None.
