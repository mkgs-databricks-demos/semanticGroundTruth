# Databricks notebook source
# MAGIC %md
# MAGIC # Setup Secrets
# MAGIC Populates infra-derived key-values in the workspace secret scope.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md`, lakeLoom pattern
# MAGIC
# MAGIC **Scope:** Created declaratively by `ground_truth_scope.secret_scope.yml`
# MAGIC
# MAGIC **Keys populated here (infra-derived, idempotent):**
# MAGIC - `workspace_url` — Databricks workspace host URL
# MAGIC
# MAGIC **Keys populated manually / by deploy.sh (admin-provisioned):**
# MAGIC - `slack_webhook_url` — Slack incoming webhook for C7 Notification Service
# MAGIC - `teams_webhook_url` — Teams incoming webhook for C7 Notification Service
# MAGIC
# MAGIC **API:** `databricks secrets put-secret <scope> <key> --string-value <value>`
# MAGIC **SDK:** `w.secrets.put_secret(scope, key, string_value)`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

dbutils.widgets.text("secret_scope", "", "Secret scope name")
dbutils.widgets.text("workspace_url", "", "Workspace URL")

secret_scope = dbutils.widgets.get("secret_scope")
workspace_url = dbutils.widgets.get("workspace_url")

print(f"secret_scope={secret_scope}, workspace_url={workspace_url}")

# COMMAND ----------

# TODO: Implement
# 1. from databricks.sdk import WorkspaceClient
# 2. w = WorkspaceClient()
# 3. Infra-derived keys (idempotent put_secret):
#    w.secrets.put_secret(scope=secret_scope, key="workspace_url", string_value=workspace_url)
# 4. Log which keys were written
# 5. Skip admin-provisioned keys (slack_webhook_url, teams_webhook_url) —
#    those are populated manually or by deploy.sh
raise NotImplementedError("setup_secrets: scaffold only — implementation pending")
