# PR: Bundle 1 (ground-truth-infra) — full scaffold through M2M SPN and deploy automation

**Branch:** `mg-genie-m2m-spn` → `main`
**Stats:** 44 commits, 80 files changed, +9,488 / −2 lines

---

## What this PR does

Bootstraps the entire `ground-truth-infra` bundle (Bundle 1 of 3) for the Semantic Ground Truth solution, from empty repo to a fully automated deploy pipeline. After this merges, `./deploy.sh --target dev --infra --run-setup` provisions all infra, verifies M2M SPN credentials, smoke-tests Genie One MCP connectivity, and reports secret scope status — with zero manual steps beyond the one-time admin secret.

---

## PR sections

### 1. Three-bundle scaffold and solution root

`525e423`…`d8a3de5`

- Three DAB bundles: `ground-truth-infra/`, `ground-truth-app/` (empty), `ground-truth-agent/` (empty)
- Solution-root `README.md`, `PROJECT_MEMORY.md`
- All three bundles set `engine: direct` (required for `secret_scope`, `job_run`, `mcp_service` resources)

### 2. Infra bundle build (Phases 1–8)

`1eb85bc`…`837efb4`

| Phase | What | Key resources |
| --- | --- | --- |
| 1 | Bundle config | `databricks.yml`, variables, targets (dev/prod), `ground_truth_schema.schema.yml` |
| 2 | Lakebase | Project, 2 branches (production/dev), role, database |
| 3 | SQL warehouse + secrets | `infra_warehouse.warehouse.yml`, `ground_truth_scope.secret_scope.yml`, 3 UC secret stubs |
| 4 | Lakeflow jobs + notebooks | `feedback_pipeline`, `freshness_resurfacing`, `metric_view_deploy`, `post_deploy_validation`, `post_deploy_setup` + 10 notebook sources |
| 5 | Metric view fixtures | 4 YAML configs in `fixtures/metric_views/` |
| 6 | Genie Code skill | `fixtures/prompts/feedback_loop_prompt.md` |
| 7 | Unity Gateway | `docs/runbooks/unity-gateway-setup.md` |
| 8 | First deploy | Deploy fixes, `bundle deploy --target dev` succeeded |

### 3. Post-deploy automation (Group A notebooks)

`8755c41`, `1531875`

- `setup_genie_automation.py` — creates/updates Genie Code automation via scheduled-insights API
- `setup_job_params.py` — patches `feedback_pipeline` to replace `notebook_task` with `genie_task` (Beta workaround: DAB validator strips `genie_task` as unknown)
- `feedback_pipeline.job.yml` reworked to genie_task with PENDING_SETUP placeholder
- `create_feature_branch.py` deprecated (superseded by genie_task)
- Source-linked deployment disabled for dev (`presets.source_linked_deployment: false`)

### 4. M2M service principal

`b93edfc`…`4385e88`

- **Plan:** `docs/plans/m2m_service_principal_plan.md` (§8 OBO decision, §9 open questions resolved)
- **Runbook:** `docs/runbooks/m2m-service-principal.md` (secret rotation, scope expansion, OBO grants)
- **Library:** `src/lib/service_principal.py` (`get_or_create_service_principal`, `verify_client_credentials`), `src/lib/secret_scope.py` (`put_secret`, `list_secret_keys`, `ensure_scope_read_acl`, `try_get_secret_value`)
- **Notebook:** `src/notebooks/ensure_m2m_service_principal.py` — 10-cell, parameterized; creates SPN, stores client_id, verifies token exchange, emits task values
- **Job wiring:** condition gate `check_m2m_token_verified`, `+ensure_m2m_service_principal` in `run_post_deploy` only list
- **Secret keys:** `m2m_client_id_<target>` / `m2m_client_secret_<target>` (simplified from schema-qualified names)
- **OBO confirmed:** Bundle 2 app uses OBO; M2M SPN is the effective "user" for MCP traffic through Unity Gateway

### 5. OAuth scopes and Genie One MCP smoke test

`ebbaac2`…`7ed1b2f`

- `var.m2m_oauth_scopes` default: `"apps ai-gateway"`
  - `apps`: connection calls the Bundle 2 app's `/mcp`
  - `ai-gateway`: SPN calls Unity Gateway MCP services (Genie One, later `ground_truth_mcp`)
- **Reusable MCP client:** `src/lib/mcp_client.py` — `McpHttpClient` (Streamable HTTP transport: `initialize` → `notifications/initialized` → `tools/list` / `tools/call`; handles JSON and SSE responses; retries transient timeouts up to 3 attempts; 120s default timeout), `get_m2m_access_token()`, `extract_text_content()`, `parse_text_as_json()`
- **Smoke test:** `src/notebooks/smoke_test_genie_one_mcp.py`
  1. M2M token with `ai-gateway` scope
  2. MCP `initialize` handshake
  3. `tools/list` assertion (`genie_ask`, `genie_poll_response` required)
  4. `genie_ask` + `genie_poll_response` with exponential backoff (3s→15s cap, 120s timeout)
  - `_classify_poll()` detects completion from rendered markdown (not JSON status), handles Genie's "still running" intermediate text
  - A poll timeout warns but does not fail (reachability proven by steps 1–3)
- **Job wiring:** `check_m2m_token_verified` gate → `smoke_test_genie_one_mcp`

### 6. setup_secrets and deploy.sh key report

`194dda1`…`fe604dd`

- **setup_secrets.py** (was scaffold) — writes `workspace_url`, checks expected keys by name, exits with JSON report `{scope, written, present, missing[{key, provisioned_by, action}], unexpected}` via `dbutils.notebook.exit()`
- **deploy.sh additions:**
  - `resolve_infra_vars` picks up `POST_DEPLOY_JOB_ID` from bundle summary
  - `DEPLOY_START_MS` recorded before infra deploy
  - **Step 1c' `ensure_post_deploy_run`**: with `--run-setup`, runs the job explicitly via `bundle run` when the `job_run` resource didn't fire (no config change)
  - **Step 1e `report_secret_scope_keys`**: reads the `setup_secrets` JSON exit value from this deploy's run, prints present/missing/unmanaged keys
- **CLI banner fix:** `sed -n '/^{/,$p'` strips the one-time Databricks CLI install banner from stdout before JSON parsing

### 7. Research and documentation

- `docs/research/03_genie_code_workflow_tasks.md` — genie_task API surface and deploy pattern
- `docs/research/04_dab_secrets_jobruns_mcp.md` — new DAB resource types (`secret`, `secret_scope`, `job_run`, `mcp_service`)
- `docs/plans/post_deploy_automation_plan.md`, `docs/plans/feedback_pipeline_rework_plan.md`
- `docs/plans/m2m_service_principal_plan.md`
- 16 session summaries in `docs/sessions/` with `INDEX.md`

---

## deploy.sh pipeline (end-to-end, verified)

```
./deploy.sh --target dev --infra --run-setup

Step 1a  resolve_infra_vars        → catalog, schema, scope, warehouse, M2M keys, scopes
Step 1b  ensure_http_connection     → (skipped, pre-Bundle 2)
Step 1c  deploy_bundle              → databricks bundle deploy --target dev
Step 1c' ensure_post_deploy_run     → force-runs post_deploy_setup if job_run didn't fire
Step 1d  check_m2m_credentials      → client_id + client_secret present, token exchange verified
Step 1e  report_secret_scope_keys   → wrote workspace_url; 2 admin keys missing (expected)
```

## post_deploy_setup job tasks (auto-triggered)

```
setup_job_params                 SUCCESS   (patches feedback_pipeline)
check_run_setup                  SUCCESS
ensure_m2m_service_principal     SUCCESS   (SPN + token verified)
check_m2m_token_verified         SUCCESS   (gate for smoke test)
smoke_test_genie_one_mcp         SUCCESS   (initialize + tools/list + genie_ask + poll)
setup_secrets                    SUCCESS   (wrote workspace_url, JSON report)
setup_genie_automation           SUCCESS   (Genie Code automation created)
setup_cdf_config                 DISABLED  (post-Bundle 2)
setup_gateway_connection         DISABLED  (post-Bundle 2)
setup_app_role_sp                DISABLED  (post-Bundle 2)
```

---

## Known issues / expected failures

| Issue | Status | Resolution |
| --- | --- | --- |
| MCP service `ground_truth_mcp` errors on every deploy | Expected | Moving to Bundle 2 after AppKit stitching |
| `slack_webhook_url` / `teams_webhook_url` missing from scope | Expected | Admin-provisioned when C7 Notification Service is built |
| `genie_task` stripped by DAB validator | Known Beta limitation | Workaround: `notebook_task` placeholder + runtime patching via `setup_job_params` |

## What's NOT in this PR

- Bundle 2 (App) and Bundle 3 (Agent) — empty scaffolds only
- HTTP connection + MCP service creation (post-Bundle 2)
- Lakebase migrations (owned by Bundle 2)
- Group B notebook implementations (`setup_gateway_connection`, `setup_app_role_sp`, `setup_cdf_config`)

---

## How to test

```bash
# From the solution root
./deploy.sh --target dev --infra --run-setup

# Or manually:
cd ground-truth-infra
databricks bundle deploy --target dev
databricks bundle run post_deploy_setup --target dev --params run_setup=true
```

Expected: all Group A tasks succeed, smoke test passes, key report shows 3 present + 2 missing admin keys.

---

## Dev SPN (created during this branch)

- Display name: `semantic-ground-truth-m2m-dev`
- Application ID: `16f8923c-a948-4f0e-b00a-f54ad3f6b1f9`
- Workspace object ID: `71862687979431`
- Secret scope: `semantic_ground_truth_credentials`
- Keys: `m2m_client_id_dev`, `m2m_client_secret_dev` (scoped `apps ai-gateway`)
- Token verified: HTTP 200, Genie One MCP reachable
