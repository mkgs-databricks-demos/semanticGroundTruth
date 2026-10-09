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
| `dev` | development (default) | **Infra deployed** ✅; App + Agent scaffolded |
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
- **Observability:** OpenTelemetry → MLflow 3 experiment
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

---

## Critical Deploy Findings (Bundle 1 — apply to all bundles)

1. **Dev catalog:** This workspace uses `hls_fde_dev` for dev targets (not project-specific catalogs). `dev_ground_truth` does not exist.
2. **Lakebase `.id` = full resource path:** `postgres_projects.id` returns `projects/{id}`. NEVER prepend `projects/` manually; use the DAB substitution directly.
3. **Schema dev prefix:** DABs dev mode prepends `dev_<user>_` to schema names. Set the variable to the unprefixed name (e.g. `ground_truth` → deploys as `dev_matthew_giglia_ground_truth`).
4. **Jobs environments block:** `environment_key: X` on tasks requires `environments: [{environment_key: X, spec: {client: "1"}}]` at the job level.
5. **Lakebase branch parent:** Use `.id` directly (already `projects/{id}`); no manual prefix needed.

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
