# Databricks notebook source
# MAGIC %md
# MAGIC # Setup Gateway Connection
# MAGIC Creates or updates the Unity Gateway HTTP connection for the MCP server.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md` Task 4, `docs/runbooks/unity-gateway-setup.md`
# MAGIC
# MAGIC **SDK:** `w.connections.create()`, `w.connections.update()`, `w.grants.update()`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

dbutils.widgets.text("connection_name", "semantic-ground-truth-mcp", "Connection name")
dbutils.widgets.text("app_url", "", "App URL (from Bundle 2)")
dbutils.widgets.text("base_path", "/mcp", "MCP endpoint base path")

connection_name = dbutils.widgets.get("connection_name")
app_url = dbutils.widgets.get("app_url")
base_path = dbutils.widgets.get("base_path")

print(f"connection_name={connection_name}, app_url={app_url}, base_path={base_path}")

# COMMAND ----------

# TODO: Implement
# 1. Try w.connections.get(connection_name) — if exists, update with real app_url
# 2. If not: w.connections.create(name, ConnectionType.HTTP, options={...})
# 3. Grant USE CONNECTION: w.grants.update("connection", connection_name, ...)
# 4. dbutils.jobs.taskValues.set(key="connection_name", value=connection_name)
raise NotImplementedError("setup_gateway_connection: scaffold only — implementation pending")
