# 22a — Converge infra: secret ACL + scheduled bronze refresh

**Wave 2 · converge (alone) · session `22a` · target `cdf_bronze_refresh`; gate also checks `cdf_bronze_pipeline` and table `bronze_lakebase_cdf`**

Runs before the app converge so the app starts with its secret resolvable (the app runtime gate fails on the m2m-client-id ERROR otherwise).

2026-10-23: the original session 22 (4 targets) was split under the genie-build-waves rule "one runtime target per converge session". The dashboard moved to [22b](22b_converge_executive_dashboard.md) (wave 3) and the agent regression to [22c](22c_converge_agent_regression.md) (wave 4). Steps 4–5 below are kept for reference but belong to those sessions; **22a doesn't do them**.

## Steps
1. From `ground-truth-infra`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=run_setup=false --var=app_service_principal_id=<from apps get dev-semantic-ground-truth>`.
2. `databricks secrets list-acls semantic_ground_truth_credentials`: app SPN must have READ and the owner MANAGE. If READ is missing, fix the YAML/variable, not the ACL by hand.
3. `bundle run cdf_bronze --target dev`, then `bundle run cdf_bronze_refresh --target dev`; both succeed with 0 failed/dropped records.
4. *(22b)* Dashboard is published by the deploy; open its datasets and fix any that fail `LIMIT 1` execution (wrong measure names, catalog/schema) in `src/dashboards/executive.lvdash.json`. Record the dashboard id and published URL in the session summary (session 23 needs it).
5. *(22c)* From `ground-truth-agent`: `bundle run agent_verification --target dev` (regression only; do not edit the agent bundle — if it fails, stop as `blocked` with the failing check).
6. Do not touch masks/tags, silver tables, or feedback-pipeline tasks.

## Stable when
The wave 2 runtime gate passes (`cdf_bronze_refresh` run started during this build succeeded, `cdf_bronze_pipeline` update clean, `bronze_lakebase_cdf` has the required columns and ≥ 1 row) and the scope ACL gate line holds.
