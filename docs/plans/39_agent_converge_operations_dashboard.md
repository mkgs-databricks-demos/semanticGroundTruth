# Session 39: Converge agent: operations dashboard + agent_verification regression

**Build 4 · wave `4-7` · converge (alone) · target `agent_ops_dashboard`; the wave gate also checks `agent_verification`, `agent_space`**

## Steps

1. From `ground-truth-agent`: `bundle validate --strict --target dev`; `bundle deploy --target dev`.
2. The dashboard `[dev matthew_giglia] Semantic Ground Truth — Operations` is created and published; every dataset executes on `0ea84986a23a47c3` (runtime target `execute_datasets`). A dataset error is fixed in `src/dashboards/operations.lvdash.json`; a missing measure means session 37 did not deploy it: stop as `blocked` naming the measure.
3. `bundle run agent_verification --target dev` passes, including the new dashboard check.
4. Genie space probes (`agent_space`) still answer (warn mode).

## Stable when

Runtime gate passes for `agent_ops_dashboard`, `agent_verification` and `agent_space`.

## Owned Paths

- `ground-truth-agent/**` (excluding `ground-truth-agent/.databricks/**`, `ground-truth-agent/docs/plans/**`)

## Dependencies

- 29, 37
