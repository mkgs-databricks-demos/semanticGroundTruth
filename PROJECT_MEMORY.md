# PROJECT_MEMORY — Semantic Ground Truth App

## Project Identity

**Repo:** `semanticGroundTruth` (Git folder)
**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)
**Git folder path:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth`
**Git folder ID:** `4271072627166222`
**Author:** Matt Giglia

**One-liner:** A Databricks App for business users to crowdsource and vote on Unity Catalog semantic ground truth — metric view measures/dimensions, Pages, Domains, and Subdomains.

---

## Bundle Layout

Three-bundle monorepo. Deploy order: infra → app → agent (agent can parallel with app).

| # | Directory | `bundle.name` | Purpose | L300 Specs |
|---|-----------|---------------|---------|------------|
| 1 | `ground-truth-infra/` | `ground-truth-infra` | Lakebase project + schema, UC Secrets, SQL Warehouse, Lakeflow Jobs, metric views, Unity Gateway connection, Genie Code skills | L300-01 through L300-08 |
| 2 | `ground-truth-app/` | `ground-truth-app` | Node.js AppKit backend (Review Engine, Campaign Manager, Notification Service), MCP Server, React frontend | L300-09 through L300-13 |
| 3 | `ground-truth-agent/` | `ground-truth-agent` | Operational Genie Agent, metric views over Lakebase CDF, curated instructions | L300-14 through L300-15 |

**Note:** L300-01 originally proposed `bundle-infra/`, `bundle-app/`, `bundle-agent/` as directory names. Actual directories use `ground-truth-*` to match bundle names — clearer and more consistent.

### Targets (all bundles, identical pattern)

| Target | Mode | Status |
|--------|------|--------|
| `dev` | development (default) | **Infra deployed** ✅; **App scaffolded** (AppKit Node.js + React); Agent scaffolded |
| `prod` | production | Scaffolded (all bundles) |
| `staging` | — | Not yet added (L300-01 proposed it; add when needed) |

### Shared Variables

From L300-01 spec. **Infra bundle has these configured.** App and Agent bundles will reference infra outputs via `deploy.sh` / `bundle summary`.

| Variable | Infra (Bundle 1) | Notes |
|----------|-------------------|-------|
| `catalog` | Per-target in `databricks.yml` | dev: `hls_fde_dev`, prod: `prod_ground_truth` |
| `schema` | Per-target in `databricks.yml` | dev: `ground_truth` (deploys as `dev_matthew_giglia_ground_truth`), prod: `semantic_ground_truth` |
| `warehouse_id` | Replaced by `${resources.sql_warehouses.infra_warehouse.id}` | DAB substitution — no raw variable needed |
| `lakebase_project_id` | Replaced by `${resources.postgres_projects.ground_truth_project.id}` | DAB substitution — no raw variable needed |
| `notification_slack_webhook` | UC Secret (`ground-truth-infra` scope) | Manual post-deploy step |
| `notification_teams_webhook` | UC Secret (`ground-truth-infra` scope) | Manual post-deploy step |

> **Critical:** Dev catalog is `hls_fde_dev` (workspace convention), NOT `dev_ground_truth` as originally proposed in L300-01. The `dev_ground_truth` catalog does not exist in this workspace.

---

## Architecture (9 Components)

| # | Component | Type | Bundle |
|---|-----------|------|--------|
| C1 | Asset Registry | Lakebase tables | infra |
| C2 | Review Engine | Node.js AppKit service | app |
| C3 | Card UI | React (framer-motion card-swipe) | app |
| C4 | MCP Server | MCP TypeScript SDK + MCP Apps | app |
| C5 | Campaign Manager | Node.js service + Lakebase | app |
| C6 | Feedback Pipeline | Lakeflow Job + Genie Code task | infra |
| C7 | Notification Service | Pluggable destinations (Slack, Teams, webhook) | app |
| C8 | Executive Dashboard | AI/BI Dashboard or React views | app |
| C9 | Operational Genie Agent | Genie Agent (metric views over CDF) | agent |

---

## Key Technology Decisions

- **Backend:** Node.js (Databricks AppKit)
- **Frontend:** React (card-swipe UX with framer-motion)
- **Database:** Lakebase (Postgres) for app state; CDF replicates to Delta for analytics
- **Auth:** Hybrid OBO (reads UC assets as user) + Service Principal (writes app state)
- **Confidence scoring:** Wilson score interval (configurable industry standard prior, decay curve)
- **MCP:** Streamable HTTP via `@modelcontextprotocol/server` v2; registered as Unity Gateway connection
- **Deployment:** Three-bundle DAB pattern (this repo)
- **Observability:** OpenTelemetry → Unity Catalog tables (via `telemetry_export_destinations` in DAB) + MLflow 3 experiment for agent traces
- **Notifications:** Databricks notification destinations (Slack webhook, Teams, generic webhook)
- **Secrets:** UC Secrets (`catalog.schema.secret`)
- **Compliance:** HIPAA (AWS us-east-1); 28/35 features GA+HIPAA, 7 Beta with documented fallbacks

---

## Design Document Inventory

### Architecture
- `docs/design/L100_semantic_ground_truth_app.md` — System constitution (9 components, tech decisions, cross-cutting patterns, interface contracts)
- `docs/design/semantic-ground-truth-app-ideation.md` — Full brainstorm capture (2026-09-28)

### L200 Component Designs
- `docs/design/L200-C1_asset_registry.md`
- `docs/design/L200-C2_review_engine.md`
- `docs/design/L200-C3_card_ui.md`
- `docs/design/L200-C4_mcp_server.md`
- `docs/design/L200-C5_campaign_manager.md`
- `docs/design/L200-C6_feedback_pipeline.md`
- `docs/design/L200-C7_notification_service.md`
- `docs/design/L200-C8_executive_dashboard.md`
- `docs/design/L200-C9_operational_genie_agent.md`

### L300 Implementation Specs
- `docs/design/L300-01_repo_scaffold_bundle1_config.md` — Repo scaffold + Bundle 1 config
- `docs/design/L300-02_lakebase_project_schema.md` — Lakebase project + schema
- `docs/design/L300-03_secrets_warehouse_notifications.md` — UC Secrets, warehouse, notifications
- `docs/design/L300-04_lakeflow_jobs.md` — Lakeflow Jobs
- `docs/design/L300-05_metric_views_cdf.md` — Metric views + CDF
- `docs/design/L300-06_genie_code_skills.md` — Genie Code skills
- `docs/design/L300-07_unity_gateway_connection.md` — Unity Gateway connection
- `docs/design/L300-08_bundle1_deploy.md` — Bundle 1 deploy
- `docs/design/L300-09_app_init.md` — App initialization
- `docs/design/L300-10_backend_implementation.md` — Backend implementation
- `docs/design/L300-11_mcp_server_implementation.md` — MCP Server implementation
- `docs/design/L300-12_react_frontend.md` — React frontend
- `docs/design/L300-13_bundle2_deploy.md` — Bundle 2 deploy
- `docs/design/L300-14_genie_agent_creation.md` — Genie Agent creation
- `docs/design/L300-15_bundle3_deploy.md` — Bundle 3 deploy
- `docs/design/L300-16_integration_validation.md` — Integration validation

### Research
- `docs/research/01_uc_semantics_api_surface.md` — UC Semantics API surface (metric views, Pages, Domains)
- `docs/research/02_wilson_score_and_lakebase_cdf.md` — Wilson score interval + Lakebase CDF
- `docs/research/03_genie_code_workflow_tasks.md` — Genie Code `genie_task` for Lakeflow Jobs: API surface, deploy pattern, feedback pipeline implications
- `docs/research/04_dab_secrets_jobruns_mcp.md` — New DAB resource types: UC secrets, job_run (deploy hooks), secret_scope, mcp_service; revised post-deploy architecture

### Semantics
- `docs/semantics/01_ground_truth_app_core_terms.md` — Core terminology (10 terms, tagging priorities)

### Pitch / SOW
- `docs/pitch/L100_semantic_ground_truth_app.html` — L100 presentation deck
- `docs/pitch/customer_pitch_semantic_ground_truth.html` — Customer pitch deck
- `docs/pitch/feature_readiness_compliance_matrix.md` — 35-feature HIPAA readiness matrix
- `docs/pitch/sow_timing_estimates.md` — SOW A (greenfield: ~500 hrs / 12-13 wks) + SOW B (repeatable: ~72 hrs / 1.5 wks)

### Diagrams (13 diagrams × 3 formats)
- `docs/diagrams/mermaid/` — Mermaid source (01–13)
- `docs/diagrams/svg/` — Rendered SVG (01–13)
- `docs/diagrams/html/` — Interactive HTML (01–13)

---

## Open Questions — ALL RESOLVED

All open questions from the L300 specs were resolved during Bundle 1 implementation. See `ground-truth-infra/docs/plans/infra_build_plan.md` § Consolidated Open Questions for full findings.

| # | Question | Resolution |
|---|----------|------------|
| 1 | `for_each_task` with `file_list(fixtures/)` | `file_list()` does NOT exist. Use upstream notebook + `taskValues`. |
| 2 | `genie_code_task` in DABs | Available (Beta). No structured output — only a thread link. |
| 3 | Cross-bundle variable sharing | `deploy.sh` pattern: `bundle summary --output json` + `resolve_infra_vars()`. |
| 4 | Staging target | Deferred — not needed for initial deploy. Add when needed. |

---

## Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-09-28 | Ideation complete | Full brainstorm captured |
| 2026-09-29 | Design phase complete | L100, all L200s, all L300s, research docs, pitch materials, 13 diagrams |
| 2026-10-08 | Bundle scaffolds created | Three empty DABs via workspace GUI. Default dev+prod targets. |
| 2026-10-08 | **Bundle 1 fully deployed to dev** | All 8 phases complete. UC schema, SQL warehouse, Lakebase, 4 jobs, metric view fixtures, Unity Gateway runbook, Genie Code skill prompt — all live. Post-deploy cleanup: naming, permissions, YAML split, docs/ restructure. Branch: `mg-genie-bundle-scaffolds`. |
| 2026-10-08 | Post-deploy refactor | Resource YAML split (one file per resource), folder restructure (`docs/plans/`, `docs/runbooks/`, `docs/sessions/`), display name corrections, warehouse permissions. |
| 2026-10-09 | Ready for Bundle 2 | All post-deploy manual steps documented. Remaining: UC secrets, Lakebase Lakehouse Sync, Unity Gateway connection, Genie Code skill registration, app_role SP update, job params. |
| 2026-10-11 | M2M SPN implemented | Bundle-owned OAuth M2M service principal (`semantic-ground-truth-m2m-dev`). New notebooks: `ensure_m2m_service_principal`, `setup_secrets`. Solution-root `deploy.sh` operational — resolves infra vars, deploys, checks M2M credentials. Branch: `mg-genie-m2m-spn`. |
| 2026-10-13 | M2M verified + deploy.sh mature | Token exchange verified (HTTP 200). `setup_secrets` writes `workspace_url`, reports key status via JSON exit. `report_secret_scope_keys()` added to deploy.sh (Step 1e). Genie One MCP smoke test passed (`smoke_test_genie_one_mcp.py`). M2M secret regenerated with `apps ai-gateway` scopes. Branch merged to main. |
| 2026-10-14 | App scaffold + infra support plan | AppKit scaffold via `databricks apps init` (Node.js, React 19, Vite, Tailwind 4, pnpm). MCP service moved from infra to app bundle. `app_bundle_support_plan.md` written. MLflow experiment resource created (`app_agents_experiment`, ID `1698842789305538`). Branch: `mg-genie-app-scaffold`. |
| 2026-10-16 | resolve_infra_vars extended | 5 new outputs: MLFLOW_EXPERIMENT_ID (with CLI <1.21 fallback), MLFLOW_EXPERIMENT_NAME, FRESHNESS_JOB_ID, LAKEBASE_BRANCH, LAKEBASE_DATABASE. New `safe_name()` sanitizer. Full deploy verified green. Committed to `mg-genie-app-scaffold`. |
| 2026-10-19 | deploy.sh Phase 2 implemented | Replaced TODO block with full app deploy: `--var` passthrough (7 infra-resolved vars), app URL resolution from bundle summary, MCP connection check, first-deploy checklist. Header updated (MCP service → MLflow experiment). Stale remote branches pruned. Branch: `mg-genie-app-scaffold`. |
| 2026-10-19 | App bundle Phase A + OTel | Dev/prod targets, OBO scopes (sql/genie/files/model-serving), agents-skills commented out, deprecated infra MCP file deleted. OpenTelemetry enabled: `telemetry_export_destinations` in databricks.yml + `OTEL_TRACES_SAMPLER=always_on` in app.yaml. Branch: `mg-genie-app-scaffold`. |
| 2026-10-19 | **App bundle Phase B — first deploy** ✅ | `dev-semantic-ground-truth` deployed and running. All AppKit plugins operational (agents, analytics, jobs, lakebase, server). Resource bindings active: serving endpoint, MLflow experiment, SQL warehouse, job, Lakebase Postgres. OTel tables created. MCP service pending (expected — connection created post-deploy). Targets reordered: dev (default) → prod → local. `default` renamed to `local`. Bundle state fix required after app rename (delete workspace state + app, fresh deploy). Branch: `mg-genie-app-scaffold` (12 commits ahead of main). |

---

## OpenTelemetry Tables (App Bundle)

Declared in `ground-truth-app/databricks.yml` via `telemetry_export_destinations` (CLI ≥ 0.294.0). Platform auto-creates tables on first deploy. `OTEL_TRACES_SAMPLER=always_on` in `app.yaml` ensures all spans are recorded.

| Signal | Table | Prefix |
|--------|-------|--------|
| Logs | `semantic_ground_truth_otel_logs` | `semantic_ground_truth_` |
| Metrics | `semantic_ground_truth_otel_metrics` | `semantic_ground_truth_` |
| Spans | `semantic_ground_truth_otel_spans` | `semantic_ground_truth_` |

**Dev location:** `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_*`
**Prod location:** `prod_ground_truth.semantic_ground_truth.semantic_ground_truth_otel_*`

Queryable via SQL alongside future Lakebase Lakehouse Sync tables (`lb_*_history`) once those are configured post-deploy.

---

## Critical Deploy Findings (Bundle 1 — apply to all bundles)

1. **Dev catalog:** This workspace uses `hls_fde_dev` for dev targets (not project-specific catalogs). `dev_ground_truth` does not exist.
2. **Lakebase `.id` = full resource path:** `postgres_projects.id` returns `projects/{id}`. NEVER prepend `projects/` manually; use the DAB substitution directly.
3. **Schema dev prefix:** DABs dev mode prepends `dev_<user>_` to schema names. Set the variable to the unprefixed name (e.g. `ground_truth` → deploys as `dev_matthew_giglia_ground_truth`).
4. **Jobs environments block:** `environment_key: X` on tasks requires `environments: [{environment_key: X, spec: {client: "1"}}]` at the job level.
5. **Lakebase branch parent:** Use `.id` directly (already `projects/{id}`); no manual prefix needed.
6. **`engine: direct`** required for `secret_scope`, `job_run`, `mcp_service` resource types.
7. **Bundle summary field names:** Lakebase branches/databases have `.id` (full resource path) but NO `.name`. Experiments have `.name` but `.id` only in CLI ≥ 1.21.
8. **`safe()` strips `/`:** Use `safe_url()` for Lakebase resource paths, `safe_name()` for experiment names (preserves spaces and `[]` from dev-mode prefix).
9. **Backticks in embedded Python comments break bash:** Python code inside `eval "$(python3 -c "...")"` is bash double-quoted — backticks trigger command substitution.
10. **HTTP MCP connections require valid credentials at creation:** Connection must be created post-deploy when app URL is known. The `post_deploy_setup` job handles this via SQL DDL with M2M SPN creds.
11. **UC connection names are metastore-level flat names:** No project/schema prefix.
12. **App in fatal ERROR state cannot be updated — must delete and recreate.** Platform returns "Cannot update app ... fatal error."
13. **Bundle state tracks app by ID:** Renaming an app (e.g. `ground-truth-app` → `dev-semantic-ground-truth`) requires deleting the workspace state file (`~/.bundle/<bundle>/dev/state/resources.json`) AND the old app, then fresh deploy. Otherwise bundle tries CREATE and hits ALREADY_EXISTS.
14. **`default` target renamed to `local`:** App bundle targets: `dev` (default: true), `prod`, `local` (localhost proxy for `pnpm run dev`).
15. **MCP service resource lives in app bundle, NOT infra.** Post-deploy step 4 is `--app`, not `--infra`. Deprecated infra copy deleted in commit `71b5d14`.
16. **`deploy_bundle()` must pass `extra_args` to both validate AND deploy.** Fixed — was only passing to deploy.

---

## Post-Deploy Checklist (First Deploy Only)

After a successful first deploy of `dev-semantic-ground-truth`:

1. ✅ Verify app health: `databricks apps get dev-semantic-ground-truth`
2. ⬜ Note auto-provisioned SPN app ID → update `app_role` identity in Lakebase infra resource
3. ⬜ Run post-deploy setup: `./deploy.sh --target dev --infra --run-setup` (creates MCP HTTP connection with app URL + M2M SPN creds)
4. ⬜ Redeploy **app** bundle: `./deploy.sh --target dev --app` (registers MCP service — connection now exists)
5. ⬜ Verify MCP service in Unity Gateway

> **Critical:** Step 4 is `--app`, NOT `--infra`. The MCP service resource lives in `ground-truth-app/databricks.yml`, not infra. The deprecated infra copy was deleted in commit `71b5d14`.
10. **CLI positional args:** `databricks experiments get-by-name EXPERIMENT_NAME` (positional), NOT `--experiment-name`.

---

## deploy.sh Cross-Bundle Contract

Solution-root `deploy.sh` orchestrates all three bundles. `resolve_infra_vars()` extracts 16 variables from `databricks bundle summary --target <target> --output json`:

| Variable | Source | Sanitizer |
|----------|--------|-----------|
| `CATALOG` | `resources.schemas.*.catalog_name` | `safe()` |
| `SCHEMA` | `resources.schemas.*.name` | `safe()` |
| `SCOPE_NAME` | `variables.secret_scope_name` | `safe()` |
| `WORKSPACE_HOST` | `workspace.host` | `safe_url()` |
| `SQL_WAREHOUSE_ID` | `resources.sql_warehouses.*.id` | `safe()` |
| `LAKEBASE_PROJECT_ID` | `resources.postgres_projects.*.project_id` | `safe()` |
| `M2M_CLIENT_ID_KEY` | `variables.m2m_client_id_dbs_key` | `safe()` |
| `M2M_CLIENT_SECRET_KEY` | `variables.m2m_client_secret_dbs_key` | `safe()` |
| `M2M_SPN_PREFIX` | `variables.m2m_spn_prefix` | `safe()` |
| `M2M_OAUTH_SCOPES` | `variables.m2m_oauth_scopes` | custom |
| `POST_DEPLOY_JOB_ID` | `resources.jobs.post_deploy_setup.id` | `safe()` |
| `MLFLOW_EXPERIMENT_ID` | `resources.experiments.app_agents_experiment.id` + fallback | `safe()` |
| `MLFLOW_EXPERIMENT_NAME` | `resources.experiments.app_agents_experiment.name` | `safe_name()` |
| `FRESHNESS_JOB_ID` | `resources.jobs.freshness_resurfacing.id` | `safe()` |
| `LAKEBASE_BRANCH` | `resources.postgres_branches.production.id` | `safe_url()` |
| `LAKEBASE_DATABASE` | `resources.postgres_databases.app_db.id` | `safe_url()` |

Phase 2 (app deploy) passes these as `--var` to `deploy_bundle`. Phase 2 also resolves the app URL from the app bundle summary and checks/reports MCP HTTP connection status.

## Deviations from L300 Specs

| Item | L300 Spec | Actual | Reason |
|------|-----------|--------|--------|
| Directory name | `bundle-infra/` | `ground-truth-infra/` | Matches bundle name; created via GUI |
| Staging target | Included | Deferred | Not needed for initial dev |
| Dev catalog | `dev_ground_truth` | `hls_fde_dev` | Workspace convention |
| Resource YAML layout | One file per type | One file per resource, subdirs by category | User preference — applied post-deploy |
| `workspace.root_path` | `/Workspace/Shared/.bundles/...` | `/Users/matthew.giglia@databricks.com/.bundle/...` | GUI default; adjust for shared deploy |

---

## Conventions

- **Git workflow:** Feature branches only — never commit directly to `main`. Branch naming: `mg-genie-<short-description>`.
- **Session summaries:** `docs/sessions/YYYY-MM-DD_short-description.md` per bundle root.
- **Schema references in YAML:** Always `${resources.schemas.<name>.*}` — never raw `${var.schema}` except in the schema resource itself.
- **Notebook paths in YAML:** Must match actual file extension on disk. Verify with directory listing before writing.
- **Collaboration:** Check `hi_genie/` at solution root for pending Polly/Isaac recommendations before substantive work.
