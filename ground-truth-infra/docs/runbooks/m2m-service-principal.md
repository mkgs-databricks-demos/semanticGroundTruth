# Runbook: M2M Service Principal (OAuth Secret Provisioning)

**Plan:** `docs/plans/m2m_service_principal_plan.md`
**Notebook:** `src/notebooks/ensure_m2m_service_principal.py`
**Scope:** `semantic_ground_truth_credentials` (workspace secret scope)

---

## Prerequisites

- `./deploy.sh --target dev --infra --run-setup` has run at least once.
- The `ensure_m2m_service_principal` task created the SPN and stored its `client_id`.
- You are a **workspace admin** (or account admin) on `fevm-hls-fde`.

## Identifying the SPN

The SPN display name is `semantic-ground-truth-m2m-<target>`, where `<target>` is the bundle target (`${bundle.target}`). Secret key names follow the same convention: `m2m_client_id_<target>` / `m2m_client_secret_<target>`.

| Target | SPN Display Name | Client secret key |
|--------|------------------|-------------------|
| dev | `semantic-ground-truth-m2m-dev` | `m2m_client_secret_dev` |
| prod | `semantic-ground-truth-m2m-prod` | `m2m_client_secret_prod` |

To confirm the SPN exists:

```bash
databricks service-principals list --filter 'displayName eq "semantic-ground-truth-m2m-dev"' --output json
```

---

## Step 1: Generate the OAuth Secret

**Each SPN can have at most 5 active secrets. Each secret is valid for up to 730 days.**

**Scoped secrets:** The secret's API scopes must match `var.m2m_oauth_scopes` in `databricks.yml` (currently `apps ai-gateway`). Scopes are set at generation time and **cannot be changed afterward** — to use different scopes, generate a new secret. The token request and connection DDL both use the same variable, so they stay in sync.

### Option A: Workspace UI

1. Settings > Identity and access > Service principals > Manage
2. Select the SPN (`semantic-ground-truth-m2m-<target>`)
3. Secrets tab > **Generate secret**
4. Set lifetime (up to 730 days)
5. Under Scope, select **Other APIs** and check the scopes matching `var.m2m_oauth_scopes`:
   - Current default: **`apps`** + **`ai-gateway`** (`apps` = connection calls the Bundle 2 app; `ai-gateway` = SPN calls Unity Gateway MCP services such as Genie One `system.ai.genie_one_mcp` and `ground_truth_mcp`)
   - When Bundle 2 adds OBO `user_api_scopes`: add those too (e.g. `sql`, `catalog.tables:read`)
   - **Never select `authentication`** (it can mint tokens with any scope)
6. Click **Generate**
7. **Copy the secret immediately** (it is shown only once)
8. Note the client ID (same as the SPN's application_id)

### Option B: CLI

Use the workspace-level `service-principal-secrets-proxy` command group.
Pass the SPN **workspace object ID** (the `id` field, not `application_id`).

```bash
databricks service-principal-secrets-proxy create <spn_workspace_object_id>
```

The CLI returns both the secret value and the credential ID.

> **Note:** The CLI `service-principal-secrets-proxy create` does not currently support scope selection. Use the UI for scoped secrets.

---

## Step 2: Store the Secret in the Bundle Scope

**Use the interactive prompt to keep the value out of shell history.**

Dev target:

```bash
databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_dev
```

Prod target:

```bash
databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_prod
```

The CLI will prompt for the value. Paste the secret and press Enter, then Ctrl+D.

---

## Step 3: Verify

```bash
./deploy.sh --target dev --infra --run-setup
```

The `ensure_m2m_service_principal` task should log:

```
Client secret present:   YES
M2M SPN verification: PASSED (HTTP 200)
```

If it logs `M2M SPN OAuth verification failed with status 401`, the secret is incorrect or expired. Regenerate and re-store.

---

## Secret Rotation

1. **Generate a new secret** (Step 1). The SPN can have up to 5 active secrets simultaneously.
2. **Overwrite the same scope key** (Step 2). The new value replaces the old.
3. **Verify** (Step 3). Confirm token exchange passes.
4. **Retire the old secret** in the workspace UI (SPN > Secrets > remove old credential).

**Rotation cadence:** before the secret's expiry date. Track expiry in the team calendar.

## Expanding Scopes (OBO / Bundle 2)

When Bundle 2 declares `user_api_scopes` for OBO, the M2M secret needs a wider scope set. Scopes can't be changed on an existing secret.

1. **Update `var.m2m_oauth_scopes`** in `databricks.yml` to include the new scopes (e.g. `apps sql catalog.tables:read`).
2. **Generate a new secret** (Step 1) with the expanded scopes. Use **Clone** on the Secrets tab to copy the existing secret's lifetime as a starting point, then add the new scopes.
3. **Overwrite the same scope key** (Step 2) with the new secret value.
4. **Verify** (Step 3). The token request uses `var.m2m_oauth_scopes`, which now matches the secret.
5. **Delete the old secret** on the SPN's Secrets tab.
6. **Check the connection:** If `setup_gateway_connection` has already created the Unity Gateway HTTP connection, verify it picks up the new secret value. If not (it may cache the token), run `ALTER CONNECTION` or drop and recreate.

### OBO grants

The M2M SPN also needs Unity Catalog and warehouse grants for OBO:

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO `<spn_application_id>`;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO `<spn_application_id>`;
GRANT SELECT ON SCHEMA <catalog>.<schema> TO `<spn_application_id>`;
-- If any MCP tool writes (e.g. feedback staging):
GRANT MODIFY ON TABLE <catalog>.<schema>.<table> TO `<spn_application_id>`;
```

Plus `CAN_USE` on the SQL warehouse (via Permissions tab or `w.warehouses.set_permissions()`).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `PermissionError: not a workspace admin` | Job runner isn't admin | Run as workspace admin or add runner to `admins` group |
| `M2M SPN OAuth verification failed (HTTP 401)` | Secret expired or wrong | Regenerate and re-store |
| `M2M SPN verification: SKIPPED` | Secret key not in scope yet | Complete Steps 1 and 2 |
| `client_secret exists but could not be read` | Scope ACL denies runner READ | Ensure runner has MANAGE on the scope |
| Connection creation fails after Bundle 2 | Secret not provisioned or SPN lacks CAN_USE | Complete Steps 1-3, then grant CAN_USE on the app |

---

## Teardown

The SPN is **not** managed by bundle state (`bundle destroy` won't remove it).
To clean up, use the workspace UI: Settings > Identity and access > Service principals > find the SPN > remove it.
Also remove the corresponding `m2m_client_id_*` and `m2m_client_secret_*` keys from the secret scope via the CLI `secrets` commands or the admin notebook.
