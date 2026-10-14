# Databricks notebook source
# MAGIC %md
# MAGIC # Setup App Role Service Principal
# MAGIC Updates the Lakebase app_role identity to SERVICE_PRINCIPAL for the Bundle 2 app.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md` Task 6
# MAGIC
# MAGIC **SDK:** `w.postgres.update_role()`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

dbutils.widgets.text("role_resource_name", "", "Lakebase role resource name")
dbutils.widgets.text("app_sp_client_id", "", "Bundle 2 app service principal client ID")

role_resource_name = dbutils.widgets.get("role_resource_name")
app_sp_client_id = dbutils.widgets.get("app_sp_client_id")

print(f"role_resource_name={role_resource_name}, app_sp_client_id={app_sp_client_id}")

# COMMAND ----------

# TODO: Implement
# 1. w.postgres.update_role(name=role_resource_name, role=Role(spec=RoleRoleSpec(
#        identity_type=RoleIdentityType.SERVICE_PRINCIPAL,
#        postgres_role=app_sp_client_id)),
#    update_mask=FieldMask(paths=["spec.identity_type", "spec.postgres_role"]))
# 2. Wait: operation.wait()
raise NotImplementedError("setup_app_role_sp: scaffold only — implementation pending")
