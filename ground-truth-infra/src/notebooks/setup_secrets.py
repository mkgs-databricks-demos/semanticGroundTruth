# Databricks notebook source
# MAGIC %md
# MAGIC # Setup Secrets
# MAGIC Populates infra-derived key-values in the workspace secret scope.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md`, lakeLoom pattern
# MAGIC
# MAGIC **Scope:** Created declaratively by `ground_truth_scope.secret_scope.yml`
# MAGIC
# MAGIC **Keys written here (infra-derived, idempotent):**
# MAGIC - `workspace_url` — Databricks workspace host URL
# MAGIC
# MAGIC **Keys checked only (never written or read here):**
# MAGIC - `m2m_client_id_<target>` — written by `ensure_m2m_service_principal`
# MAGIC - `m2m_client_secret_<target>` — admin-provisioned (see runbook)
# MAGIC - `slack_webhook_url`, `teams_webhook_url` — admin-provisioned, C7 Notification Service
# MAGIC
# MAGIC **Output:** a JSON key report via `dbutils.notebook.exit()` (read by `deploy.sh`
# MAGIC with `databricks jobs get-run-output`) plus task values. Missing keys are
# MAGIC reported, not fatal. Only key names are listed — secret values are never read.

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# --- Read Job Parameters ---
dbutils.widgets.text("secret_scope", "", "Secret scope name")
dbutils.widgets.text("workspace_url", "", "Workspace URL")
dbutils.widgets.text("m2m_client_id_dbs_key", "", "Secret key for M2M client_id")
dbutils.widgets.text("m2m_client_secret_dbs_key", "", "Secret key for M2M client_secret")
dbutils.widgets.text("admin_keys", "slack_webhook_url,teams_webhook_url", "Other admin-provisioned keys (comma-separated)")

secret_scope = dbutils.widgets.get("secret_scope").strip()
workspace_url = dbutils.widgets.get("workspace_url").strip().rstrip("/")
m2m_client_id_dbs_key = dbutils.widgets.get("m2m_client_id_dbs_key").strip()
m2m_client_secret_dbs_key = dbutils.widgets.get("m2m_client_secret_dbs_key").strip()
admin_keys = [k.strip() for k in dbutils.widgets.get("admin_keys").split(",") if k.strip()]

if not secret_scope:
    raise ValueError("secret_scope is required")
if not workspace_url:
    raise ValueError("workspace_url is required")
if not workspace_url.startswith("https://"):
    workspace_url = f"https://{workspace_url}"

print(f"secret_scope={secret_scope}")
print(f"workspace_url={workspace_url}")
print(f"m2m_client_id_dbs_key={m2m_client_id_dbs_key or '(not set)'}")
print(f"m2m_client_secret_dbs_key={m2m_client_secret_dbs_key or '(not set)'}")
print(f"admin_keys={admin_keys}")

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

from secret_scope import list_secret_keys, put_secret

print(f"Loaded lib from: {lib_path}")

# COMMAND ----------

# --- Write infra-derived keys (idempotent) ---
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

infra_keys = {
    "workspace_url": workspace_url,
}

keys_written = []
for key, value in infra_keys.items():
    put_secret(w, secret_scope, key, value)
    keys_written.append(key)
    print(f"Wrote {key} = {value}")

# COMMAND ----------

# --- Check expected keys (names only; values are never read) ---
# Expected key -> (who provisions it, what to do if missing)
expected = {
    "workspace_url": ("setup_secrets", "Re-run post_deploy_setup"),
}
if m2m_client_id_dbs_key:
    expected[m2m_client_id_dbs_key] = (
        "ensure_m2m_service_principal",
        "Deploy with --run-setup; check the ensure_m2m_service_principal task",
    )
if m2m_client_secret_dbs_key:
    expected[m2m_client_secret_dbs_key] = (
        "admin",
        f"Generate an OAuth secret for the M2M SPN, then: "
        f"databricks secrets put-secret {secret_scope} {m2m_client_secret_dbs_key}",
    )
for key in admin_keys:
    expected.setdefault(
        key,
        ("admin", f"databricks secrets put-secret {secret_scope} {key}"),
    )

present_keys = list_secret_keys(w, secret_scope)

keys_present = sorted(k for k in expected if k in present_keys)
keys_missing = [
    {"key": k, "provisioned_by": who, "action": action}
    for k, (who, action) in expected.items()
    if k not in present_keys
]
keys_unexpected = sorted(present_keys - set(expected))

print(f"Scope '{secret_scope}': {len(present_keys)} key(s)")
for k in expected:
    status = "present" if k in present_keys else "MISSING"
    print(f"  {status:<8} {k:<40} ({expected[k][0]})")
for k in keys_unexpected:
    print(f"  {'extra':<8} {k:<40} (not managed by this bundle)")

if keys_missing:
    print(f"\n{len(keys_missing)} key(s) missing:")
    for m in keys_missing:
        print(f"  - {m['key']}: {m['action']}")
else:
    print("\nAll expected keys present.")

# COMMAND ----------

# --- Task values + exit report (read by deploy.sh) ---
import json

missing_names = [m["key"] for m in keys_missing]

dbutils.jobs.taskValues.set(key="secret_keys_written", value=",".join(keys_written))
dbutils.jobs.taskValues.set(key="secret_keys_missing", value=",".join(missing_names))
dbutils.jobs.taskValues.set(key="secret_keys_missing_count", value=str(len(keys_missing)))

report = {
    "scope": secret_scope,
    "written": keys_written,
    "present": keys_present,
    "missing": keys_missing,
    "unexpected": keys_unexpected,
}
print(json.dumps(report, indent=2))
dbutils.notebook.exit(json.dumps(report))
