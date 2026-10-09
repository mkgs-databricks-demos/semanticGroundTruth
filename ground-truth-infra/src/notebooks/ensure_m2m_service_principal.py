# Databricks notebook source
# MAGIC %md
# MAGIC # Ensure M2M Service Principal
# MAGIC
# MAGIC Creates (or finds) the bundle-owned OAuth M2M service principal for the
# MAGIC Semantic Ground Truth solution. Stores the `client_id` (application_id) in
# MAGIC the workspace secret scope. Verifies the OAuth token exchange if the
# MAGIC admin-provisioned `client_secret` is already present.
# MAGIC
# MAGIC **Design source:** `docs/plans/m2m_service_principal_plan.md`
# MAGIC
# MAGIC **Pattern:** lakeLoom `src/platform_bootstrap/ensure-service-principal`
# MAGIC
# MAGIC **Behavior:**
# MAGIC - Task **succeeds** when the secret is missing (graceful deploy).
# MAGIC - Task **fails** only if: caller isn't workspace admin, SPN create fails,
# MAGIC   or a present secret fails OAuth token exchange.

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# --- Read Job Parameters ---
dbutils.widgets.text("bundle_target", "", "Bundle target (dev, prod)")
dbutils.widgets.text("secret_scope_name", "", "Workspace secret scope name")
dbutils.widgets.text("m2m_spn_prefix", "semantic-ground-truth-m2m", "SPN display name prefix")
dbutils.widgets.text("m2m_client_id_dbs_key", "", "Secret key for M2M client_id")
dbutils.widgets.text("m2m_client_secret_dbs_key", "", "Secret key for M2M client_secret")
dbutils.widgets.text("workspace_url", "", "Workspace URL")

bundle_target = dbutils.widgets.get("bundle_target")
secret_scope_name = dbutils.widgets.get("secret_scope_name")
m2m_spn_prefix = dbutils.widgets.get("m2m_spn_prefix")
m2m_client_id_dbs_key = dbutils.widgets.get("m2m_client_id_dbs_key")
m2m_client_secret_dbs_key = dbutils.widgets.get("m2m_client_secret_dbs_key")
workspace_url = dbutils.widgets.get("workspace_url")

print(f"bundle_target={bundle_target}")
print(f"secret_scope_name={secret_scope_name}")
print(f"m2m_spn_prefix={m2m_spn_prefix}")
print(f"m2m_client_id_dbs_key={m2m_client_id_dbs_key}")
print(f"m2m_client_secret_dbs_key={m2m_client_secret_dbs_key}")
print(f"workspace_url={workspace_url}")

# COMMAND ----------

# --- Load src/lib ---
import sys
from pathlib import Path

notebook_path = (
    dbutils.notebook.entry_point.getDbutils()
    .notebook()
    .getContext()
    .notebookPath()
    .get()
)
lib_path = str(
    Path("/Workspace")
    / Path(notebook_path).parent.relative_to("/")
    / ".."
    / "lib"
)
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

from service_principal import get_or_create_service_principal, verify_client_credentials
from secret_scope import put_secret, list_secret_keys, try_get_secret_value

print(f"Loaded lib from: {lib_path}")

# COMMAND ----------

# --- Preflight: Caller is workspace admin ---
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
workspace_url = workspace_url or w.config.host.rstrip("/")

current_user = w.current_user.me()
user_groups = {g.display for g in (current_user.groups or [])}

if "admins" not in user_groups:
    raise PermissionError(
        f"Current user '{current_user.user_name}' is not a workspace admin. "
        f"Service principal creation requires workspace admin privileges. "
        f"Groups: {sorted(user_groups)}"
    )

print(f"Caller: {current_user.user_name} (workspace admin confirmed)")
print(f"Workspace URL: {workspace_url}")

# COMMAND ----------

# --- Find or Create M2M Service Principal ---
# Naming: <prefix>-<bundle.target>, e.g. semantic-ground-truth-m2m-dev
if not bundle_target:
    raise ValueError("bundle_target parameter is required to derive the SPN display name")
spn_display_name = f"{m2m_spn_prefix}-{bundle_target}"
print(f"Target SPN display name: {spn_display_name}")

spn, is_new_spn = get_or_create_service_principal(w, spn_display_name)
spn_application_id = spn.application_id

print(f"Application ID:       {spn_application_id}")
print(f"Workspace object ID:  {spn.id}")
print(f"Created this run:     {is_new_spn}")

# COMMAND ----------

# --- Provision Client ID in Secret Scope ---
put_secret(w, secret_scope_name, m2m_client_id_dbs_key, spn_application_id)
print(f"Stored {m2m_client_id_dbs_key} = {spn_application_id}")

# Check for admin-provisioned client_secret
existing_keys = list_secret_keys(w, secret_scope_name)
m2m_secret_present = m2m_client_secret_dbs_key in existing_keys

print(f"\nAvailable keys:          {sorted(existing_keys)}")
print(f"Client secret present:   {'YES' if m2m_secret_present else 'NO — admin action required'}")

# COMMAND ----------

# --- Verify M2M Token (if client_secret present) ---
m2m_token_verified = False
m2m_verification_status = "skipped"
verification_details = "client_secret not available to this run"

if m2m_secret_present:
    client_secret_value, read_error = try_get_secret_value(
        secret_scope_name, m2m_client_secret_dbs_key
    )
    if client_secret_value:
        ok, status_code, preview = verify_client_credentials(
            workspace_url=workspace_url,
            client_id=spn_application_id,
            client_secret=client_secret_value,
        )
        m2m_token_verified = ok
        m2m_verification_status = f"http_{status_code}"
        verification_details = preview or "token response had empty body"
        if not ok:
            raise RuntimeError(
                f"M2M SPN OAuth verification failed "
                f"with status {status_code}: {preview}"
            )
        print(f"M2M SPN verification: PASSED (HTTP {status_code})")
    else:
        m2m_verification_status = "skipped"
        verification_details = f"client_secret exists but could not be read: {read_error}"
        print(f"M2M SPN verification: SKIPPED — {verification_details}")
else:
    print("M2M SPN verification: SKIPPED — client_secret not yet provisioned")

# COMMAND ----------

# ---------------------------------------------------------------------------
# Secret Scope READ Access — NOT granted to the M2M SPN
#
# The M2M SPN authenticates to the workspace OIDC endpoint and calls the
# Databricks App's API/MCP endpoints. It does NOT read secrets from the
# scope. Only the job runner (who creates the Unity Gateway connection via
# SQL DDL with secret() refs) and workspace admins need scope access.
# ---------------------------------------------------------------------------

print("Secret scope READ: NOT granted to M2M SPN (by design)")
print("  → M2M SPN only needs: CAN_USE on the Bundle 2 app")
print("  → Connection SQL DDL resolves secret() refs with the job runner's identity")

# COMMAND ----------

# --- Output Task Values for Downstream Tasks ---
dbutils.jobs.taskValues.set(key="m2m_spn_application_id", value=spn_application_id)
dbutils.jobs.taskValues.set(key="m2m_spn_object_id", value=str(spn.id))
dbutils.jobs.taskValues.set(key="m2m_secret_present", value=str(m2m_secret_present).lower())
dbutils.jobs.taskValues.set(key="m2m_token_verified", value=str(m2m_token_verified).lower())

print(f"Task values set:")
print(f"  m2m_spn_application_id = {spn_application_id}")
print(f"  m2m_spn_object_id      = {spn.id}")
print(f"  m2m_secret_present     = {str(m2m_secret_present).lower()}")
print(f"  m2m_token_verified     = {str(m2m_token_verified).lower()}")

# COMMAND ----------

# --- Summary ---
import json

summary = {
    "m2m_spn": {
        "display_name": spn_display_name,
        "application_id": spn_application_id,
        "workspace_object_id": spn.id,
        "created_this_run": is_new_spn,
        "client_id_key": m2m_client_id_dbs_key,
        "client_secret_key": m2m_client_secret_dbs_key,
        "client_secret_present": m2m_secret_present,
        "m2m_verification": m2m_verification_status,
        "verification_details": verification_details,
    },
}

print("\n" + "=" * 72)
print(json.dumps(summary, indent=2))
print("=" * 72)

if not m2m_secret_present:
    print("\n" + "!" * 72)
    print("  ADMIN ACTION REQUIRED")
    print("!" * 72)
    print(f"""
  The M2M service principal exists but has no OAuth client secret yet.
  A workspace admin must generate one and store it in the secret scope.

  Step 1 — Generate the OAuth secret:
    Settings > Identity and access > Service principals > Manage
    > '{spn_display_name}' > Secrets > Generate secret
    (Lifetime ≤ 730 days. Copy the secret — it is shown only once.)

    CLI alternative:
      databricks service-principal-secrets-proxy create {spn.id}

  Step 2 — Store it in the bundle scope (interactive prompt):
    databricks secrets put-secret {secret_scope_name} {m2m_client_secret_dbs_key}

  Step 3 — Verify:
    ./deploy.sh --target dev --infra --run-setup
    (should log 'M2M SPN verification: PASSED (HTTP 200)')
""")
    print("!" * 72)
