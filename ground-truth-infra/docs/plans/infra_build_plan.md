# ground-truth-infra — Build Plan

## Bundle 1: Infrastructure

**Purpose:** Deploy all shared infrastructure that Bundle 2 (App) and Bundle 3 (Agent) depend on.
**Deploy order:** This bundle deploys FIRST. Bundles 2 and 3 deploy after this succeeds.
**Design sources:** L100 §Deployment Architecture, L200-C1, L200-C6, L200-C9, L300-01 through L300-08

---

## Resource Inventory

Everything this bundle declares or creates.

### DAB-Declared Resources (`resources/*.yml`)

| Resource | Type | File | Design Source |
|----------|------|------|---------------|
| `ground_truth_schema` | UC Schema | `resources/schemas.yml` | L300-01 §Step 3 |
| `infra_warehouse` | SQL Warehouse | `resources/warehouses.yml` | L300-03 §Step 2 |
| `ground_truth_project` | Lakebase Project (`postgres_projects`) | `resources/lakebase.yml` | L300-02 §Step 1 |
| `production` | Lakebase Branch (`postgres_branches`) | `resources/lakebase.yml` | L300-02 §Step 2 |
| `dev_branch` | Lakebase Branch (`postgres_branches`) | `resources/lakebase.yml` | L300-02 §Step 2 |
| `app_endpoint` | Lakebase Endpoint (`postgres_endpoints`) | `resources/lakebase.yml` | L300-02 |
| `app_role` | Lakebase Role (`postgres_roles`) | `resources/lakebase.yml` | L300-02 |
| `app_db` | Lakebase Database (`postgres_databases`) | `resources/lakebase.yml` | L300-02 |
| `sync_assets` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `sync_votes` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `sync_user_activity` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `sync_confidence_scores` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `sync_campaigns` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `sync_feedback_batches` | Lakebase Synced Table (`postgres_synced_tables`) | `resources/lakebase.yml` | L300-02, L200-C9 |
| `feedback_pipeline` | Lakeflow Job | `resources/jobs.yml` | L300-01 §Step 3, L300-04 |
| `freshness_resurfacing` | Lakeflow Job | `resources/jobs.yml` | L300-01 §Step 3, L300-04 |
| `metric_view_deploy` | Lakeflow Job | `resources/jobs.yml` | L300-01 §Step 3, L300-05 |
| `post_deploy_validation` | Lakeflow Job | `resources/jobs.yml` | L300-01 §Step 3, L300-08 |
| ~~`schema_migrations`~~ | ~~Lakeflow Job~~ | ~~`resources/jobs.yml`~~ | **MOVED to Bundle 2 (App).** Follows lakeLoom pattern: TypeScript migrations run on app server startup via AppKit Lakebase client, not as a separate infra job. See `lakeloom-ai/server/migrations/migrate.ts`. |

> Lakebase DAB support (Beta, Feb 2026). No `postgres_catalogs` — CDF via synced tables only. See **PROJECT_MEMORY.md § Lakebase DAB Research Notes** for full documentation references, substitution patterns, and approach hierarchy.

### Manual / CLI Resources (not DAB-declarable)

| Resource | Type | Created Via | Design Source |
|----------|------|-------------|---------------|
| UC Secrets | `catalog.schema.secret` | SQL `CREATE SECRET` | L300-03 §Step 1 |
| Notification destinations | Workspace settings | Workspace UI | L300-03 §Step 3 |
| Unity Gateway connection | HTTP connection | `databricks connections create` | L300-07 §Step 1 |
| MCP Service config | Unity Gateway UI | Unity Gateway > MCPs | L300-07 §Step 2 |
| Genie Code custom skill | Skills library | Workspace UI or API | L300-06 §Step 3 |

> **Note:** Unity Gateway connections are NOT a DAB resource type as of Oct 2026. Lakebase resources moved to DAB-declared above.

---

## Variables

All variables needed in `databricks.yml`.

| Variable | Description | Dev Default | Prod Default | Source |
|----------|-------------|-------------|--------------|--------|
| `catalog` | Target UC catalog | `dev_ground_truth` | `prod_ground_truth` | L300-01 |
| `schema` | Target UC schema | `app` | `app` | L300-01 |
| `warehouse_id` | ~~Replaced by DAB substitution~~ `${resources.sql_warehouses.infra_warehouse.id}` | N/A | N/A | L300-03 |
| `lakebase_project_id` | ~~Replaced by DAB substitution~~ `${resources.postgres_projects.ground_truth_project.id}` | N/A | N/A | L300-02 |
| `notification_slack_webhook` | Slack webhook URL | `""` | (customer provides) | L300-03 |
| `notification_teams_webhook` | Teams webhook URL | `""` | (customer provides) | L300-03 |

---

## Source Files to Create

### ~~Migrations (`src/migrations/`)~~ — MOVED to Bundle 2 (App)

> **Decision:** Following the lakeLoom pattern (`lakeloom-ai/server/migrations/`), all Lakebase schema migrations belong in the **app bundle**, not infra. The app's Node.js server runs migrations on startup via the AppKit Lakebase client — idempotent, tracked in an `app._migrations` table. This keeps schema evolution tightly coupled to the application code that depends on it.
>
> **What moved:** All 10 migration scripts (V001–V010), the migration runner notebook (`run_migrations.py`), and the `schema_migrations` Lakeflow Job. The `REPLICA IDENTITY FULL` setup (V010) also moves to the app — lakeLoom handles this identically (see `011_replica_identity_assignments.ts`).
>
> **What stays in infra:** The Lakebase project, branches, endpoints, roles, databases, and synced table declarations in `resources/lakebase.yml`. Infra creates the container; the app fills it.
>
> **Reference:** `lakeLoom/lakeloom-ai/server/migrations/migrate.ts` — TypeScript migration runner, 22 migrations, runs on every server startup.

### Notebooks (`src/notebooks/`)

| File | Purpose | Design Source | Job |
|------|---------|---------------|-----|
| ~~`run_migrations.py`~~ | ~~Migration runner~~ | ~~L300-02 §Step 4~~ | **MOVED to Bundle 2 (App).** Replaced by TypeScript migration runner in app server. |
| `collect_feedback.py` | Query unprocessed votes, group by asset, compile feedback JSON | L300-04 §Step 1 | `feedback_pipeline` task 1 |
| `create_feature_branch.py` | Create Git feature branches with proposed YAML edits | L300-04 §Step 4 | `feedback_pipeline` task 3 |
| `freshness_check.py` | Identify stale production assets, add to freshness campaigns | L300-04 §Step 3 | `freshness_resurfacing` |
| `list_fixtures.py` | List `fixtures/*.yaml` files, emit array via `dbutils.jobs.taskValues.set()` for `for_each_task` input | L300-04 §Q1 | `metric_view_deploy` upstream task |
| `deploy_metric_view.py` | Read fixture YAML, resolve env refs, execute CREATE VIEW SQL | L300-01 §Step 4 | `metric_view_deploy` forEach |
| `post_deploy_validation.py` | Validate all Bundle 1 resources deployed correctly | L300-01 §Step 4, L300-08 | `post_deploy_validation` |

### Prompts (`src/prompts/`)

| File | Purpose | Design Source |
|------|---------|---------------|
| `feedback_loop_prompt.md` | Genie Code skill prompt for YAML edit generation | L300-01 §Step 5, L300-06 |

### Metric View Fixtures (`fixtures/`)

From L200-C9 §Metric Views and L300-05 §Step 2.

| File | Source CDF Table | Key Measures |
|------|-----------------|---------------|
| `mv_review_activity.yaml` | `lb_votes_history` | Total Votes, Unique Reviewers, Approval Rate |
| `mv_coverage_metrics.yaml` | `lb_assets_history` | Total Assets, Reviewed Assets, Certified Assets, Coverage Pct |
| `mv_user_leaderboard.yaml` | `lb_user_activity_history` | Total Reviews, Edits Accepted, Streak Days, Badges |
| `mv_feedback_pipeline.yaml` | `lb_feedback_batches_history` | Total Batches, Success Rate, Avg Processing Time |

---

## Build Phases

Sequential phases with dependency gates. Each phase must validate before the next begins.

### Phase 1: Bundle Configuration
**L300:** 01 | **Effort:** Low | **Type:** Manual editing

Configure `databricks.yml` with variables, targets, and include paths. Create `resources/` directory structure.

**Deliverables:**
- [ ] `databricks.yml` — variables, workspace root_path, staging target (if needed)
- [ ] `resources/schemas.yml` — UC schema resource using `${var.catalog}` and `${var.schema}`

**Validation gate:** `databricks bundle validate --strict --target dev`

---

### Phase 2: Lakebase Project + Schema
**L300:** 02 | **Effort:** Medium | **Prerequisites:** Phase 1 validated

**Approach (updated):** Lakebase resources are now DAB-declarable (Beta, Feb 2026). Instead of manual CLI commands, declare `postgres_projects`, `postgres_branches`, `postgres_endpoints`, `postgres_roles`, `postgres_databases`, and `postgres_synced_tables` in `resources/lakebase.yml`. Deploy via `databricks bundle deploy`. No `postgres_catalogs` (UC catalog binding) — CDF via synced tables only (avoids CREATE CATALOG metastore permission).

**Deliverables:**
- [ ] `resources/lakebase.yml` — Lakebase project, production branch, dev branch, endpoint, app role, app database, 6 synced tables (CDF)
- [ ] `databricks bundle deploy --target dev` creates all Lakebase resources declaratively
- [ ] `lakebase_project_id` no longer needed as a manual variable — use `${resources.postgres_projects.ground_truth_project.id}` substitution
- [ ] 6 synced tables declared: assets, votes, user_activity, confidence_scores, campaigns, feedback_batches → CDF Delta tables in `${var.catalog}.${var.schema}`
- [ ] ~~`src/migrations/V001` through `V010`~~ — **MOVED to Bundle 2 (App).** App server runs TypeScript migrations on startup.
- [ ] ~~`src/notebooks/run_migrations.py`~~ — **MOVED to Bundle 2 (App).**
- [ ] ~~`resources/jobs.yml` entry for `schema_migrations` job~~ — **MOVED to Bundle 2 (App).**
- [ ] ~~Migrations executed successfully on dev branch~~ — **Validated during Bundle 2 first deploy.**
- [ ] ~~CDF enabled on 6 tables (V010)~~ — **MOVED to Bundle 2 (App).** REPLICA IDENTITY FULL set as an app migration (lakeLoom pattern: `011_replica_identity_assignments.ts`).

**Validation gate:** Lakebase project, branches, endpoint, database, and synced table declarations deploy successfully; synced tables visible in UC

**Resolved questions:**
1. ~~Lakebase migration tooling~~ — **App-side TypeScript migrations (lakeLoom pattern).** No infra migration runner needed.
2. ~~CDF table naming~~ — Synced tables use **configurable destination names** declared in the `postgres_synced_tables` resource. Not the legacy `lb_<table>_history` convention.
3. ~~Lakebase project/branches as DAB resources~~ — **Yes, fully supported (Beta).** Use `postgres_projects`, `postgres_branches`, `postgres_endpoints`, `postgres_databases`, `postgres_roles`, `postgres_synced_tables`.
4. ~~`postgres_catalogs` (UC catalog binding)~~ — **REMOVED.** Requires CREATE CATALOG on metastore. Using CDF via `postgres_synced_tables` instead.

---

### Phase 3: SQL Warehouse + UC Secrets + Notifications
**L300:** 03 | **Effort:** Low | **Prerequisites:** Phase 2 (Lakebase project exists)

**Deliverables:**
- [ ] SQL Warehouse declared in `resources/warehouses.yml`; reference via `${resources.sql_warehouses.infra_warehouse.id}` substitution (no manual variable needed)
- [ ] `resources/warehouses.yml` — serverless SQL warehouse resource (2X-Small PRO)
- [ ] UC Secrets created: `slack_webhook_url`, `teams_webhook_url`, `git_token`
- [ ] Notification destinations configured in workspace settings
- [ ] Variables updated with actual IDs

**Validation gate:** Warehouse is accessible; secrets are readable via `SELECT secret(...)`

**Resolved question:** ~~UC Secrets from Node.js~~ — REST API directly (`GET /api/2.1/unity-catalog/secrets/{full_name}?include_value=true`). JS SDK has `SecretsClient`. No need for SQL `SELECT secret()`.

---

### Phase 4: Lakeflow Jobs
**L300:** 04 | **Effort:** High | **Prerequisites:** Phase 2 + 3

The core automation — feedback pipeline, freshness checks, and metric view deployment.

**Deliverables:**
- [ ] `src/notebooks/collect_feedback.py` — feedback collection
- [ ] `src/notebooks/create_feature_branch.py` — Git branch creation with proposed YAML
- [ ] `src/notebooks/freshness_check.py` — stale asset detection
- [ ] `src/notebooks/list_fixtures.py` — list `fixtures/*.yaml`, emit array via `taskValues` for `for_each_task`
- [ ] `src/notebooks/deploy_metric_view.py` — fixture YAML → CREATE VIEW SQL
- [ ] `src/notebooks/post_deploy_validation.py` — end-to-end infra validation
- [ ] `resources/jobs.yml` — all 4 job definitions:
  - `feedback_pipeline`: daily 11 PM (collect → Genie Code → branch)
  - `freshness_resurfacing`: daily 6 AM
  - `metric_view_deploy`: on-demand forEach over fixtures/
  - `post_deploy_validation`: on-demand

**Validation gate:** `databricks bundle validate --strict`; each job visible in workspace after deploy

**Resolved questions:**
1. ~~`for_each_task` syntax~~ — `file_list()` does NOT exist. `inputs` must be a JSON string or dynamic reference. **Action:** Add an upstream `list_fixtures` notebook task that emits the array via `dbutils.jobs.taskValues.set()`.
2. ~~`genie_code_task`~~ — Yes, available as a Beta task type. Verify exact YAML key via `databricks bundle schema`. Fallback: notebook task invoking Genie Code API.
3. ~~Genie Code task output~~ — No structured output. Output is a conversation thread link. **Design change:** Restructure feedback pipeline so Genie Code writes proposed YAML to a Delta table or UC Volume, then a downstream notebook reads it. Alternatively, combine Genie Code call + branch creation into a single notebook task.
4. ~~Git API~~ — Use Databricks Git folders / Repos REST API with a service principal. Direct GitHub API is a fallback only.

---

### Phase 5: Metric View Fixtures
**L300:** 05 | **Effort:** Medium | **Prerequisites:** Phase 2 (CDF tables exist)

**Deliverables:**
- [ ] `fixtures/mv_review_activity.yaml`
- [ ] `fixtures/mv_coverage_metrics.yaml`
- [ ] `fixtures/mv_user_leaderboard.yaml`
- [ ] `fixtures/mv_feedback_pipeline.yaml`

**Validation gate:** Run `metric_view_deploy` job; each metric view queryable via `SELECT MEASURE(...)`

**Resolved question:** ~~CDF table availability timing~~ — Yes, race exists. Synced Delta tables only appear after ≥1 row in source. **Mitigation:** Insert seed rows into Lakebase tables before creating metric views, or accept that metric views fail gracefully on first deploy and succeed after app populates data.

---

### Phase 6: Genie Code Skills
**L300:** 06 | **Effort:** Low | **Prerequisites:** Phase 1

**Deliverables:**
- [ ] `src/prompts/feedback_loop_prompt.md` — versioned skill prompt
- [ ] Skill registered in workspace Genie Code skills library

**Validation gate:** Skill appears in skills library and is invocable

**Resolved question:** ~~Skill registration API~~ — REST API available (`POST /api/2.1/unity-catalog/skills`). Not UI-only. CLI doesn't have a skills command yet.

---

### Phase 7: Unity Gateway Connection
**L300:** 07 | **Effort:** Low | **Prerequisites:** Phase 1

**Deliverables:**
- [ ] Unity Gateway connection `ground-truth-mcp` created with placeholder URL
- [ ] Configured as MCP Service in Unity Gateway UI
- [ ] UC grants set for workspace users

**Note:** Connection URL updated to actual app URL in Bundle 2 post-deploy (L300-13).

**Validation gate:** Connection visible in Unity Gateway; grants confirmed

**Resolved question:** ~~Can connections be DAB-declared?~~ No. No `connection` resource type in DABs as of Oct 2026. Remains manual CLI.

---

### Phase 8: Deploy + Validate
**L300:** 08 | **Effort:** Low | **Prerequisites:** Phases 1–7 complete

**Deliverables:**
- [ ] `databricks bundle validate --strict --target dev` passes
- [ ] `databricks bundle deploy --target dev` succeeds
- [ ] `post_deploy_validation` job run passes all checks:
  - Lakebase accessible
  - Lakebase project, branches, endpoint, and database accessible (app server runs migrations on first startup)
  - UC schema exists
  - SQL Warehouse accessible
  - UC Secrets readable
  - Notification destinations configured
  - Unity Gateway connection registered
  - Metric views queryable
  - All jobs created and schedulable
- [ ] `metric_view_deploy` job run succeeds
- [ ] Commit + push on feature branch

**Validation gate:** All checks green; Bundle 2 and 3 can proceed

---

## Consolidated Open Questions

Carried from all L300 specs. Must resolve before or during the relevant phase.

| # | Question | Phase | Source | Status | Finding |
|---|----------|-------|--------|--------|--------|
| 1 | `for_each_task` with `file_list(fixtures/)` — valid DAB syntax? | 4 | L300-01 | **RESOLVED: No.** | `inputs` must be a JSON string or dynamic reference (`{{tasks.<t>.values.<k>}}` or `{{job.parameters.<k>}}`). No `file_list()` function exists. **Workaround:** Add an upstream notebook task that lists `fixtures/*.yaml` and emits the list via `dbutils.jobs.taskValues.set()`, then reference it in `for_each_task.inputs`. [Docs](https://docs.databricks.com/aws/en/jobs/tasks/for-each) |
| 2 | `genie_code_task` — available as DAB resource type? | 4 | L300-01 | **RESOLVED: Yes (Beta).** | Genie Code is a supported Lakeflow Jobs task type (Beta). Configurable in the Jobs UI as Type → Genie Code. Accepts a natural-language prompt. No confirmed bundle YAML example yet — verify exact key via `databricks bundle schema`. Fallback: notebook task invoking Genie Code API. [Docs](https://docs.databricks.com/aws/en/jobs/tasks/genie-code) |
| 3 | Cross-bundle variable sharing — how do Bundles 2/3 reference infra values? | 4 | L300-01 | **RESOLVED: deploy.sh pattern (lakeLoom).** | No cross-bundle `${resources.*}` substitutions in DABs. **lakeLoom pattern:** Solution-root `deploy.sh` runs `databricks bundle summary --target <t> --output json` on infra bundle, then `resolve_infra_vars()` Python-parses resolved resource values (`catalog` from `resources.schemas`, `warehouse_id` from `resources.sql_warehouses`, `lakebase_project_id` from `resources.postgres_projects`). App/agent bundles declare matching variables with **hardcoded target defaults** for standalone `bundle validate`. At deploy time, `deploy.sh` passes only **runtime-discovered values** (e.g. SPN IDs read from secret scope) as `--var` overrides. Readiness checks verify hardcoded defaults match deployed infra. **Reference:** `lakeLoom/deploy.sh` § `resolve_infra_vars()`, `lakeLoom/lakeloom-ai/databricks.yml` § variable declarations. |
| 4 | ~~Lakebase migration framework~~ | 2 | L300-02 | **Closed.** | App-side TypeScript migrations (lakeLoom pattern). |
| 5 | CDF table naming — always `lb_<table>_history`? Configurable? | 2 | L300-02 | **RESOLVED: Configurable.** | Synced tables (`postgres_synced_tables`) use a configurable destination table name, not the legacy `lb_<table>_history` convention. Name is declared in the synced table resource definition. |
| 6 | UC Secrets from Node.js — SDK direct or SQL `SELECT secret()`? | 3 | L300-03 | **RESOLVED: REST API.** | UC Secrets are accessible via `GET /api/2.1/unity-catalog/secrets/{full_name}?include_value=true` with `READ_SECRET` privilege. The JS SDK exposes a `SecretsClient`. No need for SQL `SELECT secret()`. [API](https://docs.databricks.com/api/uc-secrets/v1/secret) |
| 7 | Genie Code task output — task values, temp file, or Delta table? | 4 | L300-04 | **RESOLVED: No structured output.** | Genie Code task output is a conversation thread link — no built-in mechanism to write task values, files, or tables. **Design implication:** The feedback pipeline should NOT rely on Genie Code task output flowing to downstream tasks. Instead, restructure so the Genie Code task writes proposed YAML to a Delta table or UC Volume, and a downstream notebook task reads from there. Alternatively, combine the Genie Code call + branch creation into a single notebook task using the Genie Code API. [Docs](https://docs.databricks.com/aws/en/jobs/tasks/genie-code) |
| 8 | Git API for branch creation — Repos API or GitHub API? | 4 | L300-04 | **RESOLVED: Repos REST API.** | Databricks recommends Git folders / Repos REST API for branch creation, commit, and push from job notebooks. Use a service principal or bot account for unattended automation. Direct GitHub API calls are a fallback only. [Docs](https://docs.databricks.com/aws/en/repos/ci-cd) |
| 9 | CDF table availability timing — race condition on first deploy? | 5 | L300-05 | **RESOLVED: Yes, race exists.** | Synced/CDF Delta tables only appear in UC after at least one row exists in the source Postgres table. Flush interval is ~15s. **Mitigation:** (a) Insert a seed row into each Lakebase table before creating metric views, or (b) have `post_deploy_validation` wait and retry until synced tables are visible, or (c) accept that metric views fail gracefully on first deploy and succeed after app populates data. [Docs](https://docs.databricks.com/aws/en/oltp/projects/lakebase-cdf) |
| 10 | Genie Code skill registration — programmatic API or UI-only? | 6 | L300-06 | **RESOLVED: REST API.** | Skills are first-class UC/AI Gateway objects. `POST /api/2.1/unity-catalog/skills` to create, `PATCH` to update, `POST .../finalize` to publish. CLI does not have a skills command yet. UI remains the primary authoring surface. [API](https://docs.databricks.com/api/ai-gateway/v1/skill) |
| 11 | ~~Unity Gateway connections as DAB resources?~~ | 7 | L300-07 | **Closed.** | No `connection` resource type in DABs as of Oct 2026. Remains manual CLI. |

---

## File Tree (Target State)

```
ground-truth-infra/
├── databricks.yml
├── PROJECT_MEMORY.md
├── README.md
├── .gitignore
├── docs/
│   └── plan/
│       └── infra_build_plan.md          # (this file)
├── resources/
│   ├── schemas.yml                      # UC schema
│   ├── warehouses.yml                   # SQL Warehouse
│   ├── lakebase.yml                     # Lakebase project, branches, endpoint, role, database, 6 synced tables (CDF)
│   └── jobs.yml                         # All 4 Lakeflow Jobs
├── src/
│   ├── notebooks/
│   │   ├── collect_feedback.py
│   │   ├── create_feature_branch.py
│   │   ├── freshness_check.py
│   │   ├── list_fixtures.py
│   │   ├── deploy_metric_view.py
│   │   └── post_deploy_validation.py
│   └── prompts/
│       └── feedback_loop_prompt.md
└── fixtures/
    ├── mv_review_activity.yaml
    ├── mv_coverage_metrics.yaml
    ├── mv_user_leaderboard.yaml
    └── mv_feedback_pipeline.yaml
```

---

## Effort Estimate

From SOW Option A (L100 pitch/sow_timing_estimates.md):

| Phase | SOW Estimate | Notes |
|-------|-------------|-------|
| Bundle 1 total | 1.5 weeks / 60 hrs | Phases 1–8 combined |
| Phase 1 (config) | 2 hrs | YAML editing |
| Phase 2 (Lakebase) | 8 hrs | DAB-declared Lakebase resources (project, branches, endpoint, synced tables). Migrations moved to Bundle 2 (App). |
| Phase 3 (secrets/wh/notif) | 4 hrs | CLI + UI |
| Phase 4 (jobs) | 20 hrs | 6 notebooks + job YAML + open question resolution |
| Phase 5 (metric views) | 8 hrs | 4 fixture YAMLs + deploy/test |
| Phase 6 (skills) | 2 hrs | Prompt file + registration |
| Phase 7 (gateway) | 2 hrs | CLI + UI |
| Phase 8 (deploy/validate) | 6 hrs | End-to-end validation |

---

## Cross-Bundle Dependencies

What Bundle 2 and Bundle 3 expect from this bundle after deploy:

### Bundle 2 (App) needs:
- UC schema exists (`${var.catalog}.${var.schema}`)
- Lakebase project accessible with all tables migrated
- SQL Warehouse ID
- UC Secrets readable
- Notification destinations configured
- Unity Gateway connection registered (URL updated in B2 post-deploy)
- CDF Delta tables flowing for executive dashboard

### Bundle 3 (Agent) needs:
- 4 metric views deployed and queryable
- SQL Warehouse ID (agent compute)
- Lakebase CDF Delta tables populated
- No direct Lakebase access needed (reads via metric views only)
