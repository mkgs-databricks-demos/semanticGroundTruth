# 2026-10-20 — Schema-Level MCP Connection + Deploy UX

**Branch:** `mg-genie-app-scaffold`
**Commits:** 16 in this session (ef83f0a → f0bcdd0), ~27 total ahead of `origin/main`

---

## Summary

Migrated MCP connection creation from metastore-level SQL DDL to schema-level REST API via a notebook job. Iterated through three implementation approaches (SQL file → Python script → `.ipynb` notebook) before landing on the right one. Rewrote `deploy_bundle()` output handling so first-deploy errors appear as calm notes instead of red CLI text. Added auto-recovery for 504 timeouts on MCP service creation via `bundle deployment bind`. Two successful first-deploy tests confirmed the full end-to-end flow.

---

## Problems & Root Causes

### 1. PERMISSION_DENIED on CREATE CONNECTION (metastore-level)
**Symptom:** `deploy.sh` Phase 2 connection job failed with `Principal 'Matthew Giglia' does not have CREATE CONNECTION on Metastore metastore_aws_us_east_1`.  
**Root cause:** SQL `CREATE CONNECTION` is always metastore-scoped. User has `ALL PRIVILEGES` on `hls_fde_dev` catalog but no metastore-level `CREATE CONNECTION` grant.  
**Fix:** Switch to schema-level connections via the REST API (`POST /api/2.1/unity-catalog/connections` with `parent: "schemas/<cat>.<schema>"`), which needs only `CREATE CONNECTION` on the schema.

### 2. SQL DDL cannot parse 3-part connection names
**Symptom:** All SQL attempts to reference `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp` returned parse errors.  
**Root cause:** The SQL grammar for `CREATE/ALTER CONNECTION` only accepts unqualified names. Schema-level connections are REST-only.  
**Fix:** Replaced SQL task entirely with Python notebook using `WorkspaceClient().api_client.do()` for REST calls.

### 3. notebook_task couldn't find the SQL file
**Symptom:** `notebook_task` strips the `.sql` extension and looks up a NOTEBOOK object, but `createAsset` with `assetType: "file"` creates a FILE object.  
**Root cause:** `notebook_task` expects a workspace NOTEBOOK; files created via the workspace API are type FILE.  
**Fix (intermediate):** Switched to `sql_task.file` (commit 5ddb7fb).  
**Fix (final):** Created the notebook via `createAsset` with `assetType: "notebook"`, which stores it as a real NOTEBOOK object. `notebook_task` resolves it correctly.

### 4. CONCAT with adjacent single-quotes drops quotes silently
**Symptom:** SQL DDL rendered `host https://...` instead of `host 'https://...'` — the enclosing single-quotes were silently dropped.  
**Root cause:** Databricks SQL `'abc'''` adjacent literal concatenation doesn't work as expected; the closing-then-opening `'''` sequence drops the quote.  
**Fix:** Replaced all `CONCAT(... ''', v, ''', ...)` with `format_string("... '%s' ...", v)` using double-quoted template strings. Verified via SELECT before committing.

### 5. Red CLI error output on first deploy
**Symptom:** The CLI prints `Error: cannot create resources.mcp_services...` in red on first deploy (connection doesn't exist yet). Looks alarming but is expected and self-resolving.  
**Root cause:** `databricks bundle deploy` writes error messages with ANSI colour codes directly to the terminal. `deploy_bundle()` caught the exit code but couldn't suppress the colour.  
**Fix:** Piped CLI output through `tee` to a temp log file. Piping strips the CLI's colour codes, so `Error:` lines appear as plain text. After deploy, `grep` classifies errors into expected MCP failures vs unexpected ones.

### 6. 504 DEADLINE_EXCEEDED on MCP service create
**Symptom:** Second step (auto-redeploy) returned `504 Gateway Timeout: Storage timeout` for the MCP service create. The service actually was created, but the bundle state didn't record it, and grants weren't applied.  
**Root cause:** Server-side timeout on the UC storage layer; the write committed but the response timed out.  
**Fix:** Added auto-recovery in Step 2f: check if the MCP service exists via REST → `bundle deployment bind` → deploy once more for grants.

### 7. PIPESTATUS overwritten by `|| true`
**Symptom:** Offline testing showed every failed deploy reported as `✓ Deployed` instead of classifying errors.  
**Root cause:** `(cmd) 2>&1 | tee log || true` — the trailing `|| true` set `$?` to 0, and `PIPESTATUS` was read after that reset.  
**Fix:** Moved `PIPESTATUS` capture inside a `{ ...; pipe_rc=("${PIPESTATUS[@]}"); } || true` group so the array is saved before the group's exit status is overridden.

---

## Implementation Journey

The connection task went through three forms before landing:

| # | Approach | File | Task type | Why it failed |
|---|----------|------|-----------|---------------|
| 1 | SQL DDL | `create_mcp_connection.sql` | `sql_task.file` | SQL can't create schema-level connections (metastore-only); quoting bugs with CONCAT |
| 2 | Python script | `create_mcp_connection.py` | `spark_python_task` | Works, but poor observability (one log blob); needs `argparse` + `environments` block |
| 3 | Python notebook | `create_mcp_connection.ipynb` | `notebook_task` | Each cell visible in run UI; widgets map directly from job params; `dbutils.secrets.get()` auto-redacts |

---

## Changes Made

### deploy.sh (solution root)
- `deploy_bundle()`: piped CLI output through `tee`; classify MCP vs unexpected errors; green note for expected first-deploy failures, yellow for real errors
- `deploy_bundle()`: `PIPESTATUS` captured inside `{ ... } || true` group (fix for overwrite bug)
- `deploy_bundle()`: `LAST_DEPLOY_RC` exported for callers
- `deploy_bundle()`: extra_args handled via `${arr[@]+"${arr[@]}"}` (set -u safe)
- Step 2f: auto-recovery for 504 timeout (check MCP service → bind → deploy for grants)
- Step 2f: "MCP service registered" confirmation only prints on success
- Step 2e comment: updated from "SQL notebook job" to "notebook job (schema-level connection via REST)"
- Summary line: prints full 3-part MCP connection name

### ground-truth-app/databricks.yml
- Job task: `sql_task.file` → `spark_python_task` → `notebook_task` with `.ipynb` path
- Removed `environment_key`, `environments` block, `parameters:` argument mapping
- Job `parameters:` block: added `catalog` and `schema_name` (10 total)
- MCP service `source_connection.name`: updated from short name to 3-part `connections/${var.catalog}.${var.schema_name}.semantic-ground-truth-mcp`

### ground-truth-app/src/notebooks/create_mcp_connection.ipynb (NEW)
- 6 cells: title (md), pip install SDK + restart, widget parameters (10), read M2M credentials, create/update connection via REST, verify
- Schema-level: `POST /api/2.1/unity-catalog/connections` with `parent: "schemas/<cat>.<schema>"`
- Update path: `PATCH /api/2.1/unity-catalog/connections/<cat>.<schema>.<name>`
- Created via `createAsset` with `assetType: "notebook"` → stored as real NOTEBOOK object

### Deleted Files
- `ground-truth-app/src/notebooks/create_mcp_connection.sql` — SQL DDL approach (orphaned)
- `ground-truth-app/src/notebooks/create_mcp_connection.py` — Python script approach (orphaned)

---

## Key Decisions

### Schema-level connections over metastore-level
Schema-level connections require only `CREATE CONNECTION` on the schema (covered by catalog-level `ALL PRIVILEGES`). Metastore-level requires a metastore admin grant. The REST API is the only way to create them — SQL DDL is metastore-only.

### Notebook over Python script
Notebook gives per-cell output in the job run page, widget values displayed as parameters, `dbutils.secrets.get()` auto-redaction, and repair-run context. The script gives a single stdout/stderr blob. The notebook also avoids the `environments` block and `argparse` boilerplate.

### Tee + classify over suppressing output
Capturing output and replaying it after classification was considered (option 1), but nothing shows during the multi-minute deploy. Tee (option 2) preserves live progress while stripping colour. The error classification uses anchored regexes matching the exact two expected error lines.

### Auto-recovery via bind
`bundle deployment bind` works for MCP services. If the service exists after a failed redeploy (timeout), bind syncs the state and a follow-up deploy applies grants. Tested offline with a stubbed CLI (4 scenarios: timeout+recover, timeout+no-service, timeout+bind-fail, clean).

---

## Key Discoveries

| # | Finding |
|---|----------|
| 18 | Schema-level connections: need `CREATE CONNECTION on SCHEMA` (not metastore); user has `ALL PRIVILEGES` on catalog → works |
| 19 | M2M HTTP option keys: `host`, `port`, `base_path`, `client_id`, `oauth_scope`, `token_endpoint`, `is_mcp_connection` (`client_secret` write-only) |
| 20 | Metastore list endpoint does NOT return schema-level connections (3-part names absent from 5,673 results) |
| 21 | SQL DDL cannot parse 3-part connection names — REST API only |
| 22 | DABs do not support `connections` as a resource type |
| 23 | `createAsset` `assetType: "file"` → workspace FILE; `assetType: "notebook"` → workspace NOTEBOOK. `notebook_task` only finds NOTEBOOK objects |
| 24 | `bundle deployment bind` works for MCP services (tested live for 504 recovery) |
| 25 | Databricks SQL CONCAT with `'''` adjacent-quote syntax silently drops the quote |
| 26 | `PIPESTATUS` must be captured before `|| true` in a pipeline — `|| true` resets it to `(0)` |

---

## Files Modified

| File | Change |
|------|--------|
| `deploy.sh` | Tee+filter deploy output, PIPESTATUS fix, 504 auto-recovery, 3-part name in summary, Step 2e comment |
| `ground-truth-app/databricks.yml` | notebook_task, updated params, 3-part MCP service connection name |
| `ground-truth-app/src/notebooks/create_mcp_connection.ipynb` | NEW — schema-level connection notebook |
| `ground-truth-app/src/notebooks/create_mcp_connection.sql` | DELETED — orphaned SQL approach |
| `ground-truth-app/src/notebooks/create_mcp_connection.py` | DELETED — orphaned script approach |

---

## Verified End State (two successful first-deploy tests)

| Resource | State |
|----------|-------|
| App `dev-semantic-ground-truth` | RUNNING, compute ACTIVE |
| Connection `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp` | OAUTH_M2M, token exchange succeeded |
| MCP service | ACTIVE, tool selectors `review_*`, `campaign_*`, `metric_view_*` |
| Grants | `data-engineers` → EXECUTE |
| Bundle state | All 4 resources tracked: app, job, MCP service, grants |

---

## Remaining

- [x] Delete test connection `hls_fde_dev.dev_matthew_giglia_bcda.mkgs_test` (deleted manually; verified via API — `ResourceDoesNotExist`)
- [ ] Test MCP `tools/list` call through Unity Gateway
- [ ] Draft PR description for merge to `main`
