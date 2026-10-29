# Session 59: Converge agent: ops dashboard readable ids + regression

**Build 5 · wave `5-6` · converge (alone) · target `agent_ops_dashboard`; the wave gate also checks `agent_verification`, `agent_space`**

## Steps

1. From `ground-truth-agent`: `bundle validate --strict --target dev`; `bundle deploy --target dev`; republish the operations dashboard.
2. Run the 3 datasets of follow-up 4 (`ds_votes_skips_daily`, `ds_skips_by_campaign`, `ds_top_skipped_assets`) on the dashboard warehouse: `campaign_id` / `asset_id` are UUID strings (session 47's metric view change). If `ds_top_skipped_assets` is still nondeterministic (ties), record a `request` with the tie-break SQL from follow-up 4 for the owner (the `.lvdash.json` is a workspace dashboard object; do not edit it with file tools).
3. `bundle run agent_verification --target dev`: all checks pass (29/29 or more). Fix agent bundle files (Genie space instructions, example SQL, verification notebook) that broke because ids became strings.
4. Genie space example SQL `EXPLAIN`s pass (gate `check_example_sql`).

## Stable when

Ops dashboard published with every dataset executing; `agent_verification` latest run passes; Genie space checks pass.

## Owned paths

* `ground-truth-agent/**` (excluding `ground-truth-agent/.databricks/**`, `ground-truth-agent/docs/plans/**`)

## Dependencies

47, 57
