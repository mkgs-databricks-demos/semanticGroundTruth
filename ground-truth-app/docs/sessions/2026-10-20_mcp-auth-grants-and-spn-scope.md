# Session: MCP Auth, SPN Grants, and OAuth Scope Investigation

**Date:** 2026-10-20  
**Branch:** `mg-genie-app-resource-refactor`  
**Duration:** Full session  
**Engineer:** Matthew Giglia

---

## Work Completed

### 1. App Bundle Resource Refactor (start of session)

Extracted all resources from `databricks.yml` into `resources/` directory:

```
resources/
├── app.app.yml
├── ground_truth_mcp.mcp_service.yml
└└── jobs/
    ├── create_mcp_connection.job.yml
    ├── app_post_deploy_setup.job.yml
    └── run_app_post_deploy.job_run.yml
```

New notebook: `src/notebooks/grant_app_permissions.ipynb`  
New variable: `mcp_execute_principal` (default: `account users`)  
`bundle deploy --target dev` succeeded: 2 created, 2 changed, deploy hook ran.

---

### 2. Bug: `service_principal_name` in Permissions API

**File:** `src/notebooks/grant_app_permissions.ipynb`, cell 5  
**Problem:** `w.apps.update_permissions()` was called with `service_principal_name=spn.display_name`.  
The Workspace Permissions API **silently drops** ACL entries with unrecognized principal names — no error, no exception. The job reported SUCCESS but the SPN was not in the grants.

**Root cause confirmed by:** Job run output showed only `matthew.giglia@databricks.com` and `admins` in result JSON.

**Fix:** Changed to `service_principal_name=spn.application_id` (UUID).  
**Commit:** `fix: use application_id (UUID) for service_principal_name in Permissions API`

---

### 3. Discovery: `account users` Does NOT Include Service Principals

**Finding:** The `account users` built-in group excludes SPNs entirely. The MCP service grants showed `account users: EXECUTE` but the M2M SPN had no UC access at all.

**Required grants for the M2M SPN** (all three missing):
- `USE CATALOG` on `hls_fde_dev`
- `USE SCHEMA` on `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth`  
- `EXECUTE` on `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp`

**Fix:** Added UC grants cell to `grant_app_permissions.ipynb` using `w.grants.update()`.  

**Second bug found:** UC Grants API also requires `application_id` (UUID) for the `principal` field — `display_name` throws `NotFound: Could not find principal`. Same pattern as Permissions API.  
**Commit:** `feat: add UC grants (USE CATALOG/SCHEMA, EXECUTE) for M2M SPN`  
**Commit:** `fix: UC Grants API also requires application_id, not display_name`

**Final verified grants** (confirmed via `w.grants.get()` + `w.apps.get_permissions()`):
```
App permissions:
  matthew.giglia@databricks.com: CAN_MANAGE
  <M2M SPN app_id>:              CAN_USE   ✓
  admins:                        CAN_MANAGE

UC grants for semantic-ground-truth-m2m-dev:
  catalog hls_fde_dev:                                          USE_CATALOG  ✓
  schema  ..._semantic_ground_truth:                            USE_SCHEMA   ✓
  mcp_service ..._semantic_ground_truth.semantic-ground-truth:  EXECUTE      ✓
```

---

### 4. SQL DDL vs Schema-Scoped Connections — Full Investigation

**Goal:** Find whether SQL DDL + `secret()` refs can be used for schema-scoped connections (to avoid storing literal credentials via REST API).

**Context:** The hi-genie-orchestrator uses:
```sql
CREATE CONNECTION IF NOT EXISTS ${mcp_connection_name}
TYPE HTTP
OPTIONS (
  client_id secret('scope', 'key'),
  client_secret secret('scope', 'key'),
  oauth_scope 'all-apis',
  token_endpoint 'https://<workspace>/oidc/v1/token'
)
```
This works for hi-genie because (a) it creates metastore-level connections, and (b) their SPN has `all-apis`.

**All syntax forms tested — ALL FAILED for schema-scoped:**

| Syntax | Error |
|--------|-------|
| `` `cat`.`schema`.`name` `` | `PARSE_SYNTAX_ERROR` at `.` |
| `` `cat.schema.name` `` | `PERMISSION_DENIED: CREATE CONNECTION on Metastore` |
| `cat.schema.name` | `PARSE_SYNTAX_ERROR` at `.` |
| `USE CATALOG x; USE SCHEMA y; CREATE CONNECTION name` | `PERMISSION_DENIED: CREATE CONNECTION on Metastore` |

**Definitive conclusion:** `CREATE CONNECTION` SQL DDL **always requires metastore-level `CREATE CONNECTION` privilege** regardless of `USE` context. The user has schema-level privilege only (via catalog `ALL PRIVILEGES`). Schema-scoped connections are **REST API only**.

**`ALTER CONNECTION` also tested:** `DESCRIBE CONNECTION` with single-backtick full name works, but `ALTER CONNECTION` returns `CONNECTION_NOT_FOUND`. SQL DDL management is metastore-only.

**Consequence:** `secret()` refs are unavailable for schema-scoped connections. Credentials must be stored as literals via REST API and refreshed on each deploy by the `create_mcp_connection` job.

---

### 5. MCP Authentication Investigation — Root Cause Found

**Symptom:** UC Catalog Explorer showed: *"Authentication required: no credential found for this MCP service's connection. Please log in."*

**Test method:** Used `w.config.authenticate()` from a notebook cell (SDK auto-auth) to call the Unity Gateway MCP endpoint:
```
POST https://fevm-hls-fde.cloud.databricks.com/ai-gateway/mcp-services/hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp
```

**Result:** HTTP 200 from Unity Gateway, but MCP error body:
```json
{
  "code": -32603,
  "message": "The MCP server returned an HTTP 302 redirect to https://fevm-hls-fde.cloud.databricks.com/oidc/oauth2/v2.0/authorize?...&client_id=15f89dae-176e-44c7-b72a-75564aef86f5..."
}
```

**Analysis:**
- Unity Gateway: auth OK, request forwarded to app ✓
- App sidecar: received M2M Bearer token, returned **302 redirect to browser OAuth**
- `client_id=15f89dae-...` in redirect = the **app's own OAuth client** (not our SPN)
- Sidecar expects authorization-code-flow tokens, not client-credentials M2M tokens

**Initial hypothesis (wrong):** App sidecar incompatible with M2M tokens → needs bypass.  
**Actual root cause:** M2M SPN's OAuth secret was scoped to `apps ai-gateway`. The app sidecar requires a token with `all-apis` scope.

**Evidence:** Testing `CREATE CONNECTION` with `oauth_scope 'all-apis'` returned:
```
UC_CONNECTION_OAUTH_EXCHANGE_FAILED: HTTP status code 403 Forbidden.
Scopes 'all-apis' are not assigned to the client 16f8923c-a948-4f0e-b00a-f54ad3f6b1f9
```

**Docs confirmation:** [Connect to an API Databricks app using token authentication](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local/): *"A token generated using the Databricks CLI includes the all-apis scope by default, which satisfies the user authorization requirements for any app."*

**Docs on secret scopes:** [OAuth M2M docs](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-m2m/): *"Scopes are set when you generate the secret and **can't be changed afterward**. To use different scopes, generate a new secret."*

---

## Key Findings Summary

| # | Finding | Impact |
|---|---------|--------|
| 1 | Permissions API: `service_principal_name` needs `application_id` UUID, not display_name. Silent failure. | Fix notebook pattern everywhere |
| 2 | UC Grants API: `principal` also needs `application_id` UUID. Throws `NotFound` with display_name. | Fix notebook pattern everywhere |
| 3 | `account users` excludes SPNs. Explicit UC grants required for every SPN. | Add to every future MCP deployment |
| 4 | SQL DDL `CREATE CONNECTION` requires metastore `CREATE CONNECTION` privilege. No schema-scoped syntax exists. | REST API only for schema-level connections |
| 5 | App sidecar requires `all-apis` OAuth scope. `apps ai-gateway` is insufficient — sidecar does 302. | Regenerate M2M SPN secret with `all-apis` |
| 6 | OAuth secret scopes are immutable. Must generate a new secret to change scopes. | One-time admin action |

---

## Files Modified

| File | Change |
|------|--------|
| `src/notebooks/grant_app_permissions.ipynb` | Fixed `application_id` for Permissions API; added UC grants cell; added catalog/schema/mcp_service_name widgets; updated verify cell |
| `resources/jobs/app_post_deploy_setup.job.yml` | Added `catalog`, `schema_name`, `mcp_service_name` parameters |
| `resources/jobs/run_app_post_deploy.job_run.yml` | Pass new params from bundle vars; updated comment |
| `resources/jobs/create_mcp_connection.job.yml` | Changed `oauth_scopes` default from `apps ai-gateway` to `apps` (intermediate fix; final fix is `all-apis` after secret regeneration) |
| `src/notebooks/create_mcp_connection.ipynb` | Changed `oauth_scopes` widget default to `apps`; cleaned up test cells |

---

---

## Resolution: MCP-1 through MCP-4 Complete

**All auth issues resolved in the same session (2026-10-20 15:26 UTC)**

### MCP-1: Regenerate OAuth Secret
User generated a new OAuth secret for `semantic-ground-truth-m2m-dev` via Settings UI with **"all APIs"** scope (no restriction = `all-apis` default). Old secret remains active until manually revoked.

### MCP-2: Store New Secret  
```sh
databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_dev --string-value "<new_secret>"
```

### MCP-3: Re-PATCH HTTP Connection
```sh
bundle run create_mcp_connection --target dev \
  --params connection_name=semantic-ground-truth-mcp,\
catalog=hls_fde_dev,\
schema_name=dev_matthew_giglia_semantic_ground_truth,\
app_url=https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com,\
scope_name=semantic_ground_truth_credentials,\
client_id_key=m2m_client_id_dev,\
client_secret_key=m2m_client_secret_dev,\
oauth_scopes=all-apis,\
token_endpoint=https://fevm-hls-fde.cloud.databricks.com/oidc/v1/token
```
Result: SUCCESS. Connection `oauth_scope` updated to `all-apis`, `access_token_expiration` refreshed to `2026-10-20 16:28:12`.

### MCP-4: Update Job YAML Default
Changed `oauth_scopes` default from `apps` → `all-apis` in both `resources/jobs/create_mcp_connection.job.yml` and `src/notebooks/create_mcp_connection.ipynb` widget.

### Verification
```python
# HTTP 200 from Unity Gateway
# Error body: {"code": -32603, "message": "Cannot POST /mcp", "upstream_status": 404}
```
302 redirect to browser OAuth is **gone**. App sidecar now accepts the `all-apis` M2M token. 404 is expected — Phase H not built yet.

---

## What Is (and Isn't) Wired to the Deploy Hook

The `run_app_post_deploy` job_run resource auto-triggers `app_post_deploy_setup` on every `bundle deploy`.

| Step | Auto on `bundle deploy`? | How |
|------|--------------------------|-----|
| App `CAN_USE` for M2M SPN | ✅ Yes | `run_app_post_deploy` → `app_post_deploy_setup` |
| `USE_CATALOG` for M2M SPN | ✅ Yes | same |
| `USE_SCHEMA` for M2M SPN | ✅ Yes | same |
| `EXECUTE` on MCP service for M2M SPN | ✅ Yes | same |
| Connection PATCH (`create_mcp_connection`) | ❌ Manual | `bundle run create_mcp_connection --params ...` |

**Why the connection isn't wired:** The job requires `app_url` as a parameter. The URL is stable (app ID `7474657291520070` is fixed at app creation), so it could be added as a per-target variable and wired via a second `job_run` hook in a future improvement.

---

## Next Steps

See PROJECT_MEMORY.md § Next Steps for the full ordered list.

**Immediate priority:** Phase C (Lakebase migrations) or Phase H (/mcp endpoint) — both unblocked.
