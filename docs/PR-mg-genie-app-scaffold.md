# PR: `mg-genie-app-scaffold` → `main`

**Title:** feat: App bundle scaffold, MCP connection automation, deploy.sh Phase 2

**Base:** `main` (at `48a4a10` — Merge pull request #1 from mg-genie-m2m-spn)
**Head:** `mg-genie-app-scaffold` (34 commits, 2026-10-14 → 2026-10-20)
**Stats:** 69 files changed, +14,938 / −129

---

## What this PR does

Adds the **app bundle** (`ground-truth-app/`) to the three-bundle monorepo and automates the full first-deploy flow so that a single `./deploy.sh --target dev --app` takes the app from nothing to a running Databricks App with an active MCP service in Unity Gateway.

### 1. App bundle scaffold (AppKit Node.js + React)

- Initialised via `databricks apps init` with AppKit v0.84.0
- **Server:** Node.js with AppKit plugins (agents, analytics, jobs, lakebase, server)
- **Client:** React 19 + Vite + Tailwind 4 (card-swipe UX placeholder)
- **Targets:** `dev` (default), `prod`, `local` (localhost proxy)
- **OBO scopes:** sql, genie, files, model-serving
- **OpenTelemetry:** `telemetry_export_destinations` + `OTEL_TRACES_SAMPLER=always_on` → spans/logs/metrics land in UC tables
- **MCP service resource** moved from infra bundle to app bundle (where it belongs — it depends on the app URL)

### 2. MCP connection automation (schema-level REST API)

The MCP service needs an HTTP connection to the app. This PR automates its creation:

- **`create_mcp_connection.ipynb`** — notebook job that creates/updates a schema-level UC connection via the REST API
  - Schema-level connections use 3-part names (`catalog.schema.connection`) and need only `CREATE CONNECTION` on the schema (no metastore admin grant)
  - 10 widget parameters mapped from job params; secrets read via `dbutils.secrets.get()` (auto-redacted in run output)
  - Create-or-update: checks existence via GET, then POST (create) or PATCH (update)
- **Job resource** in `databricks.yml` with `notebook_task` pointing to the `.ipynb`
- Three implementation iterations are documented in the session summary; only the final `.ipynb` notebook ships

### 3. deploy.sh Phase 2 (app deploy orchestration)

Phase 2 of `deploy.sh` now handles the full app lifecycle:

1. Resolve infra variables from Bundle 1 summary
2. Deploy app bundle (MCP service deferred on first deploy — connection doesn't exist yet)
3. Resolve app URL from `databricks apps get` (not bundle summary — it doesn't include the live URL)
4. Run `create_mcp_connection` notebook job with resolved parameters
5. Auto-redeploy to register MCP service + grants

**Deploy UX improvements:**
- `deploy_bundle()` pipes CLI output through `tee` to a temp log — strips ANSI colour codes so `Error:` lines appear as plain text instead of red
- After deploy, `grep` classifies errors: expected MCP-service failures get a calm green note; unexpected errors get a yellow warning with count
- `PIPESTATUS` captured correctly inside `{ ...; } || true` group (the trailing `|| true` was resetting it to 0)

**504 auto-recovery:**
- If the MCP service create returns a 504 timeout (the service may be created despite the timeout), the script checks if the service exists via REST, runs `bundle deployment bind` to sync the state, and deploys once more for grants
- Tested offline with a stubbed CLI across 4 scenarios (timeout+recover, timeout+no-service, timeout+bind-fail, clean)

### 4. Infra bundle changes (supporting app deploy)

- **MLflow experiment resource** (`app_agents_experiment`, ID `1698842789305538`) — needed by app bundle for agent traces
- **Deprecated MCP service file deleted** from infra bundle (moved to app bundle)
- **`app_role` comment updated** — documents that AppKit auto-provisions Lakebase SPN, no manual update needed

### 5. Documentation

- **`PROJECT_MEMORY.md`** — status log, 9 new critical deploy findings (#17–25), updated Post-Deploy Checklist (all steps now automated), updated Phase 2 cross-bundle contract
- **Session summaries:**
  - `ground-truth-infra/docs/sessions/2026-10-19_app-bundle-phase-b-first-deploy.md` — first deploy + Lakebase SPN investigation
  - `docs/sessions/2026-10-20_mcp-connection-schema-level-and-deploy-ux.md` — MCP connection + deploy UX
- **`docs/sessions/INDEX.md`** created (solution-level session index for cross-bundle work)
- **`ground-truth-app/PROJECT_MEMORY.md`** — app bundle targets, variables, OTel tables, remaining work
- **`ground-truth-app/docs/plans/app_build_plan.md`** — Phases A–J execution strategy

---

## Key technical decisions

| Decision | Rationale |
|----------|-----------|
| Schema-level connections over metastore-level | No metastore admin grant needed; covered by catalog `ALL PRIVILEGES` |
| REST API over SQL DDL for connection creation | SQL DDL is metastore-level only; cannot parse 3-part names |
| `.ipynb` notebook over Python script | Per-cell output in job run UI; widget values displayed; `dbutils.secrets.get()` auto-redaction |
| `tee` + classify over suppressing output | Preserves live deploy progress; colour stripping is a side effect of piping |
| MCP service in app bundle, not infra | Depends on app URL; deploys with the app lifecycle |
| `bundle deployment bind` for 504 recovery | Service exists but isn't in bundle state; bind syncs without recreating |

---

## Verified end state (two clean first-deploy tests)

| Resource | State |
|----------|-------|
| App `dev-semantic-ground-truth` | RUNNING, compute ACTIVE |
| Connection `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp` | OAUTH_M2M, token exchange succeeded |
| MCP service | ACTIVE, tool selectors `review_*`, `campaign_*`, `metric_view_*` |
| Grants | `data-engineers` → EXECUTE |
| Bundle state | All 4 resources tracked: app, job, MCP service, grants |

---

## Not included / remaining work

- [ ] Test MCP `tools/list` call through Unity Gateway
- [ ] Backend implementation (Review Engine, Campaign Manager, Notification Service)
- [ ] React frontend (card-swipe UX)
- [ ] Bundle 3 (agent)

---

## How to test

**Clean first deploy (from scratch):**
```bash
./deploy.sh --target dev --app
```

**Destroy and re-test:**
```bash
cd ground-truth-app
databricks bundle destroy --target dev --auto-approve --var "catalog=hls_fde_dev" ...
databricks api delete /api/2.1/unity-catalog/connections/hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp
cd ..
./deploy.sh --target dev --app
```

**Validate only (no deploy):**
```bash
./deploy.sh --target dev --app --validate-only
```
