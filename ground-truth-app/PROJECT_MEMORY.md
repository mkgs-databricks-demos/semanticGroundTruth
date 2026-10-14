# PROJECT_MEMORY — ground-truth-app

> Last updated: 2026-10-14 — App bundle scaffolded via `databricks apps init --skip-install`. MCP service moved from infra.

## Bundle Identity

**Bundle name:** `ground-truth-app`
**Bundle root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-app/`
**Solution root:** `/Users/matthew.giglia@databricks.com/semanticGroundTruth/` (shared with ground-truth-infra, ground-truth-agent)
**Role:** Bundle 2 of 3. Deploys AFTER infra (Bundle 1). Depends on infra for UC schema, Lakebase, SQL warehouse, secrets.

**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)

---

## Targets

| Target | Mode | Status | Notes |
|--------|------|--------|-------|
| `default` | local dev | Scaffolded | `host: http://127.0.0.1:7073` — for `pnpm run dev` |
| `dev` | development | **TODO** | Needs proper target matching infra pattern |
| `prod` | production | **TODO** | Needs proper target matching infra pattern |

> **Action needed:** Replace `default` (localhost) target with proper `dev`/`prod` targets. Variables will be passed from infra via `deploy.sh --var` at deploy time.

---

## What This Bundle Owns

### DAB Resources

| Resource Type | Key | Description | Status |
|---------------|-----|-------------|--------|
| `apps` | `app` | `ground-truth-app` — AppKit app (Node.js + React) | Scaffolded |
| `mcp_services` | `ground_truth_mcp` | MCP service in Unity Gateway — moved from infra | Scaffolded |

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

| Variable | Description | Source |
|----------|-------------|--------|
| `agents_serving_endpoint_name` | LLM endpoint for agents | Hardcoded in target |
| `agents_mlflow_experiment_experimentId` | MLflow experiment for agent tracing | **TODO:** From infra (currently placeholder) |
| `agents_skills_path` | UC volume for agent skills | **TODO:** Defer or remove (optional) |
| `sql_warehouse_id` | SQL Warehouse ID | From infra via deploy.sh |
| `job_id` | Job ID for jobs plugin | From infra (`freshness_resurfacing`) |
| `postgres_branch` | Lakebase branch resource name | From infra via deploy.sh |
| `postgres_database` | Lakebase database resource name | From infra via deploy.sh |
| `catalog` | UC catalog name | From infra via deploy.sh |
| `schema_name` | Fully qualified UC schema name (includes dev prefix) | From infra via deploy.sh |

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

**Dependency chain:** deploy.sh creates HTTP connection → app deploys (starts `/mcp` server) → deploy.sh updates connection with real app URL → MCP service resource registers in Unity Gateway.

---

## Borrowed Placeholder Resources (to replace)

These values were used during `databricks apps init` to satisfy required resource bindings. They point at foreign projects and must be replaced:

| Variable | Current value | Correct source |
|----------|---------------|----------------|
| `agents_mlflow_experiment_experimentId` | `4038008988926083` | New infra experiment (TBD) |
| `agents_skills_path` | `/Volumes/hls_fde_dev/dev_matthew_giglia_bcda/landing` | Defer: comment out optional resource |
| `job_id` | `1103481179431341` | Infra's `freshness_resurfacing` (correct — pass via deploy.sh) |

See `ground-truth-infra/docs/plans/app_bundle_support_plan.md` for the full plan.

---

## Remaining Work

| # | Item | Blocked on |
|---|------|------------|
| 1 | Add dev/prod targets | Infra deploy.sh Phase 2 |
| 2 | Enable `user_api_scopes` (sql, genie, files, model-serving) | Nothing |
| 3 | Replace placeholder MLflow experiment | Infra resource |
| 4 | Comment out `agents-skills` optional resource | Nothing |
| 5 | `pnpm install` | Nothing |
| 6 | First deploy via `./deploy.sh --target dev --app` | Items 1–4 + infra changes |
| 7 | Lakebase migrations (TypeScript, run on startup) | App code authoring |
| 8 | Replace sample todo routes with Review Engine | App code authoring |
| 9 | Replace sample agents with Ground Truth agents | App code authoring |
| 10 | Delete infra deprecated MCP file | Successful app deploy |
| 11 | Update infra `app_role` to SERVICE_PRINCIPAL | App auto-provisioned SPN |

---

## Conventions

- **Git workflow:** Feature branches only. Naming: `mg-genie-<short-description>`.
- **Session summaries:** In `ground-truth-infra/docs/sessions/` (shared location for all bundles until app has its own).
- **Schema references:** Use `${var.catalog}.${var.schema_name}` (not `${resources.schemas...}` — schema resource is in infra).
- **Cross-bundle variables:** Resolved by `deploy.sh` `resolve_infra_vars()` and passed via `--var` flags.
- **Lakebase migrations:** TypeScript, in `server/migrations/`, run on app startup via AppKit Lakebase client. Tracked in `app._migrations` table.
