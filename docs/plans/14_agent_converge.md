# 14 — Converge: Genie agent + verification

**Wave 4 · converge (alone) · targets `agent_space`, `agent_verification`**

## Goal
The Ground Truth Operations Genie agent is deployed by the agent bundle over the 7 metric views + OTel tables and answers operational questions with SQL that runs.

## Steps
1. From `ground-truth-agent`: `bundle validate --strict --target dev`; `bundle deploy --target dev`.
2. Confirm the deployed space title is exactly `[dev matthew_giglia] Ground Truth Operations` (the gate looks it up by name); if not, fix `space_title` in `databricks.yml`.
3. Fix any table that does not resolve, stale `column_configs`, or example SQL that fails `EXPLAIN` in `ground_truth_ops.geniespace.json`.
4. `bundle run agent_verification --target dev` until green.

## Stable when
Runtime gate passes: space updated in this run, warehouse `0ea84986a23a47c3` attached, every data source resolves, every example SQL passes `EXPLAIN`, probe questions produce SQL that runs (warn mode), verification job `SUCCESS`.
