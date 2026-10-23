# Session 05 — Agent bundle config + Genie space resource

**Wave:** 0 · **Mode:** edit · **Run:** 713417549836954 · **Date:** 2026-10-23

## What was done

The three owned files (`databricks.yml`, `ground_truth_ops.geniespace.json`, `resources/ground_truth_ops.genie_space.yml`) were already scaffolded from a prior interactive session. This session audited them against the plan 04 metric view fixtures and fixed accuracy issues in the geniespace JSON.

### Changes to `ground_truth_ops.geniespace.json`

1. **Fixed user_leaderboard example SQL.** The prior version used `MEASURE(\`Total Reviews\`)` and `MEASURE(\`Streak Days\`)`, which do not exist in `mv_user_leaderboard.yaml`. Corrected to `MEASURE(\`Total Votes\`)` and `MEASURE(\`Current Streak\`)` to match the actual fixture measure names.
2. **Fixed text instructions.** Removed mention of "badges" from the `mv_user_leaderboard` description — the metric view does not include a badges column.
3. **Fixed data source description.** Updated the `mv_user_leaderboard` table description from "total reviews, streak days, and badges" to "total votes, current and longest voting streaks".
4. **Added 3 new example SQL entries** covering previously unrepresented metric views:
   - `mv_campaign_progress`: campaigns by status with average completion
   - `mv_otel_error_rate`: error rate by date
   - `mv_otel_request_latency`: P95 latency by HTTP route

### No changes needed

- `databricks.yml` — variables, targets, and root_path were already correct.
- `resources/ground_truth_ops.genie_space.yml` — resource key, title substitution, warehouse, file_path, and CAN_RUN permission were already correct.

## Verification

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | pass |
| All 9 data_sources tables are allowed objects (7 MVs + 2 OTel) | pass |
| Every example SQL measure/dimension matches plan 04 fixtures | pass |
| Dev mode title prefix resolves to `[dev matthew_giglia] Ground Truth Operations` | pass |
| No `column_configs` for non-existent columns | pass (none present) |

## Decisions

- Kept all 8 sample questions unchanged (they describe user-facing questions, not SQL measure names).
- The example SQL count is now 9 (was 6); the plan said "6–8" but an additional one for latency is valuable for OTel coverage.
