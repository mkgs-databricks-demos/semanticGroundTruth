# M2M Service Principal Plan (Ground Truth OAuth M2M Identity)

**Status:** DRAFT — for review
**Bundle:** `ground-truth-infra` (Bundle 1), with follow-on work in `ground-truth-app` (Bundle 2)
**Reference pattern:** lakeLoom infra — `lakeLoom/lakeloom-infra/src/platform_bootstrap/ensure-service-principal`, `src/lib/service_principal.py`, `src/lib/secret_scope.py`, `src/admin_actions/set-databricks-secrets`, `resources/platform_bootstrap.job.yml`
**Related plans:** `docs/plans/post_deploy_automation_plan.md`, `docs/runbooks/unity-gateway-setup.md`

---

## 1. Purpose

Create a dedicated, bundle-owned service principal (SPN) that acts as a representative **OAuth M2M caller** for the Semantic Ground Truth solution. Its `client_id` and `client_secret` live in the bundle's workspace secret scope (`${var.secret_scope_name}` = `semantic_ground_truth_credentials`).

The SPN serves two purposes:

1. **API-layer testing** — a non-human identity that integration tests (and later CI) use to call the Bundle 2 app's REST and `/mcp` endpoints with a real M2M token.
2. **MCP / Genie One bootstrap** — the credential pair referenced by the Unity Gateway HTTP connection (`CREATE CONNECTION ... client_id secret(...), client_secret secret(...)`), which backs the `ground_truth_mcp` `mcp_service` resource surfaced in Genie One.

### Why this unblocks the MCP service

The current design (`deploy.sh` header, `ground_truth_mcp.mcp_service.yml` header, PROJECT_MEMORY fix #10) assumes the connection uses the **app's** SPN credentials after Bundle 2 deploys. That is problematic: Databricks Apps auto-provision their SPN, and nobody holds a client secret for it. A bundle-owned M2M SPN created in Bundle 1 gives us credentials we control, so the only remaining Bundle 2 dependency for the connection is the app URL and the `CAN_USE` grant.

---

## 2. Target Flow

```
./deploy.sh --target dev --infra --run-setup
  │
  ├─ bundle deploy (ground-truth-infra)
  │    └─ job_run: run_post_deploy → post_deploy_setup
  │         ├─ check_run_setup (gate)
  │         ├─ setup_secrets                     (existing, Group A)
  │         ├─ ensure_m2m_service_principal      (NEW, Group A)
  │         │    ├─ find-or-create SPN by display name (workspace admin SDK)
  │         │    ├─ put_secret(<m2m_client_id_key>, application_id)
  │         │    ├─ check <m2m_client_secret_key> presence
  │         │    ├─ if present → verify /oidc/v1/token client_credentials
  │         │    └─ taskValues: m2m_spn_application_id, m2m_secret_present
  │         ├─ setup_genie_automation / setup_job_params (existing)
  │         └─ check_bundle2_ready → Group B (connection uses M2M SPN creds)
  │
  └─ deploy.sh post-check: check_m2m_credentials()
       ├─ client_id key present?     → ok
       └─ client_secret key missing? → warn + print ADMIN ACTION block (non-fatal)

Workspace admin (one-time, then on rotation):
  1. Generate OAuth secret for the SPN (UI or CLI)
  2. Store it in the scope under <m2m_client_secret_key>
  3. Re-run: ./deploy.sh --target dev --infra --run-setup  (verifies token exchange)

Bundle 2 (later):
  post-process job: grant CAN_USE on the app to the M2M SPN
  → then setup_gateway_connection creates the HTTP connection with the M2M creds
  → re-deploy infra to register the mcp_service
```

---

## 3. Naming and Secret Key Contract

Both `dev` and `prod` targets point at the **same workspace** (`fevm-hls-fde`) and the **same scope name** (`semantic_ground_truth_credentials`). Keys and SPN names must therefore be schema-qualified to avoid collisions (same convention as lakeLoom / scAuditor).

| Item | Value (dev) | Value (prod) |
|------|-------------|--------------|
| SPN display name | `semantic-ground-truth-m2m-dev_matthew_giglia_semantic_ground_truth` | `semantic-ground-truth-m2m-semantic_ground_truth` |
| Client ID key | `m2m_client_id_dev_matthew_giglia_semantic_ground_truth` | `m2m_client_id_semantic_ground_truth` |
| Client secret key | `m2m_client_secret_dev_matthew_giglia_semantic_ground_truth` | `m2m_client_secret_semantic_ground_truth` |
| Who writes client ID | `ensure_m2m_service_principal` task (automated) | same |
| Who writes client secret | Workspace admin (manual) | same |

The SPN display name is derived in the notebook from the resolved schema name (`${resources.schemas.ground_truth_schema.name}`), so no new per-target values are needed beyond the key variables.

### New bundle variables (`databricks.yml`)

```yaml
variables:
  m2m_spn_prefix:
    description: "Display-name prefix for the bundle-owned OAuth M2M service principal"
    default: semantic-ground-truth-m2m
  m2m_client_id_dbs_key:
    description: "Secret scope key holding the M2M SPN application_id (auto-provisioned)"
  m2m_client_secret_dbs_key:
    description: "Secret scope key holding the M2M SPN OAuth secret (admin-provisioned)"

targets:
  dev:
    variables:
      m2m_client_id_dbs_key: m2m_client_id_dev_matthew_giglia_semantic_ground_truth
      m2m_client_secret_dbs_key: m2m_client_secret_dev_matthew_giglia_semantic_ground_truth
  prod:
    variables:
      m2m_client_id_dbs_key: m2m_client_id_semantic_ground_truth
      m2m_client_secret_dbs_key: m2m_client_secret_semantic_ground_truth
```

These hold key **names**, not secret values, so they do not violate the no-plaintext-default rule (PROJECT_MEMORY fix #7).

---

## 4. Changes — Bundle 1 (`ground-truth-infra`)

### 4.1 Shared library (port from lakeLoom)

| New file | Source | Notes |
|----------|--------|-------|
| `src/lib/__init__.py` | lakeLoom `src/lib/__init__.py` | empty |
| `src/lib/service_principal.py` | lakeLoom `src/lib/service_principal.py` | `get_or_create_service_principal()` (with race-condition re-check), `verify_client_credentials()` (POST `/oidc/v1/token`, `grant_type=client_credentials`, `scope=all-apis`) |
| `src/lib/secret_scope.py` | lakeLoom `src/lib/secret_scope.py` | `put_secret()`, `list_secret_keys()`, `try_get_secret_value()`; `ensure_scope_read_acl()` kept but not used for this SPN |

Import pattern in notebooks: same `sys.path` insert of `../lib` relative to the notebook path as lakeLoom's `ensure-service-principal` cell 4. `dbutils.library.restartPython()` (not `%restart_python`) so local `src/` imports keep working on serverless.

### 4.2 New notebook: `src/notebooks/ensure_m2m_service_principal.py`

Python source notebook (matches the existing `.py` notebooks in `src/notebooks/`). Cells:

1. **Install latest Databricks SDK** — `%pip install --upgrade databricks-sdk` + `dbutils.library.restartPython()`
2. **Read job parameters** — `schema_use`, `secret_scope_name`, `m2m_spn_prefix`, `m2m_client_id_dbs_key`, `m2m_client_secret_dbs_key`, `workspace_url`
3. **Load `src/lib`**
4. **Preflight: caller is workspace admin** — `w.current_user.me()` and check membership in `admins` group; fail with a clear message if not (SPN creation requires workspace admin)
5. **Find or create SPN** — display name `f"{m2m_spn_prefix}-{schema_use}"`; `get_or_create_service_principal(w, display_name)`; log `application_id`, workspace object `id`, `created_this_run`
6. **Provision client ID** — `put_secret(w, scope, m2m_client_id_dbs_key, spn.application_id)` (idempotent overwrite)
7. **Check admin-provisioned secret** — `m2m_client_secret_dbs_key in list_secret_keys(w, scope)`
8. **Verify M2M token (if secret present)** — `try_get_secret_value()` then `verify_client_credentials()`; raise on non-2xx so a stale/rotated secret fails loudly; mark `skipped` if not yet provisioned
9. **No secret scope ACL for the SPN** — explicit comment (lakeLoom cell 9 pattern): the M2M SPN never reads the scope; only the job runner (creating the connection) and admins do
10. **Task values** — `m2m_spn_application_id`, `m2m_spn_object_id`, `m2m_secret_present` (`"true"`/`"false"`), `m2m_token_verified`
11. **Summary + ADMIN ACTION block** — when secret missing, print the exact two-step instructions from Section 6 with resolved scope/key/SPN values

The task must **not fail** when the secret is missing — the deploy stays graceful. It only fails if (a) caller isn't admin, (b) SPN create fails, or (c) a present secret fails token exchange.

### 4.3 `resources/jobs/post_deploy_setup.job.yml`

Add job parameters and a Group A task:

```yaml
parameters:
  - name: m2m_client_id_dbs_key
    default: "${var.m2m_client_id_dbs_key}"
  - name: m2m_client_secret_dbs_key
    default: "${var.m2m_client_secret_dbs_key}"

tasks:
  - task_key: ensure_m2m_service_principal
    description: "Find or create the bundle-owned OAuth M2M SPN; store client_id; verify secret if present"
    depends_on:
      - task_key: check_run_setup
        outcome: "true"
    notebook_task:
      notebook_path: ../../src/notebooks/ensure_m2m_service_principal.py
      base_parameters:
        schema_use: "${resources.schemas.ground_truth_schema.name}"
        secret_scope_name: "${resources.secret_scopes.ground_truth_secret_scope.name}"
        m2m_spn_prefix: "${var.m2m_spn_prefix}"
        m2m_client_id_dbs_key: "{{job.parameters.m2m_client_id_dbs_key}}"
        m2m_client_secret_dbs_key: "{{job.parameters.m2m_client_secret_dbs_key}}"
        workspace_url: "${workspace.host}"
    environment_key: serverless
```

Group B wiring change: `setup_gateway_connection` gains `depends_on: ensure_m2m_service_principal` and receives `client_id_key` / `client_secret_key` + `m2m_secret_present` task value. Add a second condition gate (`check_m2m_secret_present`, `EQUAL_TO "true"`) so the connection task is skipped — not failed — when the secret hasn't been provisioned yet.

Revised DAG:

```
check_run_setup
 ├── setup_secrets
 ├── ensure_m2m_service_principal ──┐
 ├── setup_genie_automation → setup_job_params
 └── check_bundle2_ready ──────────┤
                                   ├── check_m2m_secret_present
                                   │     └── setup_gateway_connection
                                   ├── setup_cdf_config
                                   └── setup_app_role_sp
```

### 4.4 `resources/jobs/run_post_deploy.job_run.yml`

Add `+ensure_m2m_service_principal` to the `only:` list so the auto-triggered run includes it.

### 4.5 `resources/secrets/ground_truth_scope.secret_scope.yml`

Comment-only update to the "Keys planned" block: add `m2m_client_id_<schema>` under AUTO-PROVISIONED and `m2m_client_secret_<schema>` under ADMIN-PROVISIONED.

### 4.6 `src/notebooks/setup_gateway_connection.py` (scaffold → impl, separate PR)

Switch the planned credentials source from the app SPN to the M2M SPN:

```sql
CREATE CONNECTION IF NOT EXISTS `semantic-ground-truth-mcp` TYPE HTTP OPTIONS (
  host '<app_url>',
  base_path '/mcp',
  client_id secret('<scope>', '<m2m_client_id_key>'),
  client_secret secret('<scope>', '<m2m_client_secret_key>'),
  oauth_scope 'all-apis',
  token_endpoint '<workspace_url>/oidc/v1/token'
)
```

The `secret()` refs are resolved with the **job runner's** identity, which already has `MANAGE` on the scope.

### 4.7 Header comments

Update the dependency notes in `resources/mcp/ground_truth_mcp.mcp_service.yml` and the `deploy.sh` header to say the connection uses the bundle-owned M2M SPN (not the app SPN).

---

## 5. Changes — `deploy.sh` (solution root)

Graceful, non-fatal credential check after the infra deploy:

1. **`resolve_infra_vars()`** — also emit `M2M_CLIENT_ID_KEY` and `M2M_CLIENT_SECRET_KEY` from `variables.*` in the bundle summary (`safe()` both).
2. **New `check_m2m_credentials()`** — runs after `deploy_bundle "${INFRA_BUNDLE}"` (skipped for `--validate` / `--destroy`):
   - `databricks secrets list-secrets "${SCOPE_NAME}" --output json` → parse key names with `python3`
   - client_id key missing → `warn` "run with `--run-setup` to create the SPN"
   - client_secret key missing → `warn` + print the ADMIN ACTION block (Section 6), resolving the SPN display name and application_id via `databricks service-principals list --filter 'displayName eq "<name>"' --output json`
   - both present → `ok "M2M credentials provisioned"`
   - always returns 0
3. **Usage text** — add an "M2M SPN" step to the *First deployment* section between the infra deploy and the app deploy.

Secret values are never echoed, logged, or passed as CLI args by `deploy.sh`.

---

## 6. Workspace Admin Instructions (printed by notebook + deploy.sh, also in runbook)

New runbook: `docs/runbooks/m2m-service-principal.md`.

**Step 1 — Generate the OAuth secret** (workspace admin or account admin)

* UI: Settings > Identity and access > Service principals > Manage > `<display name>` > Secrets > Generate secret. Lifetime ≤ 730 days. Copy the secret (shown once).
* CLI alternative: `databricks service-principal-secrets-proxy create <spn_workspace_object_id>` (workspace-level command group; SPN must already be in the workspace).

**Step 2 — Store it in the bundle scope** (interactive prompt, keeps the value out of shell history):

```bash
databricks secrets put-secret semantic_ground_truth_credentials <m2m_client_secret_key>
```

Alternative: run the `set-databricks-secrets` admin notebook (ported from lakeLoom `src/admin_actions/`) with the scope and key widgets.

**Step 3 — Verify**

```bash
./deploy.sh --target dev --infra --run-setup
```

`ensure_m2m_service_principal` should log `M2M verification: PASSED (HTTP 200)`.

**Rotation:** generate a new secret (max 5 per SPN), overwrite the same key, re-run step 3, then delete the old secret. Track expiry date in the runbook.

---

## 7. Changes — Bundle 2 (`ground-truth-app`, later)

### 7.1 Grant `CAN_USE` on the app to the M2M SPN

**Option A — post-process job (as requested):** a `post_deploy_app_access` job task in Bundle 2 that:

1. Reads `m2m_client_id` from the scope (or resolves the SPN by display name)
2. `w.apps.update_permissions(app_name, access_control_list=[AppAccessControlRequest(service_principal_name=<application_id>, permission_level=AppPermissionLevel.CAN_USE)])` — additive, idempotent
3. Optionally smoke-tests: mint an M2M token, call `GET <app_url>/api/health` and `POST <app_url>/mcp` (`tools/list`)

**Option B — declarative (alternative to consider):** `deploy.sh` already resolves infra values; it can resolve the M2M SPN `application_id` by display name and pass `--var m2m_spn_application_id=...` to Bundle 2, which declares:

```yaml
resources:
  apps:
    ground_truth_app:
      permissions:
        - service_principal_name: ${var.m2m_spn_application_id}
          level: CAN_USE
```

Option B keeps the grant in bundle state (drift-corrected on every deploy) and removes one notebook. Option A works even when the ID isn't known at deploy time. Recommendation: **B**, with A as fallback.

### 7.2 Sequence after Bundle 2 exists

1. `./deploy.sh --target dev --app` → app deployed, `CAN_USE` granted to M2M SPN
2. `post_deploy_setup` with `app_url` set → `setup_gateway_connection` creates the HTTP connection with M2M creds (validated immediately)
3. `./deploy.sh --target dev --infra` → `ground_truth_mcp` `mcp_service` registers against the now-existing connection
4. Genie One: MCP tools (`review_*`, `campaign_*`, `metric_view_*`) available to `data-engineers` (existing `EXECUTE` grant)

The `deploy.sh` Phase 2 TODO block already lists steps 2–3; this plan supplies the credential that was missing.

---

## 8. Permissions Model (least privilege)

| Principal | Needs | Does NOT get |
|-----------|-------|--------------|
| M2M SPN | `CAN_USE` on the Bundle 2 app (Section 7) | Secret scope READ, workspace admin, UC data grants by default |
| Job runner (dev: Matt; prod: `run_as`) | Workspace admin (SPN create), `MANAGE` on scope (already declared) | — |
| Workspace admin (human) | Generate/rotate OAuth secret | — |
| `data-engineers` | `EXECUTE` on `ground_truth_mcp` (already declared) | — |

**Open question (UC grants):** if the app executes data access **on behalf of the caller** (OBO) rather than as the app SPN, API tests through the M2M SPN will need `USE CATALOG`/`USE SCHEMA`/`SELECT` and `CAN_USE` on the warehouse. Defer until the Bundle 2 auth model (hybrid OBO/SP) is finalized; add as an optional `grant_m2m_uc_access` task if needed.

---

## 9. Design Decisions for Review

1. **Manual secret vs. automated secret generation.** The SDK exposes workspace-level SPN secret creation (`w.service_principal_secrets_proxy.create(...)`, CLI `service-principal-secrets-proxy`). The job could generate the secret and write it straight into the scope, so no human ever sees it. This plan defaults to the **manual admin step** as requested; automated generation is a candidate follow-up (flag: `m2m_auto_generate_secret=false`). Trade-off: automation makes rotation trivial but means the job runner must hold admin on every run, and each run with no secret present would mint a new one (must guard on key presence).
2. **Shared identity in Genie One.** With an M2M connection, every Genie One user hits the app's MCP server **as the M2M SPN**, not as themselves. User attribution inside the app (who approved a card) would then require a passthrough header or a per-user (U2M / OBO) connection. Confirm this is acceptable for the MCP bootstrap, or plan a U2M connection for production.
3. **Scoped OAuth secret.** Databricks supports scoped secrets. The connection DDL uses `oauth_scope 'all-apis'`; test whether calling a Databricks App works with a narrower scope before locking this in.
4. **SPN lifecycle is outside bundle state.** There is no DAB resource type for service principals; `bundle destroy` won't remove it. Add `src/admin_actions/delete_m2m_service_principal.py` (manual) for teardown.
5. **Admin preflight.** Dev runs as Matt (assumed workspace admin). Prod `run_as` is also Matt today; if prod moves to an SPN `run_as`, that SPN needs workspace admin or this task must move to an admin-only job.

---

## 10. Implementation Checklist

| # | Item | File(s) | Bundle |
|---|------|---------|--------|
| 1 | Add `m2m_*` variables + per-target key names | `databricks.yml` | 1 |
| 2 | Port `src/lib/` from lakeLoom | `src/lib/__init__.py`, `service_principal.py`, `secret_scope.py` | 1 |
| 3 | New notebook | `src/notebooks/ensure_m2m_service_principal.py` | 1 |
| 4 | Add task + params + `check_m2m_secret_present` gate | `resources/jobs/post_deploy_setup.job.yml` | 1 |
| 5 | Add to `only:` | `resources/jobs/run_post_deploy.job_run.yml` | 1 |
| 6 | Key docs | `resources/secrets/ground_truth_scope.secret_scope.yml` | 1 |
| 7 | Header comments (M2M SPN as connection creds) | `resources/mcp/ground_truth_mcp.mcp_service.yml`, `deploy.sh` | 1 |
| 8 | `resolve_infra_vars()` + `check_m2m_credentials()` + usage | `deploy.sh` | root |
| 9 | Admin runbook + optional `set-databricks-secrets` port | `docs/runbooks/m2m-service-principal.md`, `src/admin_actions/` | 1 |
| 10 | `bundle validate --target dev` (non-strict; `genie_task` warning is known) | — | 1 |
| 11 | Commit (source-linked deploy needs committed notebooks), deploy with `--run-setup`, confirm SPN + client_id key | — | 1 |
| 12 | Admin provisions secret; re-run; confirm token verification PASSED | — | 1 |
| 13 | `CAN_USE` grant (Option A or B) + smoke test | Bundle 2 | 2 |
| 14 | Implement `setup_gateway_connection.py` with M2M creds; re-deploy infra for `mcp_service` | Bundle 1 | 1 |
| 15 | Update `PROJECT_MEMORY.md` + session summary | `PROJECT_MEMORY.md`, `docs/sessions/` | 1 |

Work happens on a feature branch (`mg-genie-m2m-spn`), never `main`.

---

## 11. Validation

* SPN exists: `databricks service-principals list --filter 'displayName eq "semantic-ground-truth-m2m-<schema>"'`
* Client ID key matches SPN `applicationId`
* Re-running the job is a no-op (`created_this_run: false`, same `application_id`)
* With secret missing: job succeeds, `m2m_secret_present=false`, `setup_gateway_connection` skipped, `deploy.sh` prints the ADMIN ACTION block and exits 0
* With secret present: token exchange HTTP 200; with a bad secret: task fails with the HTTP status
* After Bundle 2: M2M token → app `/mcp` `tools/list` returns the `review_*` / `campaign_*` / `metric_view_*` tools
