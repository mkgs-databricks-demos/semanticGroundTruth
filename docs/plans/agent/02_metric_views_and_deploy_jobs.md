# Session 02: Metric view SQL + deploy/verification jobs (Wave 0)

## Scope
Create the metric view deployment notebook (reads YAML fixtures from infra bundle, creates SQL metric views), OTel operational metric views, a deploy verification notebook, and the corresponding job resource YAMLs.

## Context
* **Infra metric view fixtures** (4 files) live at `ground-truth-infra/fixtures/metric_views/mv_*.yaml`. Each contains a `sql:` field with a full `CREATE VIEW ... WITH METRICS LANGUAGE YAML AS $$ ... $$` DDL statement using `${catalog}.${schema}` placeholders.
* **Known risk:** Infra fixtures reference CDF columns (`vote_type`, `reviewer_id`, `asset_type`, `status`, etc.) that were designed before the app migrations (session 03) were written. The actual `lb_*_history` table columns may differ. The converge session (03) must verify columns match at deploy time.
* **Lakehouse Sync tables** (`lb_*_history`) do NOT exist yet. They will be created automatically by Lakehouse Sync after the app is deployed and migrations run (Part A wave 7). The metric view DDL may fail until these tables appear.
* **OTel tables** (8 tables) already exist: `semantic_ground_truth_otel_{logs,metrics,spans,annotations}` × 2 prefixes.
* **Auth pattern:** Deploy notebook runs on serverless compute as the user. Metric views are SQL DDL — `CREATE OR REPLACE VIEW` requires schema ownership or `CREATE TABLE` privilege.
* **Infra warehouse ID (dev):** Look it up from the infra bundle or accept as a parameter.

## Tasks
1. Create `src/notebooks/deploy_metric_views.ipynb`:
   a. Cell 1: Install SDK + restart.
   b. Cell 2: Widgets: `catalog`, `schema_name`, `warehouse_id`, `infra_fixtures_path` (default: `../../ground-truth-infra/fixtures/metric_views`).
   c. Cell 3: Read all `mv_*.yaml` files from the fixtures path. Parse each to extract the `sql:` field. Replace `${catalog}` and `${schema}` placeholders with widget values.
   d. Cell 4: Execute each DDL statement against the SQL warehouse. Collect pass/fail per metric view.
   e. Cell 5: Create 2 OTel operational metric views via SQL DDL:
      * `mv_otel_error_rate` — over `semantic_ground_truth_otel_logs`: error count, total log count, error rate by severity/time.
      * `mv_otel_request_latency` — over `semantic_ground_truth_otel_spans`: p50/p95/p99 latency by operation/time.
   f. Cell 6: Verify all metric views exist: `SHOW VIEWS IN <catalog>.<schema> LIKE 'mv_%'`.
   g. Output a summary table.
2. Create `src/notebooks/agent_verification.ipynb`:
   a. Cell 1: Install SDK + restart.
   b. Cell 2: Widgets: `catalog`, `schema_name`, `genie_space_id` (will be filled by the converge session after first deploy).
   c. Cell 3: Verify metric views exist (same SHOW VIEWS check).
   d. Cell 4: Run a sample query against each metric view to confirm they return data.
   e. Cell 5: If `genie_space_id` is provided, verify the Genie Agent is accessible via the API.
   f. Cell 6: Summary table of all checks (pass/fail).
3. Create `resources/jobs/deploy_metric_views.job.yml`:
   a. Name: `${var.app_display_name}-deploy-metric-views`.
   b. Single notebook task running `deploy_metric_views.ipynb` with parameters.
4. Create `resources/jobs/agent_verification.job.yml`:
   a. Name: `${var.app_display_name}-agent-verification`.
   b. Single notebook task running `agent_verification.ipynb` with parameters.
5. Run `bundle validate --strict --target dev`.

## Acceptance Criteria
- [ ] `src/notebooks/deploy_metric_views.ipynb` exists with 6 cells covering YAML parsing, DDL execution, OTel views, and verification.
- [ ] `src/notebooks/agent_verification.ipynb` exists with metric view + agent checks.
- [ ] 2 job resource YAMLs exist under `resources/jobs/`.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `src/notebooks/deploy_metric_views.ipynb`
- `src/notebooks/agent_verification.ipynb`
- `resources/jobs/deploy_metric_views.job.yml`
- `resources/jobs/agent_verification.job.yml`

## Dependencies
- None (parallel with session 01).
