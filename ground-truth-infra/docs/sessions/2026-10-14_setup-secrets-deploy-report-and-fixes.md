# 2026-10-14 — setup_secrets implementation, deploy.sh key report, and production fixes

**Branch:** `mg-genie-m2m-spn`
**Commits:** `194dda1`, `a2d0d96`, `f2dd6c7`, `e38b61a`
**Last verified run:** `post_deploy_setup` via `./deploy.sh --target dev --infra --run-setup` — all Group A tasks passed (including `setup_secrets` for the first time). Full end-to-end `deploy.sh` pipeline confirmed working.

## Summary

Implemented the `setup_secrets` notebook (was a scaffold raising `NotImplementedError`), added a key report step to `deploy.sh`, fixed the `job_run` not firing on config-unchanged deploys, and resolved two production bugs discovered during end-to-end testing.

## Problems and root causes

| Problem | Root cause | Fix |
| --- | --- | --- |
| `setup_secrets` failed every deploy | Scaffold placeholder `raise NotImplementedError` | Implemented: writes `workspace_url`, checks expected keys, exits with JSON report |
| `deploy.sh` key report showed nothing | `run_post_deploy` job_run only fires on config change; no-op deploys skip it | New `ensure_post_deploy_run` step runs the job explicitly via `bundle run` when `--run-setup` is set |
| `resolve_infra_vars` failed with `JSON parse error: line 1 column 1` | Databricks CLI prints a one-time install banner to stdout before JSON output in fresh terminal sessions | `sed -n '/^{/,$p'` strips lines before the first `{` |
| `smoke_test_genie_one_mcp` failed with `ReadTimeoutError` | Raw `requests.exceptions.ReadTimeout` not caught by `McpHttpClient._post()` — propagated as unhandled exception, bypassing `McpError` handling | Added retry logic (3 attempts, 5s sleep) for `Timeout` and `ConnectionError`; increased default timeout from 60s to 120s; raises `McpError` (not raw exception) on final failure |
| MCP service `ground_truth_mcp` errors on every deploy | HTTP connection can't exist until Bundle 2 deploys the app | Decision: move MCP service resource to Bundle 2 after AppKit stitching |

## Changes

### setup_secrets.py (`194dda1`)

**Was:** scaffold that raised `NotImplementedError`.

**Now:**
- Receives `secret_scope`, `workspace_url`, `m2m_client_id_dbs_key`, `m2m_client_secret_dbs_key`, `admin_keys` as parameters
- Writes `workspace_url` to the scope via `put_secret()` (idempotent)
- Checks all expected keys by name (never reads values):
  - `workspace_url` — this notebook
  - `m2m_client_id_<target>` — `ensure_m2m_service_principal`
  - `m2m_client_secret_<target>` — admin-provisioned
  - `slack_webhook_url`, `teams_webhook_url` — admin-provisioned
- Exits with JSON report via `dbutils.notebook.exit()`: `{scope, written, present, missing[{key, provisioned_by, action}], unexpected}`
- Task values: `secret_keys_written`, `secret_keys_missing`, `secret_keys_missing_count`
- Depends on `ensure_m2m_service_principal` (so client_id is written first)

### post_deploy_setup.job.yml (`194dda1`)

- `setup_secrets` task now receives M2M key names and `admin_keys` list
- Dependency changed from `check_run_setup` to `ensure_m2m_service_principal`

### deploy.sh (`194dda1`, `a2d0d96`, `f2dd6c7`)

**New Step 1c' — `ensure_post_deploy_run`** (`a2d0d96`)
- With `--run-setup`, checks if a `post_deploy_setup` run started during this deploy
- If not, runs `databricks bundle run post_deploy_setup --target <target> --params run_setup=true`
- Non-fatal: a failed run produces a warning, never a failed deploy
- Handles the common case where `run_post_deploy` job_run doesn't fire because no config changed

**New Step 1e — `report_secret_scope_keys`** (`194dda1`)
- Reads the `setup_secrets` task's JSON exit value from this deploy's run via `databricks jobs get-run-output`
- Prints present, missing, and unmanaged keys using the script's `ok`/`warn` style
- Missing keys include their `databricks secrets put-secret` command
- Non-fatal; skips gracefully if the run isn't fresh or the task didn't succeed

**Refactors:**
- `resolve_post_deploy_job_id`: shared helper for looking up the job ID
- `post_deploy_run_is_fresh`: checks if the latest run started during this deploy (60s clock-skew margin)
- `POST_DEPLOY_JOB_ID` resolved from bundle summary alongside other vars
- `DEPLOY_START_MS` recorded before the infra deploy

**CLI banner fix** (`f2dd6c7`)
- Both `resolve_infra_vars` and `resolve_post_deploy_job_id` now pipe `databricks bundle summary` through `sed -n '/^{/,$p'` to strip the one-time CLI install banner

### mcp_client.py (`e38b61a`)

- `_post()` catches `requests.exceptions.Timeout` and `ConnectionError`, retries up to 3 times with 5s sleep, raises `McpError` (not raw exception) on final failure
- `DEFAULT_TIMEOUT` increased from 60s to 120s
- New constants: `_TRANSIENT_RETRY_ATTEMPTS = 3`, `_TRANSIENT_RETRY_SLEEP = 5`

### smoke_test_genie_one_mcp.py (`e38b61a`)

- Step 2 error hints: added `None` status code hint for transient timeout/connection errors

### Scope cleanup (manual, not committed)

- Deleted orphaned keys `mcp_client_id` and `mcp_client_secret` from `semantic_ground_truth_credentials`
- Scope now contains only: `m2m_client_id_dev`, `m2m_client_secret_dev`, `workspace_url`

## Decisions

- **MCP service resource (`ground_truth_mcp`)**: will move from Bundle 1 (infra) to Bundle 2 (app) after stitching together the app with AppKit in the Databricks CLI. Until then, the infra deploy prints an expected connection error.
- **`setup_secrets` depends on `ensure_m2m_service_principal`** instead of `check_run_setup`, so the M2M client_id is already written when the key report runs.
- **`ensure_post_deploy_run` runs the full job** (not the `only:` subset from `run_post_deploy`). Group B tasks skip themselves because `app_url` is empty.

## Verified deploy.sh output (end-to-end)

```
==> Resolving infrastructure variables (target: dev)
  ✓  Resolved: catalog=hls_fde_dev, schema=dev_matthew_giglia_semantic_ground_truth
  ✓  m2m_oauth_scopes=apps ai-gateway

==> Deploying ground-truth-infra (target: dev)
  Common expected failures: MCP service (connection pre-Bundle 2)

==> Running post_deploy_setup (job_run did not fire — no config change)
  ✓  post_deploy_setup run completed.

==> Checking M2M SPN credentials
  ✓  M2M client_id present: m2m_client_id_dev
  ✓  M2M client_secret present: m2m_client_secret_dev
  ✓  M2M token exchange: VERIFIED (HTTP 200)

==> Secret scope key report (setup_secrets task)
  ✓  Scope semantic_ground_truth_credentials: wrote workspace_url
  ✓  Present: m2m_client_id_dev, m2m_client_secret_dev, workspace_url
  ⚠  2 expected key(s) missing:
  ⚠    slack_webhook_url (admin): databricks secrets put-secret ...
  ⚠    teams_webhook_url (admin): databricks secrets put-secret ...
```

## Files modified

- `deploy.sh`: `ensure_post_deploy_run`, `report_secret_scope_keys`, `resolve_post_deploy_job_id`, `post_deploy_run_is_fresh`, CLI banner fix, `DEPLOY_START_MS`/`POST_DEPLOY_JOB_ID`
- `ground-truth-infra/resources/jobs/post_deploy_setup.job.yml`: setup_secrets params and dependency
- `ground-truth-infra/src/notebooks/setup_secrets.py`: full implementation
- `ground-truth-infra/src/lib/mcp_client.py`: retry logic, timeout increase
- `ground-truth-infra/src/notebooks/smoke_test_genie_one_mcp.py`: timeout hint
- `ground-truth-infra/docs/sessions/INDEX.md`: new entry

## Open items

1. **Merge PR** — `mg-genie-m2m-spn` has 13 commits, 79 files (+9,359 lines). Draft PR description pending.
2. **Remove MCP service resource from infra** — eliminates red `Error:` on every deploy. Do before or during Bundle 2 AppKit work.
3. **Bundle 2 (App)** — next major milestone: AppKit scaffold, Lakebase migrations, MCP server, React UI.
4. **Admin keys** — `slack_webhook_url` and `teams_webhook_url` still missing (not blocking).
