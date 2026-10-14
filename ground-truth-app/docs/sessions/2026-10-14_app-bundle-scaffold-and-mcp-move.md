# 2026-10-14 — App bundle scaffold + MCP service move + infra support plan

**Branch:** `mg-genie-app-scaffold`
**Created from:** `main` (after `mg-genie-m2m-spn` merge)

## Summary

Scaffolded the app bundle via `databricks apps init --skip-install`, reviewed the generated code, received the MCP service resource from infra, and established project memory. An infra support plan was written for remaining cross-bundle work.

## Scaffold details

`databricks apps init --skip-install` generated 52 files. Key choices during init:

| Prompt | Selection |
|--------|-----------|
| Framework | Node.js (AppKit v0.84.0) |
| Package manager | pnpm 11.0.8 |
| Plugins | agents (beta), analytics, jobs, lakebase, server |

Resulting stack: TypeScript 5.9, React 19, Vite (rolldown-vite 7.1.14), Tailwind 4, react-router 7, vitest, eslint, prettier.

### Generated structure

| Directory | Contents |
|-----------|----------|
| `server/` | `server.ts` (AppKit entry), `routes/lakebase/todo-routes.ts` (sample CRUD), `agents/` (planner + helper) |
| `client/` | React app — pages: Home, Agents, Analytics, Lakebase, Jobs. `@databricks/appkit-ui` components. |
| `config/` | `queries/` (hello_world.sql, mocked_sales.sql), `metric-views/definitions.json` (empty) |

### Agents scaffold

The agents plugin generated a two-agent composition:
- **planner** (`server/agents/planner/agent.md`) — markdown agent, default, orchestrates helper. Includes `tracer-bullets` skill.
- **helper** (`server/agents/helper/agent.ts`) — TypeScript sub-agent with sample tools (`current_time`, `count_words`).

## Borrowed placeholder resources

During `apps init`, existing workspace resources were used to satisfy required bindings:

| Variable | Placeholder | Correct source | Action |
|----------|-------------|----------------|--------|
| `agents_mlflow_experiment_experimentId` | `4038008988926083` | New infra experiment | Replace after infra declares it |
| `agents_skills_path` | `/Volumes/hls_fde_dev/dev_matthew_giglia_bcda/landing` | Optional — defer | Comment out resource |
| `job_id` | `1103481179431341` | Infra `freshness_resurfacing` | Correct — pass via deploy.sh |
| `sql_warehouse_id` | `0ea84986a23a47c3` | Infra warehouse | Correct — pass via deploy.sh |
| `postgres_branch` | `projects/.../branches/development` | Infra development branch | Correct |
| `postgres_database` | `projects/.../databases/ground-truth-app` | Infra `app_db` | Correct |

## MCP service move (infra → app)

The `ground_truth_mcp` MCP service was moved from Bundle 1 (infra) to this bundle:

| Change | File |
|--------|------|
| Added `engine: direct` | `databricks.yml` |
| Added `catalog` + `schema_name` variables | `databricks.yml` |
| Added `mcp_services.ground_truth_mcp` resource | `databricks.yml` |
| Deprecated original (fully commented out) | `ground-truth-infra/resources/mcp/ground_truth_mcp.mcp_service.yml` |

Key difference from infra version: uses `${var.catalog}.${var.schema_name}` instead of `${resources.schemas.ground_truth_schema.name}` since the schema resource lives in infra.

## Infra support plan

Written to `ground-truth-infra/docs/plans/app_bundle_support_plan.md`. Covers:

1. **New infra resources:** MLflow experiment for agent tracing
2. **deploy.sh Phase 2:** Variable passing (`MLFLOW_EXPERIMENT_ID`, `FRESHNESS_JOB_ID`, `LAKEBASE_BRANCH`, `LAKEBASE_DATABASE`), app URL resolution, MCP connection update
3. **Cleanup:** Delete deprecated infra MCP file, update `app_role` to SERVICE_PRINCIPAL

## Decisions

| Decision | Rationale |
|----------|-----------|
| MCP service belongs in app bundle | Depends on app's `/mcp` endpoint; can't deploy until app exists |
| Agent skills volume deferred | Optional resource; local `server/agents/skills/` suffices |
| `freshness_resurfacing` is the right job | Resurfaces stale confidence scores — matches review UI intent |
| Serving endpoint stays in app target | Workspace concern, not bundle-managed |
| `schema_name` var (not `schema`) | Distinguishes from infra's `schema` var; holds full UC name with dev prefix |

## Files created / modified

| File | Change |
|------|--------|
| `ground-truth-app/*` (52 files) | Scaffold via `databricks apps init --skip-install` |
| `ground-truth-app/databricks.yml` | Added `engine: direct`, `catalog`/`schema_name` vars, MCP service |
| `ground-truth-app/PROJECT_MEMORY.md` | New — app bundle project memory |
| `ground-truth-app/docs/sessions/INDEX.md` | New — session index |
| `ground-truth-app/docs/sessions/2026-10-14_*.md` | New — this session |
| `ground-truth-infra/resources/mcp/ground_truth_mcp.mcp_service.yml` | Deprecated (commented out) |
| `ground-truth-infra/docs/plans/app_bundle_support_plan.md` | New — infra changes plan |
| `ground-truth-infra/docs/sessions/INDEX.md` | Updated with this session |
| `ground-truth-infra/docs/sessions/2026-10-14_*.md` | New — same session (infra perspective) |

## Next steps

1. Declare MLflow experiment resource in infra
2. Implement deploy.sh Phase 2 (variable passing + app deploy)
3. Add dev/prod targets to app `databricks.yml` (replace localhost `default`)
4. Enable `user_api_scopes` (sql, genie, files, model-serving)
5. Comment out `agents-skills` optional resource
6. `pnpm install`
7. First deploy: `./deploy.sh --target dev --app`
