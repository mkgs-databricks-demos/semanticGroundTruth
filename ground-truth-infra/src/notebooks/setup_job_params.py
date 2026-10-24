# Databricks notebook source
# DBTITLE 1,Setup Job Params
# MAGIC %md
# MAGIC # Setup Job Params
# MAGIC Patches the `feedback_pipeline` job: the `author_feedback_branch` notebook placeholder becomes a `genie_task` with the `configuration_id` from `setup_genie_automation` and `parameters` copied from the placeholder's `base_parameters` (`run_date`, `batch_id`, `branch_prefix`, `feedback_table`, `skill_path`, `repo_path`, `base_branch`; dynamic value references such as `{{tasks.collect_feedback.values.batch_id}}` are kept as-is and resolved by Jobs at run time). Re-running on an already patched job keeps its `genie_task.parameters` and only refreshes `configuration_id`. Exits early (no change) when there is no automation id.
# MAGIC
# MAGIC A `bundle deploy` resets the task to the placeholder, so `post_deploy_setup` runs this after every deploy.
# MAGIC
# MAGIC **Design source:** `docs/plans/27_infra_feedback_pipeline_genie_task.md`, `docs/plans/post_deploy_automation_plan.md` Task 2. Pure helpers are unit-tested in `tests/test_feedback_pipeline.py`.
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

# DBTITLE 1,Read configuration_id (early exit when missing)
# Read the automation's configuration_id set by setup_genie_automation (Task 1).
configuration_id = dbutils.jobs.taskValues.get(
    taskKey="setup_genie_automation",
    key="configuration_id",
    default="",
)

if not configuration_id:
    print("configuration_id is empty (setup_genie_automation did not emit one); leaving the job unchanged.")
    dbutils.notebook.exit("skipped: no configuration_id")

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
# MAGIC ## Replace author_feedback_branch with genie_task

# COMMAND ----------

# DBTITLE 1,Pure helpers
# --- pure helpers (stdlib only; unit-tested in tests/test_feedback_pipeline.py) ---
TASK_KEY = "author_feedback_branch"
REQUIRED_GENIE_PARAMS = (
    "run_date", "batch_id", "branch_prefix", "feedback_table", "skill_path", "repo_path", "base_branch",
)
# Fields that only make sense for a notebook task; a genie_task manages its own compute.
_NOTEBOOK_ONLY_FIELDS = (
    "notebook_task", "genie_task", "environment_key", "libraries",
    "existing_cluster_id", "new_cluster", "job_cluster_key",
)


def to_genie_task(task, configuration_id):
    """Return `task` as a genie_task. Parameters come from the placeholder's base_parameters,
    or from the existing genie_task when the job is already patched. Other settings
    (depends_on, description, timeout, health, run_if) are kept."""
    if "genie_task" in task:
        params = dict(task["genie_task"].get("parameters") or {})
    elif "notebook_task" in task:
        params = dict(task["notebook_task"].get("base_parameters") or {})
    else:
        raise ValueError(f"Task {task.get('task_key')} is neither a notebook placeholder nor a genie_task")
    missing = [k for k in REQUIRED_GENIE_PARAMS if k not in params]
    if missing:
        raise ValueError(f"Task {task.get('task_key')} is missing genie parameters: {missing}")
    patched = {k: v for k, v in task.items() if k not in _NOTEBOOK_ONLY_FIELDS}
    patched["genie_task"] = {"configuration_id": configuration_id, "parameters": params}
    return patched


def patch_tasks(tasks, configuration_id, task_key=TASK_KEY):
    """Replace `task_key` in a jobs/get task list with its genie_task form. The task must exist."""
    if not any(t["task_key"] == task_key for t in tasks):
        raise ValueError(f"Task {task_key} not found; deploy the bundle first")
    return [to_genie_task(t, configuration_id) if t["task_key"] == task_key else t for t in tasks]

# COMMAND ----------

# DBTITLE 1,Patch author_feedback_branch
old = next((t for t in tasks if t["task_key"] == TASK_KEY), None)
tasks = patch_tasks(tasks, configuration_id)
print(f"Patched '{TASK_KEY}' (was {'genie_task' if old and 'genie_task' in old else 'notebook_task'})")
print(f"genie_task.parameters: {next(t for t in tasks if t['task_key'] == TASK_KEY)['genie_task']['parameters']}")

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
missing_params = [k for k in REQUIRED_GENIE_PARAMS if k not in (target_task["genie_task"].get("parameters") or {})]
assert not missing_params, f"genie_task.parameters missing after reset: {missing_params}"

print("Validation passed:")
print(f"  task_key:         {TASK_KEY}")
print(f"  configuration_id: {target_task['genie_task']['configuration_id']}")
print(f"  parameters:       {target_task['genie_task'].get('parameters', {})}")
print(f"  timeout_seconds:  {target_task.get('timeout_seconds')}")
print(f"setup_job_params complete")