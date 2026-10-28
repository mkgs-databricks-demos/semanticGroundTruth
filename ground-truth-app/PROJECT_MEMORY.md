# PROJECT_MEMORY — ground-truth-app

> Last updated: 2026-10-23 — MCP auth **fully resolved**. All SPN grants applied. Connection PATCHed with `all-apis` scope. Unity Gateway delivers to app (404 expected — Phase H not built).

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
| `mcp_services` | `ground_truth_mcp` | MCP service in Unity Gateway — moved from infra | Deployed ✅ (auth blocked — see Next Steps) |
| `jobs` | `app_post_deploy_setup` | Grants CAN_USE on app + UC grants for M2M SPN | Deployed ✅ |
| `jobs` | `create_mcp_connection` | Creates/PATCHes schema-level HTTP connection | Deployed ✅ |
| `job_runs` | `run_app_post_deploy` | Deploy hook: auto-triggers `app_post_deploy_setup` | Deployed ✅ |
| `jobs` | `deploy_verification` | Post-deploy checks (health, `/api/me` admin, campaigns, MCP, scope ACL) | Deployed ✅ |
| `jobs` | `demo_campaign_seed` | Optional demo data | Deployed ✅ |
| `jobs` | `api_contract_tests` | Live contract tests for every route/tool in `tests/contract/manifest.json`; rows to `<catalog>.<schema>.api_contract_results`. Dev job `443124502254957` (`[dev matthew_giglia] dev-semantic-ground-truth-api-contract-tests`); run of record `687515436484443` = 147 pass / 0 fail / 176 `skipped_live` / 100% coverage (build 4, session 40). Runbook `../docs/runbooks/contract_tests.md` | Deployed ✅ |
| `jobs` | `sync_agent_skills` | Mirrors `agent_skills/` into the infra `agent_skills` volume; restarts the app (stop/start) only when something changed | Deployed ✅ (2026-10-26) |
| `job_runs` | `run_sync_agent_skills` | Deploy hook, `on_file_change: ../../agent_skills/*/*` | Deployed ✅ (2026-10-26) |

**App resources in `resources/app.app.yml` (2026-10-26):** `agents-skills` (`READ_VOLUME` on `${var.agents_skills_path}`), and `otel-logs` / `otel-spans` / `otel-metrics` (`uc_securable` `TABLE`, `MODIFY` on `semantic_ground_truth_otel_{logs,spans,metrics}`). The OTel table resources make Databricks grant the app SPN `USE CATALOG` / `USE SCHEMA`; that needs the deployer to have `MANAGE` on the catalog, and removing them revokes the grants. Telemetry no longer depends on the `account users` catalog grant (removed 2026-10-24 03:37Z). **Deploy `ground-truth-infra` first** (it creates the volume). See `../docs/runbooks/deploy_order_and_permissions.md`.

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
| Routing | react-router | 7.18.4 (build 4 audit) |
| MCP App | `@modelcontextprotocol/ext-apps` | 1.7.5 |
| UI test tooling | `@testing-library/react` / `user-event` / `jest-dom`, `jsdom`, `vitest-axe` | 16.3.3 / 14.6.8 / 7.0.1, 30.1.3, 0.1.0 |
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
| `exec_dashboard_url` | Executive AI/BI dashboard published URL → `GT_EXEC_DASHBOARD_URL` (via `resources/app.app.yml` `config.env`) | deploy.sh builds it from the infra `executive` dashboard ID | Dev target value is the real published URL `https://fevm-hls-fde.cloud.databricks.com/dashboardsv3/01f1cf0b38d31b7cbac5bdac6cafe3eb/published` (`resources.dashboards.executive`); deploy.sh rebuilds the same URL. Update it if the dashboard is recreated. Global default `""` |
| `agents_skills_path` | Agent skills UC volume (`catalog.schema.volume`) | Default `${var.catalog}.${var.schema_name}.agent_skills` (infra volume) | `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.agent_skills` |

> **Agent skills (2026-10-26):** sources are `agent_skills/<skill>/SKILL.md` (`review-guide`, `scoring-model`, `tracer-bullets`; moved from `server/agents/skills/`). AppKit reads `DATABRICKS_VOLUME_AGENT_SKILLS` at boot; it is set in `app.app.yml` `config.env` (no `app.yaml` env reaches the app: the bundle `config` block replaces it). Do not edit the volume by hand.

### App Configuration

| File | Purpose |
|------|---------|
| `app.yaml` | Comment stub only. App runtime command + env (incl. `value_from` resource bindings) live in `resources/app.app.yml` `config` |
| `appkit.plugins.json` | Plugin manifest — resource bindings, env var mappings, scaffolding rules |
| `.env` | Local dev env vars (gitignored) |
| `.env.example` | Template for `.env` |

---

## File Structure

Current layout (2026-10-26; the original AppKit scaffold tree is in git history). `README.md` §Project Structure has the full tree.

```
ground-truth-app/
├── databricks.yml / app.yaml / appkit.plugins.json / package.json / pnpm-lock.yaml / vitest.config.ts
├── resources/                  ← app.app.yml, ground_truth_mcp.mcp_service.yml, jobs/ (8 job + job_run files)
├── agent_skills/               ← review-guide, scoring-model, tracer-bullets (synced to the UC volume)
├── shared/contracts/           ← values.ts, schemas.ts (ROUTE_CONTRACTS 50, MCP_TOOL_CONTRACTS 13), api.ts, generated/contracts.schema.json
├── server/
│   ├── server.ts               ← AppKit entry point
│   ├── routes/                 ← admin, assets, campaigns, config, health, leaderboard, me, metricViews, notifications, review, steward
│   ├── services/               ← asset, campaign, membership, metricView, notification, review, settings, sources, steward
│   ├── mcp/                    ← server.ts, tools/{define,review,campaign,metricView}.ts, views/ (markdown fallback + MCP App card)
│   ├── migrations/             ← 001..009 (009_skips_settings_triage)
│   └── lib/, middleware/, seed/, agents/
├── client/src/                 ← App.tsx, components/{admin,executive,layout,leaderboard,review,steward}, theme/, test/
├── tests/contract/             ← in-process contract suite + manifest.json (generator output)
└── src/notebooks/              ← api_contract_tests, create_mcp_connection, demo_campaign_seed, deploy_verification, download_brand_assets, grant_app_permissions, sync_agent_skills
```

**Build 4 data model (migration 009, applied 2026-10-26 03:55 UTC):** `app.review_skips` (a skip is not a vote; `votes.vote_type` stays `approve|reject|edit`; cooldown `skip_cooldown_hours`, default 24, 0-720; resurfaces the oldest-skipped asset when everything is in cooldown) and `app.user_settings` (theme, density, motion, cards per session 5-100, ...); steward triage columns on `feedback_batches` (`files`, `summary`, `reviewed_by`, `reviewed_at`) and on `votes` (`resolution`, `resolved_by`, `resolved_at`). `user_activity.total_skips` / `last_skip_at`. Both new tables have `REPLICA IDENTITY FULL` and reach bronze via `lb_review_skips_history` / `lb_user_settings_history`.

**API surface (build 4):** 50 routes in `ROUTE_CONTRACTS` (`GET /health` + 49 under `/api`), new: `POST /api/review/skip`, `GET/PUT /api/me/settings`, `GET /api/steward/feedback-queue`, `GET /api/steward/conflicts`, `POST /api/steward/conflicts/:assetId/resolve`, `GET|POST /api/steward/feedback-branches`, `POST /api/steward/feedback-branches/:batchId/status`. Every route validates with `validate(spec)` (`server/lib/validate.ts`). `UpsertFeedbackBranchRequest.batchId` is an `app.feedback_batches` id; optional `voteIds` are marked `is_processed` (commit `e7c8736`). `GET /health` returns `{status, db, migrations, version}`; `removeEarlierHealthRoutes` drops AppKit's own `/health` first (session 40).

**MCP (build 4):** 13 tools via `registerContractTool` (input = contract zod; output checked before it is returned). New `review_skip_card`. `structuredContent` is always an object (`{ items: [...] }` for lists). MCP App review card: resource `ui://ground-truth/review-card`, MIME `text/html;profile=mcp-app`, `@modelcontextprotocol/ext-apps` `1.7.5`, on `review_get_next`, `review_submit_vote`, `review_skip_card`, `review_get_stats`; text fallback for every host. Design `../docs/design/L300-17_mcp_app_review_card.md`.

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

Declared in `databricks.yml` via `telemetry_export_destinations` (CLI ≥ 0.294.0). Platform auto-creates tables on first deploy. `OTEL_TRACES_SAMPLER=always_on` in `resources/app.app.yml` `config.env` ensures all spans are recorded.

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
2. ✅ ~~`app_role` update~~ **NOT NEEDED** — AppKit `CAN_CONNECT_AND_CREATE` auto-provisions Lakebase role for app SPN. M2M SPN only for MCP token exchange.
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
| 4 | Comment out `agents-skills` optional resource | ✅ Done; re-enabled 2026-10-26 with the infra `agent_skills` volume |
| 5 | `pnpm install` | ✅ Platform handles on deploy |
| 6 | First deploy via `./deploy.sh --target dev --app` | ✅ Done (2026-10-19) |
| 10 | Delete infra deprecated MCP file | ✅ Done (commit `71b5d14`) |

### Remaining (Post-Deploy + Phase C+)

#### RESOLVED 2026-10-20: Unblock MCP Authentication (kept for history)

The MCP service deploys and all grants are correct, but the app sidecar rejects M2M tokens because
the SPN OAuth secret was scoped to `apps ai-gateway`. The sidecar requires `all-apis` scope.
OAuth secret scopes are immutable — must generate a new secret.

| Step | Action | How |
|------|--------|----- |
| **MCP-1** | Regenerate `semantic-ground-truth-m2m-dev` secret with `all-apis` scope | Settings → Identity and access → Service principals → `semantic-ground-truth-m2m-dev` → Secrets tab → Generate secret → select "all APIs" |
| **MCP-2** | Update secret in scope | `databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_dev --string-value "<new_secret>"` |
| **MCP-3** | Re-PATCH HTTP connection with new credentials | `bundle run create_mcp_connection --target dev --params connection_name=semantic-ground-truth-mcp,catalog=hls_fde_dev,schema_name=dev_matthew_giglia_semantic_ground_truth,app_url=https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com,scope_name=semantic_ground_truth_credentials,client_id_key=m2m_client_id_dev,client_secret_key=m2m_client_secret_dev,oauth_scopes=all-apis,token_endpoint=https://fevm-hls-fde.cloud.databricks.com/oidc/v1/token` |
| **MCP-4** | Also update `oauth_scopes` default in job YAML | Change `apps` → `all-apis` in `resources/jobs/create_mcp_connection.job.yml` and notebook widget default |
| **MCP-5** | ~~Verify MCP service Overview tab~~ | ✅ Verified — 302 gone, Unity Gateway returns 404 `/mcp` (expected) |
| **MCP-6** | Revoke old `apps ai-gateway` secret | Settings → same SPN → Secrets tab → revoke old entry (non-urgent) |

> **Deploy hook wiring gap:** `app_post_deploy_setup` (SPN grants) is fully automated via `run_app_post_deploy` hook. The `create_mcp_connection` job (connection PATCH) is **not** wired — still a manual `bundle run`. Future improvement: add `app_url` as a per-target variable (URL is stable: `https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com`) and create a second `job_run` hook.

#### App Code Phases (ordered by dependency)

| # | Phase | Item | Blocked on |
|---|-------|------|-----------|
| 7 | C | Lakebase migrations (`server/migrations/` framework + 5 files) | Nothing |
| 8 | D | Auth + Middleware (OBO identity extraction, OTel, error handler) | Nothing |
| 9 | E | Review Engine Service | C, D |
| 10 | F | Campaign Manager Service | C, D |
| 11 | G | REST API Routes | D, E, F |
| 12 | H | **MCP Server (`/mcp` endpoint)** | E, G — also unblocks MCP auth testing |
| 13 | I | React Frontend | G |
| 14 | J | Agents | E, G |

#### Remaining Post-Deploy Manual Steps

| # | Item | Blocked on |
|---|------|------------|
| ~~2p~~ | ~~Note SPN app ID, update `app_role`~~ | ✅ NOT NEEDED — AppKit auto-provisions |
| ~~15~~ | ~~UC Secrets: `slack_webhook_url`, `teams_webhook_url`, `git_token`~~ | Dropped: secret YAMLs deleted (G10, build 4); Slack via `system.ai.slack` is a later build (G5) |
| ~~16~~ | ~~Lakebase Lakehouse Sync~~ | ✅ Done by infra `setup_lakebase_cdf` |
| ~~17~~ | ~~Genie Code skill registration~~ | ✅ Feedback skill `ground-truth-feedback-author` `1.0.0` lives in infra fixtures; agent skills come from the UC volume |

> Phases C-J above are all built (builds 1-4). Open items after build 4: build 5 UI (Settings, steward Feedback queue / Conflicts / Feedback branches screens from the Figma Make brief), MCP App render check in Genie One / Genie Code, `@mlflow/core` if MLflow agent traces are wanted (runtime logs `MLflow agent tracing requires the optional @mlflow/core package`). App follow-ups (steward re-notify on re-register, edit votes with no proposed value, unattended deploy "Invalid delegation claim"): `../docs/requests/2026-10-27_build-4-follow-ups.md`. `api_contract_tests` has `max_retries: 0` since 2026-10-27.

---

## Critical Deploy Findings

1. **MCP service lives in app bundle, NOT infra.** The deprecated infra copy was deleted. Post-deploy MCP setup creates the connection, then app redeploy registers the service.
2. **App in fatal ERROR state cannot be updated — must delete and recreate.** Platform returns "Cannot update app ... fatal error. Please delete the app and re-create it."
3. **Bundle state tracks app by ID.** Renaming an app (e.g. `ground-truth-app` → `dev-semantic-ground-truth`) requires deleting the workspace state file (`~/.bundle/<bundle>/dev/state/resources.json`) AND the old app, then fresh deploy. Otherwise bundle tries CREATE and hits ALREADY_EXISTS.
4. **CLI version mismatch warning is non-fatal.** `State was last deployed with CLI version 1.21.0 but current version is 1.20.0` — safe to ignore.
5. **`app_db` parent = `production` branch.** Use `postgres_branches.production.id` for `LAKEBASE_BRANCH`, NOT `development`.
6. **`deploy_bundle()` must pass `extra_args` to both validate AND deploy.** Fixed in deploy.sh.
7. **OTel prefix: `semantic_ground_truth_`** (not `ground_truth_app_`). Matches app display name pattern.
8. **`OTEL_TRACES_SAMPLER=always_on` required in `resources/app.app.yml` `config.env`.** Without it, default parent-based sampler drops most spans.
9. **All runtime env lives in `resources/app.app.yml` `config` (single source); `app.yaml` is a comment stub.** The bundle `config` block REPLACES `app.yaml` command + env entirely (not a per-variable merge). Until 2026-10-28 the env was duplicated in `app.yaml`, the `value_from` bindings never reached the app, and it only started because a gitignored local `.env` was uploaded with the source; a clean worktree deploy failed with `Warehouse ID not found`. Use `value_from` for resource bindings and `${var.*}` for bundle variables there.
10. **The Apps build runs vitest (`prebuild`).** vitest's default include also matches `.test.ts` files inside the container's Python `.venv/` (gradio), so `vitest.config.ts` must exclude `**/.venv/**`.
11. **Secret scope READ for the app SPN is owned by the infra bundle.** The infra scope `permissions` block is authoritative and removes the READ that the app's `m2m-client-id` secret resource grants. The app bundle state still reports "unchanged". `grant_app_permissions` re-grants READ after every app deploy.
12. **Unattended `bundle deploy` fails at `apps update` (`400 Invalid delegation claim present in Ctx`).** A scheduled Genie Code task has no user delegation claim, and the plan always contains a no-op `config.env` update (values are redacted by the API). Deploy code with `bundle run app --target dev`; apply config changes with an interactive `bundle deploy`.
13. **Never redeploy with a plain `apps deploy` (API/UI).** Without the bundle env vars it builds with `NODE_ENV=production`, the `prebuild` client test fails (`React.act` is not a function) and the app goes `UNAVAILABLE`. Use `bundle run app` or stop/start.
14. **AppKit's `server()` registers its own `GET /health`** before `extend()` callbacks; `server/routes/health.ts` `removeEarlierHealthRoutes` drops it so the contract route answers (session 40).
15. **`vitest.config.ts` `silent: 'passed-only'`.** Passing error-path tests log `"level":"error"`; in the Apps BUILD logs those lines tripped the build-waves error gate (session 36).

---

## Status Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-10-14 | Scaffolded | AppKit init (Node.js + React). MCP service moved from infra. `app_bundle_support_plan.md` written. |
| 2026-10-19 | Phase A complete | Dev/prod/local targets, OBO scopes, OTel, agents-skills commented out, deprecated infra MCP deleted. |
| 2026-10-19 | **Phase B — first deploy** ✅ | `dev-semantic-ground-truth` running. All AppKit plugins operational (agents, analytics, jobs, lakebase, server). MCP service pending (expected). 12 commits ahead of main on `mg-genie-app-scaffold`. |
| 2026-10-20 | **Resource refactor + MCP auth fully resolved** | Extracted resources to `resources/`. Fixed SPN grant bugs. All grants applied. Root cause: SPN secret scoped to `apps ai-gateway` — sidecar needs `all-apis`. New secret generated, connection PATCHed, 404 on `/mcp` confirmed (auth works, Phase H not built). Branch: `mg-genie-app-resource-refactor`. |
| 2026-10-23 | **Root build waves 0–2 complete** | Migration 007 (app groups, asset sources, REPLICA IDENTITY FULL). RBAC from Lakebase app groups (MembershipService). Asset import (catalog browse, Git folder sources, glossary parser). Client wizard + members page. Demo seed job (10 votes, 71 assets). Deploy verification job (6 M2M checks). App converge: 7 deploys, final stable with all probes passing. Migration 008 (votes version_hash) added during converge. Branch `mg-genie-agent-build`. |
| 2026-10-24 | **Brand + gaps build (run `745271774924215`)** ✅ | Branch `mg-genie-ui-brand-and-gaps`. Session 16: Databricks brand tokens (`client/src/theme/tokens.ts` + `index.css` `:root`/`.dark`), `ThemeProvider` (class, system default, `sgt-theme`) + `MotionConfig reducedMotion="user"`, self-hosted DM Sans/DM Mono, title/manifest, header symbol + 3-state toggle, `contrast.test.ts`; D1 = Lava 700 primary. Session 17: 0 hard-coded palette classes, vote tokens/icons/shortcuts (←/→/↑/S) + live region, `LogicView`, `DashboardLink` from `/api/config`, `a11y-static.test.ts`. Session 19: MCP card light/dark CSS variables + test. Session 20: `GET /api/config`, `exec_dashboard_url` var, `grant_app_permissions` re-grants scope READ, `deploy_verification` checks ACL + `/api/config`, `prebuild` runs vitest. Session 23 (converge, 3 attempts): vitest `.venv` exclude, glossaryParser subdomain flush, `'skip'` in `VOTE_TYPES`, optional `Asset.synonyms`, strict `useRef`; stable deployment `01f1cf13577d1d66a5fb26679855e41d`, 21 vitest files + `tsc -b` green, all 6 probes pass, `deploy_verification` run `4617382917183` pass. `6771630`: dashboard URL moved from hard-coded `app.yaml` to deploy.sh → `--var` → `config.env`. Post-build: real brandfolder symbol SVGs + favicons via `src/notebooks/download_brand_assets` (`05e8c1a`, `d3aefe3`); dev `exec_dashboard_url` default because the Apps API rejects an empty `config.env` value (`bd45836`); redeployed `01f1cf6c934d17048daca183beca9788`. Open: re-check `/api/config` via `deploy.sh --app`; `EmptyState.tsx` still uses a lucide icon (plan §5 wants Databricks primary icons); Lakebase `votes.vote_type` CHECK lacks `skip`; manual Lighthouse/keyboard/toggle checks. Runbook: `../docs/runbooks/ui_theming.md`. |
| 2026-10-26 | **Build 4 (runs `110489694161084` + `655172288447819`)** | Branch `mg-genie-build-4`. Session 25: contracts + migration 009 (skips not votes, user settings, steward triage). 26: Node toolchain proven in a build task, `@modelcontextprotocol/ext-apps` 1.7.5 + Testing Library/jsdom/vitest-axe, audit high+critical 18 -> 13, vitest `node` + `client` projects. 33: skip endpoint, settings, steward APIs, `validate(spec)` on every route. 34: `review_skip_card`, 13 contract-validated tools, MCP App review card. 35: in-process contract suite + live `api_contract_tests`. Owner (2026-10-26): `agent_skills/` + `sync_agent_skills`, OTel `TABLE` resources. 36 (converge): `{ items }` structuredContent, `forbidden()` in `requireObo`, deployment `01f1d13e...` stable, 927 tests. `e7c8736`: `voteIds` marked processed. 40 (converge): 404 checks in real services, `/health` route fix, `displayName` default, deployment `01f1d180ccfa147db429fdda372aea06`; contract run `687515436484443` 147 pass / 0 fail / 100%; vitest 932, both `tsc -b` exit 0. |
| 2026-10-27 | **Build 4 closed (owner, interactive)** | Interactive `bundle deploy` (incl. app update, no delegation error) -> deployment `01f1d178b131` with `e7c8736`; probes 8/8. Votes `644eff17`/`4f81557c` marked processed by re-registering `mg-genie-feedback-20261026` via `POST /api/steward/feedback-branches` with `voteIds` (no `batchId` -> upsert by branch name, same row `21bb95ea`; it re-sent `feedback.branch_ready`, follow-up 5). `api_contract_tests` task `max_retries: 0`; deployment `01f1d1bf1da21e6d9178db9ae66ac99e`, probes 8/8. Session: `../docs/sessions/2026-10-27_build-4-unblock-and-close.md`. |
| 2026-10-28 | **Build 5 (run `229891579528310`, waves 5-0..5-9)** | Branch `mg-genie-build-5`. 42: brand-value tokens (D-B5-1) + `warning-text`, Databricks icon set (`client/public/brand/icons/`, `icons.manifest.json`, no CDN), 11 UI primitives. 43: UI test harness (`client/src/test/**`, schema-checked `mockApi`, axe, keyboard, `@a11y-strict`). 44: `FeedbackBranch.htmlUrl`, `slackShareEnabled`, `resurfacedFromSkip`, edit votes need a proposed value (400), notify only on create or status change, 53 routes. 45: `@mlflow/core` 0.4.0 (pinned to the AppKit peer), `GT_MLFLOW_TRACES` flag, `pnpm run check:bundle`. 49-56: every screen ported from the Figma Make export (S0-S11), lazy `/steward/**` `/executive` `/admin` `/settings`, steward Feedback queue / Conflicts / Feedback branches, Share to Slack (OBO through `system.ai.slack`, steward/admin only, new `ai-gateway` user scope so users consent once). 60 + owner: AppKit / AppKit UI 0.84.0 -> **0.89.0** (older versions deep-import `@mlflow/core` without `.js` and fail under Node ESM); keep `shared/appkit-types/*.d.ts` committed (0.89.0 `generate-types` is fatal offline); `lucide-react` removed; entry chunk 235.18 kB gzip. Owner: `NODE_ENV=test` pin for vitest; `resources/app.app.yml` `config` is the single source of command + env (`app.yaml` is a stub); `GT_FEEDBACK_REPO_URL`. 61: live contract harness build-5 checks, 153 pass / 0 fail / 201 `skipped_live`. 62: `ui_visual_checks` 44/44; dark tokens also under `:root.dark` (AppKit `prefers-color-scheme` selector beat `.dark`); outline status buttons on `bg-card`. Gotcha: Apps log ingestion tags any line containing `error:` as ERROR (test titles renamed). vitest 1883 pass; deployment `01f1d3145f051b5fbddf309e716f8304` (12/12 probes). Unattended `bundle deploy` still fails at `apps update` (use `bundle run app`; owner terminal deploy pending). Manual checks pending wave 5-11. Summary: `../docs/sessions/2026-10-28_build-5-summary.md`. |

---

## Conventions

- **Git workflow:** Feature branches only. Naming: `mg-genie-<short-description>`.
- **Session summaries:** build-wave sessions write to root `../docs/sessions/`; interactive per-bundle sessions use `ground-truth-app/docs/sessions/` (see `../docs/plans/INDEX.md` §Layout).
- **Contracts first:** a new route or MCP tool starts in `shared/contracts/schemas.ts`, then cases in `tests/contract/`, then regenerate `manifest.json` / `contracts.schema.json` (`../docs/runbooks/contract_tests.md`).
- **Node toolchain in Genie Code:** `../docs/runbooks/node_toolchain_genie_code.md` (Node 22.16.0, pnpm 11.0.8 in `/tmp`).
- **Schema references:** Use `${var.catalog}.${var.schema_name}` (not `${resources.schemas...}` — schema resource is in infra).
- **Cross-bundle variables:** Resolved by `deploy.sh` `resolve_infra_vars()` and passed via `--var` flags.
- **Lakebase migrations:** TypeScript, in `server/migrations/`, run on app startup via AppKit Lakebase client. Tracked in `app._migrations` table.
- **App naming:** `${var.app_display_name}` — target-specific for dev/prod coexistence in the same workspace.
