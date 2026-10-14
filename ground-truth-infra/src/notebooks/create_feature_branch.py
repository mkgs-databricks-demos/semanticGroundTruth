# Databricks notebook source
# ==========================================================================
# DEPRECATED — 2026-10-11
#
# This notebook is superseded by a native genie_task in feedback_pipeline.
# The genie_task ("Ground Truth Feedback Loop" automation) natively handles
# reading the staging table, generating YAML, and committing to Git.
#
# See:
#   - docs/plans/feedback_pipeline_rework_plan.md
#   - resources/jobs/feedback_pipeline.job.yml (genie_task block)
#   - src/notebooks/setup_genie_automation.py (creates the automation)
#   - src/notebooks/setup_job_params.py (wires the job task)
#
# Kept for reference only. No job YAML references this file.
# ==========================================================================
#
# Original design source: L300-04 §Step 4, L200-C6
# Original job: feedback_pipeline — Task 2 of 2
# Original schedule: Daily 11 PM (runs after collect_feedback)
#
# Called the Genie Spaces API (wrong product) to generate proposed YAML edits.
# Three issues: wrong API (Genie Spaces = SQL Q&A, not YAML gen), wrong product
# conflation, unnecessary complexity. See rework plan for full analysis.

# COMMAND ----------
# %pip install --upgrade databricks-sdk
# dbutils.library.restartPython()

# COMMAND ----------

import json
import time
from databricks.sdk import WorkspaceClient
from databricks.sdk.service import iam

w = WorkspaceClient()

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
try:
    catalog = dbutils.widgets.get("catalog")
except Exception:
    catalog = "dev_ground_truth"
try:
    schema = dbutils.widgets.get("schema")
except Exception:
    schema = "app"
try:
    genie_space_id = dbutils.widgets.get("genie_space_id")
except Exception:
    genie_space_id = ""

# Retrieve task values from upstream collect_feedback task
asset_count = dbutils.jobs.taskValues.get(
    taskKey="collect_feedback", key="asset_count", default=0
)
feedback_table = dbutils.jobs.taskValues.get(
    taskKey="collect_feedback", key="feedback_table",
    default=f"{catalog}.{schema}.feedback_staging"
)

print(f"asset_count={asset_count}, feedback_table={feedback_table}")
print(f"genie_space_id={genie_space_id}")

if asset_count == 0:
    print("No feedback to process. Exiting.")
    dbutils.notebook.exit("no_feedback")

# ---------------------------------------------------------------------------
# Step 1: Read feedback staging table
# ---------------------------------------------------------------------------
feedback_rows = spark.table(feedback_table).collect()
feedback_payload = [
    {
        "asset_id": row["asset_id"],
        "vote_types": row["vote_types"],
        "reviewer_ids": row["reviewer_ids"],
        "comments": row["comments"],
        "proposed_yamls": [y for y in row["proposed_yamls"] if y],
    }
    for row in feedback_rows
]

# ---------------------------------------------------------------------------
# Step 2: Invoke Genie Code to generate proposed YAML edits
# ---------------------------------------------------------------------------
# Genie Code REST API: POST /api/2.0/genie/spaces/{space_id}/start-conversation
# The prompt embeds the feedback payload and asks Genie Code to produce
# updated metric view YAML fixtures.

if genie_space_id:
    host = w.config.host
    token = w.config.token
    import urllib.request

    prompt = f"""Based on the following reviewer feedback, propose updated YAML metric view
definitions for the assets below. Return a JSON object mapping asset_id to proposed_yaml.

Feedback:
{json.dumps(feedback_payload, indent=2)}
"""

    conversation_req = json.dumps({"content": prompt}).encode()
    req = urllib.request.Request(
        f"{host}/api/2.0/genie/spaces/{genie_space_id}/start-conversation",
        data=conversation_req,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        conv_data = json.loads(resp.read())
    conversation_id = conv_data.get("conversation_id", "")
    print(f"Genie Code conversation started: {conversation_id}")
    # Note: Genie Code output is a conversation thread link, not structured data.
    # For a production pipeline, poll the conversation message until COMPLETED
    # and extract proposed YAML from the message content.
    proposed_yamls_by_asset = {}  # placeholder — parse from Genie Code response
else:
    print("No genie_space_id configured — using proposed_yamls from votes directly")
    proposed_yamls_by_asset = {
        row["asset_id"]: row["proposed_yamls"][0]
        for row in feedback_payload
        if row["proposed_yamls"]
    }

# ---------------------------------------------------------------------------
# Step 3: Create a Git feature branch with proposed YAML changes
# ---------------------------------------------------------------------------
# Uses the Databricks Repos REST API.
# Requires git_token secret in the bundle's secret scope.

branch_name = f"feedback/{time.strftime('%Y-%m-%d')}-auto"
git_folder_id = dbutils.widgets.get("git_folder_id") if "git_folder_id" in dbutils.widgets.getAll() else ""

if git_folder_id and proposed_yamls_by_asset:
    print(f"Creating branch: {branch_name}")
    try:
        w.repos.update(repo_id=int(git_folder_id), branch=branch_name)
        print(f"Checked out branch: {branch_name}")
        # TODO: write proposed YAML files to fixture paths, then commit + push
        # Use w.repos.update() to switch branch, then file writes + commit via Git CLI
    except Exception as e:
        print(f"Branch creation warning: {e}")
else:
    print("No git_folder_id or no proposed YAML changes. Skipping branch creation.")

print("create_feature_branch complete.")
