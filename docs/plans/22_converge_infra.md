# 22 — Converge infra: secret ACL, bronze refresh, executive dashboard

**Wave 2 · converge (alone) · targets `cdf_bronze_pipeline`, `cdf_bronze_refresh`, `executive_dashboard`, `agent_verification`; table check `bronze_lakebase_cdf`; static check `agent_space`**

Runs before the app converge so the app starts with its secret resolvable (the app runtime gate fails on the m2m-client-id ERROR otherwise).

## Steps
1. From `ground-truth-infra`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=run_setup=false --var=app_service_principal_id=<from apps get dev-semantic-ground-truth>`.
2. `databricks secrets list-acls semantic_ground_truth_credentials`: app SPN must have READ and the owner MANAGE. If READ is missing, fix the YAML/variable, not the ACL by hand.
3. `bundle run cdf_bronze --target dev`, then `bundle run cdf_bronze_refresh --target dev`; both succeed with 0 failed/dropped records.
4. Dashboard is published by the deploy; open its datasets and fix any that fail `LIMIT 1` execution (wrong measure names, catalog/schema) in `src/dashboards/executive.lvdash.json`. Record the dashboard id and published URL in the session summary (session 23 needs it).
5. From `ground-truth-agent`: `bundle run agent_verification --target dev` (regression only; do not edit the agent bundle — if it fails, stop as `blocked` with the failing check).
6. Do not touch masks/tags, silver tables, or feedback-pipeline tasks.

## Stable when
Runtime gate passes for all targets in this wave and the scope ACL gate line holds.
