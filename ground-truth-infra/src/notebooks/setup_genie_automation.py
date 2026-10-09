# Databricks notebook source
# MAGIC %md
# MAGIC # Setup Genie Code Automation
# MAGIC Creates or updates the Genie Code automation (scheduled insight) for the feedback pipeline.
# MAGIC
# MAGIC **Design source:** `docs/plans/post_deploy_automation_plan.md` Task 1, `docs/research/03_genie_code_workflow_tasks.md` §2–3
# MAGIC
# MAGIC **API:** `POST /api/2.0/alerts-internal/scheduled-insights`
# MAGIC
# MAGIC **Outputs:** `dbutils.jobs.taskValues.set(key="configuration_id", value=<id>)`

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Parameters

# COMMAND ----------

dbutils.widgets.text("catalog", "", "Target catalog")
dbutils.widgets.text("schema", "", "Target schema")
dbutils.widgets.text("git_folder_id", "", "Git folder ID for the YAML fixtures repo")
dbutils.widgets.text("prompt_path", "fixtures/prompts/feedback_loop_prompt.md", "Path to prompt fixture (relative to bundle root)")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
git_folder_id = dbutils.widgets.get("git_folder_id")
prompt_path = dbutils.widgets.get("prompt_path")

print(f"catalog={catalog}, schema={schema}, git_folder_id={git_folder_id}")
print(f"prompt_path={prompt_path}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Initialize SDK and resolve paths

# COMMAND ----------

from databricks.sdk import WorkspaceClient
import re

w = WorkspaceClient()
uid = w.current_user.me().id
print(f"Current user ID: {uid}")

# Resolve bundle root from notebook context.
# Notebook is at <bundle_root>/src/notebooks/<name> — go up 3 path segments.
ctx = dbutils.notebook.entry_point.getDbutils().notebook().getContext()
notebook_ws_path = ctx.notebookPath().get()
bundle_root = "/".join(notebook_ws_path.split("/")[:-3])
print(f"Bundle root (workspace): {bundle_root}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read prompt fixture and extract Skill Prompt section

# COMMAND ----------

prompt_full_path = f"/Workspace{bundle_root}/{prompt_path}"
print(f"Reading prompt from: {prompt_full_path}")

with open(prompt_full_path, "r") as f:
    prompt_file_content = f.read()

# Extract the "## Skill Prompt" section — everything from that header to the next
# "---" separator line. This is the YAML generation rules block.
match = re.search(
    r"## Skill Prompt\n\n(.+?)(?=\n---\n)",
    prompt_file_content,
    re.DOTALL,
)
if not match:
    raise ValueError(f"Could not find '## Skill Prompt' section in {prompt_path}")

skill_rules = match.group(1).strip()
print(f"Extracted skill rules ({len(skill_rules)} chars)")
print(f"Preview: {skill_rules[:200]}...")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Build composite prompt template

# COMMAND ----------

AUTOMATION_DISPLAY_NAME = "Ground Truth Feedback Loop"

GIT_FIXTURES_PATH = (
    "/Users/matthew.giglia@databricks.com/semanticGroundTruth"
    "/ground-truth-infra/fixtures/metric_views/"
)

# Prompt template with __PLACEHOLDER__ tokens for safe substitution.
# {{catalog}} and {{schema}} are Genie Code runtime parameter placeholders
# (NOT Python format strings) — they stay as literal text in the final prompt.
PROMPT_TEMPLATE = """\
You are a metric view YAML editor for the Semantic Ground Truth App.

Read the feedback staging table at {{catalog}}.{{schema}}.feedback_staging.
For each asset with REJECT or EDIT votes:
1. Read the current fixture YAML from the Git folder at
   __GIT_FIXTURES_PATH__
2. Generate an updated YAML that addresses the reviewer feedback
3. Create a feature branch named `feedback/YYYY-MM-DD-<asset_name>`
4. Commit the proposed YAML changes to the branch
5. Write a summary of changes to {{catalog}}.{{schema}}.feedback_results

If the staging table is empty or has 0 rows, exit with message "No feedback to process."

Follow these YAML generation rules:
---
__SKILL_RULES__"""

user_prompt = (
    PROMPT_TEMPLATE
    .replace("__GIT_FIXTURES_PATH__", GIT_FIXTURES_PATH)
    .replace("__SKILL_RULES__", skill_rules)
)

print(f"Composite prompt ({len(user_prompt)} chars):")
print("-" * 60)
print(user_prompt[:800])
if len(user_prompt) > 800:
    print("...")

# COMMAND ----------

# MAGIC %md
# MAGIC ## List existing automations and find by display_name

# COMMAND ----------

existing_resp = w.api_client.do(
    "GET",
    "/api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE",
    query={"parent_asset_name": f"users/{uid}"},
)
existing = existing_resp.get("scheduled_insights", [])
print(f"Found {len(existing)} existing GENIE_CODE automations")

automation = next(
    (a for a in existing if a.get("display_name") == AUTOMATION_DISPLAY_NAME),
    None,
)
if automation:
    print(f"Matched: {automation['name']} (etag={automation['etag']})")
else:
    print(f"No automation named '{AUTOMATION_DISPLAY_NAME}' — will create new")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create or update the automation

# COMMAND ----------

if automation:
    # --- Update existing automation ---
    configuration_id = automation["name"]
    insight_id = configuration_id.split("/")[-1]
    etag = automation["etag"]

    w.api_client.do(
        "PATCH",
        f"/api/2.0/alerts-internal/scheduled-insights/{insight_id}",
        body={
            "insight_id": insight_id,
            "update_mask": "user_prompt,display_name",
            "etag": etag,
            "scheduled_insight": {
                "name": configuration_id,
                "user_prompt": user_prompt,
                "display_name": AUTOMATION_DISPLAY_NAME,
            },
        },
    )
    print(f"Updated automation: {configuration_id}")
    print(f"  Prompt length: {len(user_prompt)} chars")
else:
    # --- Create new automation (no schedule, no trigger — job-driven only) ---
    resp = w.api_client.do(
        "POST",
        "/api/2.0/alerts-internal/scheduled-insights",
        body={
            "parent_asset_name": f"users/{uid}",
            "scheduled_insight": {
                "insight_type": "GENIE_CODE",
                "user_prompt": user_prompt,
                "display_name": AUTOMATION_DISPLAY_NAME,
            },
        },
    )
    configuration_id = resp["name"]
    print(f"Created automation: {configuration_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validate

# COMMAND ----------

insight_id = configuration_id.split("/")[-1]
validation = w.api_client.do(
    "GET",
    f"/api/2.0/alerts-internal/scheduled-insights/{insight_id}",
    query={"name": configuration_id},
)

assert validation["insight_type"] == "GENIE_CODE", (
    f"Expected GENIE_CODE, got {validation['insight_type']}"
)
assert validation["display_name"] == AUTOMATION_DISPLAY_NAME, (
    f"Display name mismatch: {validation['display_name']}"
)
assert validation["user_prompt"].startswith("You are a metric view YAML editor"), (
    "Prompt content mismatch — does not start with expected text"
)

print("Validation passed:")
print(f"  configuration_id: {configuration_id}")
print(f"  insight_type:     {validation['insight_type']}")
print(f"  display_name:     {validation['display_name']}")
print(f"  prompt length:    {len(validation['user_prompt'])} chars")
print(f"  etag:             {validation['etag']}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Emit outputs

# COMMAND ----------

dbutils.jobs.taskValues.set(key="configuration_id", value=configuration_id)
print(f"taskValues.set(configuration_id={configuration_id})")
print("setup_genie_automation complete")
