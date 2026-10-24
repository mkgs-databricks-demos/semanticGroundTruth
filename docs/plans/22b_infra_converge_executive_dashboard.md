# 22b — Converge infra: executive AI/BI dashboard

**Wave 3 · converge (alone) · target `executive_dashboard`**

Split out of the original session 22 (2026-10-23) under the genie-build-waves rule: one runtime target per converge session. Runs after 22a so the infra deploy keeps the app SPN READ on the secret scope.

## Steps
1. From `ground-truth-infra`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=run_setup=false --var=app_service_principal_id=<from apps get dev-semantic-ground-truth>` (same variable as 22a, so the scope ACL isn't overwritten).
2. The deploy publishes the dashboard. Every dataset must pass `LIMIT 1` execution on warehouse `0ea84986a23a47c3` (the runtime target sets `execute_datasets: true`). Fix failing datasets (wrong measure names, catalog/schema) only in `src/dashboards/executive.lvdash.json` and `resources/dashboards/**`.
3. Re-check `databricks secrets list-acls semantic_ground_truth_credentials` after each deploy: the app SPN still has READ.
4. Record the dashboard id and published URL (`https://<workspace>/dashboardsv3/<id>/published`) in the session summary. Session 23 reads it from there.
5. Don't edit the secret scope, the bronze pipeline/refresh job, or anything outside the owned paths.

## Stable when
The runtime gate passes for `executive_dashboard` (published, every dataset executes) and the summary records the id and URL.
