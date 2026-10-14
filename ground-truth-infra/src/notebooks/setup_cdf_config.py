# Databricks notebook source
# MAGIC %md
# MAGIC # Setup CDF Config
# MAGIC Configures Lakebase Lakehouse Sync (CDF replication from Postgres to Delta).
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md` Task 5
# MAGIC
# MAGIC **SDK:** `w.postgres.create_cdf_config()`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

dbutils.widgets.text("catalog", "", "Target catalog")
dbutils.widgets.text("schema", "", "Target schema")
dbutils.widgets.text("lakebase_branch_id", "", "Lakebase branch resource name")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
lakebase_branch_id = dbutils.widgets.get("lakebase_branch_id")

print(f"catalog={catalog}, schema={schema}, lakebase_branch_id={lakebase_branch_id}")

# COMMAND ----------

# TODO: Implement
# 1. Check if CDF config already exists: w.postgres.list_cdf_configs(parent=branch_id)
# 2. If not: w.postgres.create_cdf_config(parent=branch_id, cdf_config=CdfConfig(...))
# 3. Wait for operation: operation.wait()
raise NotImplementedError("setup_cdf_config: scaffold only — implementation pending")
