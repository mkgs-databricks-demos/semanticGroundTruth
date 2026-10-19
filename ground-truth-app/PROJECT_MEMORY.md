# PROJECT_MEMORY — ground-truth-app

> Last updated: 2026-10-19 — Phase B first deploy successful. `dev-semantic-ground-truth` running.

## Bundle Identity

**Bundle name:** `ground-truth-app`
**Bundle root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-app/`
**Solution root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/` (shared with ground-truth-infra, ground-truth-agent)
**Role:** Bundle 2 of 3. Deploys AFTER infra (Bundle 1). Depends on infra for UC schema, Lakebase, SQL warehouse, secrets.

**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)

---

## Targets

| Target | Mode | Status | App Name | Notes |
|--------|------|--------|----------|-------|
| `dev` | development (default) | **Deployed** ✅ | `dev-semantic-ground-truth` | `default: true`. Variables passed from infra via `deploy.sh --var` |
| `prod` | production | Configured | `semantic-ground-truth` | `run_as: matthew.giglia@databricks.com` |
| `local` | localhost proxy | Configured | — | `host: http://127.0.0.1:7073` — for `pnpm run dev`. All vars hardcoded. |

> **Note:** `default` target was renamed to `local` and moved to the bottom of the targets list. The `dev` target is the only true default.

---

## What This Bundle Owns

### DAB Resources

| Resource Type | Key | Description | Status |
|---------------|-----|-------------|--------|
| `apps` | `app` | `dev-semantic-ground-truth` — AppKit app (Node.js + React) | **Deployed** ✅ |
| `mcp_services` | `ground_truth_mcp` | MCP service in Unity Gateway — moved from infra | Pending (connection needed first) |

### App Stack

| Layer | Technology | Version |
|-------|------------|--------|
| Runtime | Node.js (Databricks AppKit) | AppKit v0.84.0 |
| Package manager | pnpm | 11.0.8 |
| Language | TypeScript | 5.9.3 |
| Server framework | Express (via AppKit `server()` plugin) | — |
| Client framework | React | 19.2.4 |
| Client bundler | Vite (rolldown-vite) | 7.1.14 |
| Styling | Tailwind CSS | 4.0.14 |
| Routing | react-router | 7.18.0 |
| UI components | `@databricks/appkit-ui` | 0.84.0 |
| Testing | vitest | 4.1.9 |
| Linting | eslint + prettier | 9.39.1 / 3.6.2 |

### AppKit Plugins

| Plugin | Import | Status | Notes |
|--------|--------|--------|-------|
| `agents` | `@databricks/appkit/beta` | Active (beta) | Planner (markdown) + Helper (TypeScript) agents |
| `analytics` | `@databricks/appkit` | Active | SQL query execution via warehouse |
| `jobs` | `@databricks/appkit` | Active | Trigger job runs from UI |
| `lakebase` | `@databricks/appkit` | Active | Postgres client for app state |
| `server` | `@databricks/appkit` | Active | Express HTTP server |

### Variables

| Variable | Description | Source | Dev Value |
|----------|-------------|--------|-----------|
| `app_display_name` | App platform name (target-specific) | Hardcoded in target | `dev-semantic-ground-truth` |
| `agents_serving_endpoint_name` | LLM endpoint for agents | Hardcoded in target | `databricks-claude-opus-4-8` |
| `agents_mlflow_experiment_experimentId` | MLflow experiment for agent tracing | From infra via deploy.sh | `1698842789305538` |
| `sql_warehouse_id` | SQL Warehouse ID | From infra via deploy.sh | `0ea84986a23a47c3` |
| `job_id` | Job ID for jobs plugin | From infra (`freshness_resurfacing`) | `1103481179431341` |
| `postgres_branch` | Lakebase branch resource name | From infra via deploy.sh | `projects/dev-matthew-giglia-ground-truth/branches/production` |
| `postgres_database` | Lakebase database resource name | From infra via deploy.sh | `projects/.../databases/ground-truth-app` |
| `catalog` | UC catalog name | From infra via deploy.sh | `hls_fde_dev` |
| `schema_name` | UC schema name (includes dev prefix) | From infra via deploy.sh | `dev_matthew_giglia_semantic_ground_truth` |

> **Removed:** `agents_skills_path` — optional resource commented out. Revisit when UC-sourced skills needed.

### App Configuration

| File | Purpose |
|------|---------|
| `app.yaml` | App runtime config — command, env vars (valueFrom resource bindings) |
| `appkit.plugins.json` | Plugin manifest — resource bindings, env var mappings, scaffolding rules |
| `.env` | Local dev env vars (gitignored) |
| `.env.example` | Template for `.env` |

---

## File Structure

```
ground-truth-app/
├── databricks.yml              ← Bundle config (app + MCP service resources)
├── app.yaml                    ← App runtime config
├── appkit.plugins.json         ← Plugin manifest
├── package.json                ← pnpm monorepo root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.json / .client / .server / .shared
├── tsdown.server.config.ts
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc.json / .prettierignore
├── .npmrc / .env / .env.example
├── server/
│   ├── server.ts                ← AppKit entry point (plugins + onPluginsReady)
│   ├── example.test.ts
│   ├── routes/
│   │   └── lakebase/
│   │       └── todo-routes.ts  ← Sample Lakebase CRUD (replace with review engine)
│   └── agents/
│       ├── planner/
│       │   └── agent.md        ← Markdown agent (default, orchestrates helper)
│       ├── helper/
│       │   └── agent.ts        ← Code-defined sub-agent (tools: current_time, count_words)
│       └── skills/
│           └── tracer-bullets/
│               ├── SKILL.md
│               └── reference.md
├── client/
│   ├── index.html
│   ├── vite.config.ts / tailwind.config.ts / postcss.config.js
│   ├── components.json
│   ├── public/                 ← Favicons, manifest
│   └── src/
│       ├── App.tsx             ← Router + Layout (Home, Agents, Analytics, Lakebase, Jobs)
│       ├── main.tsx / index.css / ErrorBoundary.tsx
│       ├── lib/utils.ts
│       └── pages/
│           ├── agents/AgentChat.tsx
│           ├── analytics/AnalyticsPage.tsx
│           ├── lakebase/LakebasePage.tsx
│           └── jobs/JobsPage.tsx
└── config/
    ├── queries/
    │   ├── hello_world.sql     ← Sample parameterized query
    │   └── mocked_sales.sql
    └── metric-views/
        └── definitions.json    ← Empty (populate with ground truth metric views)
```

---

## MCP Service (moved from infra)

The `ground_truth_mcp` MCP service was moved from Bundle 1 (infra) to this bundle on the `mg-genie-app-scaffold` branch. Rationale: the MCP service depends on the app's `/mcp` endpoint and the HTTP connection, both only available after the app deploys.

**Resource config:**
- `parent:` `schemas/${var.catalog}.${var.schema_name}`
- `mcp_service_id:` `semantic-ground-truth-mcp`
- `source_connection:` `connections/semantic-ground-truth-mcp` (HTTP, metastore-level flat name)
- `include_tool_selectors:` `review_*`, `campaign_*`, `metric_view_*`
- `grants:` `data-engineers` → `EXECUTE`

**Dependency chain (first deploy):**
1. App deploys → app starts, MCP service **fails** (expected — connection doesn't exist yet)
2. `./deploy.sh --target dev --infra --run-setup` → `post_deploy_setup` job creates HTTP connection with app URL + M2M SPN creds
3. `./deploy.sh --target dev --app` → redeploy app bundle → MCP service **succeeds** (connection now exists)
4. Subsequent deploys: connection already exists, MCP service creates/updates cleanly

> **Critical:** Step 3 is `--app`, NOT `--infra`. The MCP service resource lives in THIS bundle, not infra. The deprecated infra copy was deleted in commit `71b5d14`.

---

## Borrowed Placeholders — ALL RESOLVED

All scaffold-time placeholders replaced with infra-owned values:

| Variable | Was | Now |
|----------|-----|-----|
| `agents_mlflow_experiment_experimentId` | `4038008988926083` (foreign) | `1698842789305538` (infra experiment `app_agents_experiment`) |
| `agents_skills_path` | `/Volumes/hls_fde_dev/dev_matthew_giglia_bcda/landing` | **Removed** (optional resource commented out) |
| `job_id` | `1103481179431341` | Same — infra's `freshness_resurfacing` (correct) |

---

## OpenTelemetry

Declared in `databricks.yml` via `telemetry_export_destinations` (CLI ≥ 0.294.0). Platform auto-creates tables on first deploy. `OTEL_TRACES_SAMPLER=always_on` in `app.yaml` ensures all spans are recorded.

| Signal | Table |
|--------|-------|
| Logs | `semantic_ground_truth_otel_logs` |
| Metrics | `semantic_ground_truth_otel_metrics` |
| Spans | `semantic_ground_truth_otel_spans` |

**Dev:** `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_*`
**Prod:** `prod_ground_truth.semantic_ground_truth.semantic_ground_truth_otel_*`

---

## Post-Deploy Checklist (First Deploy Only)

After a successful first deploy of `dev-semantic-ground-truth`:

1. ✅ Verify app health: `databricks apps get dev-semantic-ground-truth`
2. ⬜ Note auto-provisioned SPN app ID → update `app_role` identity in Lakebase infra resource
3. ⬜ Run post-deploy setup: `./deploy.sh --target dev --infra --run-setup` (creates MCP HTTP connection)
4. ⬜ Redeploy **app** bundle: `./deploy.sh --target dev --app` (registers MCP service — connection now exists)
5. ⬜ Verify MCP service in Unity Gateway

> Step 4 is `--app`, NOT `--infra`. The MCP service resource lives in this bundle.

---

## Remaining Work

### Completed (Phase A + B)

| # | Item | Status |
|---|------|--------|
| 1 | Add dev/prod/local targets | ✅ Done |
| 2 | Enable `user_api_scopes` (sql, genie, files, model-serving) | ✅ Done |
| 3 | Replace placeholder MLflow experiment | ✅ Done (`1698842789305538`) |
| 4 | Comment out `agents-skills` optional resource | ✅ Done |
| 5 | `pnpm install` | ✅ Platform handles on deploy |
| 6 | First deploy via `./deploy.sh --target dev --app` | ✅ Done (2026-10-19) |
| 10 | Delete infra deprecated MCP file | ✅ Done (commit `71b5d14`) |

### Remaining (Post-Deploy + Phase C+)

| # | Item | Blocked on |
|---|------|------------|
| 2p | Note SPN app ID, update `app_role` | First deploy done — ready |
| 3p | Run `post_deploy_setup` (MCP connection) | Nothing |
| 4p | Redeploy app (MCP service registration) | Step 3p |
| 7 | Lakebase migrations (TypeScript, run on startup) | App code authoring |
| 8 | Replace sample todo routes with Review Engine | App code authoring |
| 9 | Replace sample agents with Ground Truth agents | App code authoring |
| 11 | Update infra `app_role` to SERVICE_PRINCIPAL | Step 2p |

---

## Critical Deploy Findings

1. **MCP service lives in app bundle, NOT infra.** The deprecated infra copy was deleted. Post-deploy MCP setup creates the connection, then app redeploy registers the service.
2. **App in fatal ERROR state cannot be updated — must delete and recreate.** Platform returns "Cannot update app ... fatal error. Please delete the app and re-create it."
3. **Bundle state tracks app by ID.** Renaming an app (e.g. `ground-truth-app` → `dev-semantic-ground-truth`) requires deleting the workspace state file (`~/.bundle/<bundle>/dev/state/resources.json`) AND the old app, then fresh deploy. Otherwise bundle tries CREATE and hits ALREADY_EXISTS.
4. **CLI version mismatch warning is non-fatal.** `State was last deployed with CLI version 1.21.0 but current version is 1.20.0` — safe to ignore.
5. **`app_db` parent = `production` branch.** Use `postgres_branches.production.id` for `LAKEBASE_BRANCH`, NOT `development`.
6. **`deploy_bundle()` must pass `extra_args` to both validate AND deploy.** Fixed in deploy.sh.
7. **OTel prefix: `semantic_ground_truth_`** (not `ground_truth_app_`). Matches app display name pattern.
8. **`OTEL_TRACES_SAMPLER=always_on` required in `app.yaml`.** Without it, default parent-based sampler drops most spans.

---

## Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-10-14 | Scaffolded | AppKit init (Node.js + React). MCP service moved from infra. `app_bundle_support_plan.md` written. |
| 2026-10-19 | Phase A complete | Dev/prod/local targets, OBO scopes, OTel, agents-skills commented out, deprecated infra MCP deleted. |
| 2026-10-19 | **Phase B — first deploy** ✅ | `dev-semantic-ground-truth` running. All AppKit plugins operational (agents, analytics, jobs, lakebase, server). MCP service pending (expected). 12 commits ahead of main on `mg-genie-app-scaffold`. |

---

## Conventions

- **Git workflow:** Feature branches only. Naming: `mg-genie-<short-description>`.
- **Session summaries:** In `ground-truth-infra/docs/sessions/` (shared location for all bundles until app has its own).
- **Schema references:** Use `${var.catalog}.${var.schema_name}` (not `${resources.schemas...}` — schema resource is in infra).
- **Cross-bundle variables:** Resolved by `deploy.sh` `resolve_infra_vars()` and passed via `--var` flags.
- **Lakebase migrations:** TypeScript, in `server/migrations/`, run on app startup via AppKit Lakebase client. Tracked in `app._migrations` table.
- **App naming:** `${var.app_display_name}` — target-specific for dev/prod coexistence in the same workspace.
