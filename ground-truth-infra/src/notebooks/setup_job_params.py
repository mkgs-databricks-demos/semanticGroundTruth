# Databricks notebook source
# MAGIC %md
# MAGIC # Setup Job Params
# MAGIC Patches the feedback_pipeline job to wire the genie_task configuration_id from setup_genie_automation.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md` Task 2, `docs/plans/feedback_pipeline_rework_plan.md`
# MAGIC
# MAGIC **API:** `POST /api/2.1/jobs/reset`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parameters

# COMMAND ----------

dbutils.widgets.text("feedback_job_id", "", "Feedback pipeline job ID")
dbutils.widgets.text("catalog", "", "Target catalog")
dbutils.widgets.text("schema", "", "Target schema")

feedback_job_id = dbutils.widgets.get("feedback_job_id")
catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")

print(f"feedback_job_id={feedback_job_id}, catalog={catalog}, schema={schema}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read configuration_id from upstream task

# COMMAND ----------

# Read the automation's configuration_id set by setup_genie_automation (Task 1).
configuration_id = dbutils.jobs.taskValues.get(
    taskKey="setup_genie_automation",
    key="configuration_id",
    default="",
)

if not configuration_id:
    raise ValueError(
        "configuration_id is empty — setup_genie_automation must run first "
        "and emit this value via taskValues."
    )

print(f"configuration_id: {configuration_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Get current job definition

# COMMAND ----------

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

job = w.api_client.do(
    "GET", "/api/2.1/jobs/get",
    query={"job_id": feedback_job_id},
)

tasks = job["settings"]["tasks"]
task_keys = [t["task_key"] for t in tasks]
print(f"Job '{job['settings']['name']}' has {len(tasks)} tasks: {task_keys}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Replace create_feature_branch with genie_task

# COMMAND ----------

# Build the replacement genie_task.
# Per docs/plans/feedback_pipeline_rework_plan.md:
# - genie_task manages its own compute (no environment_key)
# - {{catalog}} and {{schema}} placeholders resolved from parameters at runtime
# - Timeout 30 min, health alert at 10 min
TASK_KEY = "create_feature_branch"

genie_task_def = {
    "task_key": TASK_KEY,
    "description": "Genie Code reads feedback staging, generates YAML edits, creates Git feature branch",
    "depends_on": [{"task_key": "collect_feedback"}],
    "genie_task": {
        "configuration_id": configuration_id,
        "parameters": {
            "catalog": catalog,
            "schema": schema,
        },
    },
    "timeout_seconds": 1800,
    "health": {
        "rules": [
            {
                "metric": "RUN_DURATION_SECONDS",
                "op": "GREATER_THAN",
                "value": 600,
            }
        ]
    },
}

# Find and replace the target task in the tasks list.
replaced = False
for i, task in enumerate(tasks):
    if task["task_key"] == TASK_KEY:
        old_type = "notebook_task" if "notebook_task" in task else "genie_task"
        tasks[i] = genie_task_def
        replaced = True
        print(f"Replaced task '{TASK_KEY}' (was {old_type}) with genie_task")
        break

if not replaced:
    # Task doesn't exist yet — append it
    tasks.append(genie_task_def)
    print(f"Appended new genie_task '{TASK_KEY}'")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Update the job via jobs/reset

# COMMAND ----------

# Preserve all existing settings, only replace the tasks array.
settings = job["settings"]
settings["tasks"] = tasks

w.api_client.do(
    "POST", "/api/2.1/jobs/reset",
    body={
        "job_id": int(feedback_job_id),
        "new_settings": settings,
    },
)
print(f"Updated job {feedback_job_id} with genie_task")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validate

# COMMAND ----------

updated_job = w.api_client.do(
    "GET", "/api/2.1/jobs/get",
    query={"job_id": feedback_job_id},
)

updated_tasks = updated_job["settings"]["tasks"]
target_task = next(
    (t for t in updated_tasks if t["task_key"] == TASK_KEY),
    None,
)

assert target_task is not None, f"Task '{TASK_KEY}' not found after update"
assert "genie_task" in target_task, (
    f"Task '{TASK_KEY}' is not a genie_task: {list(target_task.keys())}"
)
assert target_task["genie_task"]["configuration_id"] == configuration_id, (
    f"configuration_id mismatch: expected {configuration_id}, "
    f"got {target_task['genie_task']['configuration_id']}"
)

print("Validation passed:")
print(f"  task_key:         {TASK_KEY}")
print(f"  configuration_id: {target_task['genie_task']['configuration_id']}")
print(f"  parameters:       {target_task['genie_task'].get('parameters', {})}")
print(f"  timeout_seconds:  {target_task.get('timeout_seconds')}")
print(f"setup_job_params complete")
