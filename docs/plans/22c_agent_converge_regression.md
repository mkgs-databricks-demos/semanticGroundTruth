# 22c — Converge agent regression: agent_verification after infra changes

**Wave 4 · converge (alone) · target `agent_verification`; static check `agent_space`**

Split out of the original session 22 (2026-10-23) under the genie-build-waves rule: one runtime target per converge session. This build does not change the agent bundle; this session proves the infra changes in waves 2–3 didn't break it.

## Steps
1. From `ground-truth-agent`: `bundle run agent_verification --target dev`. Don't run `bundle deploy` for the agent; the space is unchanged (`agent_space.require_fresh_deployment: false`).
2. If a check fails, read the failing task output. If the cause is an infra change from this build (metric view, bronze table, grants, secret ACL), fix it in `ground-truth-infra` (owned paths), redeploy infra with `--var=run_setup=false --var=app_service_principal_id=<app SPN>`, and re-run `agent_verification`.
3. If the fix would need an agent bundle edit, stop as `blocked` and name the failing check. Don't edit `ground-truth-agent/**`.
4. Genie probe questions on `agent_space` are `warn` only; record them in the summary but don't iterate on them.

## Stable when
The runtime gate passes for `agent_verification` (a successful run started during this build) and the `agent_space` static checks pass.
