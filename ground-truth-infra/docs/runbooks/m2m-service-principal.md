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

The SPN display name is `semantic-ground-truth-m2m-<schema>`, where `<schema>` is the resolved UC schema name.

| Target | Schema | SPN Display Name |
|--------|--------|------------------|
| dev | `dev_matthew_giglia_semantic_ground_truth` | `semantic-ground-truth-m2m-dev_matthew_giglia_semantic_ground_truth` |
| prod | `semantic_ground_truth` | `semantic-ground-truth-m2m-semantic_ground_truth` |

To confirm the SPN exists:

```bash
databricks service-principals list --filter 'displayName eq "semantic-ground-truth-m2m-dev_matthew_giglia_semantic_ground_truth"' --output json
```

---

## Step 1: Generate the OAuth Secret

**Each SPN can have at most 5 active secrets. Each secret is valid for up to 730 days.**

### Option A: Workspace UI

1. Settings > Identity and access > Service principals > Manage
2. Select the SPN (`semantic-ground-truth-m2m-<schema>`)
3. Secrets tab > **Generate secret**
4. Set lifetime (up to 730 days)
5. Under Scopes, select `all APIs` (or restrict to `sql`, `serving` if narrower scope works)
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

---

## Step 2: Store the Secret in the Bundle Scope

**Use the interactive prompt to keep the value out of shell history.**

Dev target:

```bash
databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_dev_matthew_giglia_semantic_ground_truth
```

Prod target:

```bash
databricks secrets put-secret semantic_ground_truth_credentials m2m_client_secret_semantic_ground_truth
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
