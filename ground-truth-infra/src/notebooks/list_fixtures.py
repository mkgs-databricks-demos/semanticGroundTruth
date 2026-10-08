# Databricks notebook source
# Design source: L300-04 Q1 (resolved), L300-01 §Step 4
# Job: metric_view_deploy — Task 1 of 2 (upstream task)
#
# Lists fixture YAML files under fixtures/ and emits the array via
# dbutils.jobs.taskValues.set() so the downstream for_each_task can iterate.
#
# Resolved question #1 from build plan: file_list() does NOT exist in DABs.
# This notebook is the workaround: list files, emit JSON array, reference via
# {{tasks.list_fixtures.values.fixture_files}} in the for_each_task inputs.

# COMMAND ----------

import json
import os

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
try:
    fixtures_path = dbutils.widgets.get("fixtures_path")
except Exception:
    # Default: fixtures/ directory relative to the bundle root (mounted at /Workspace/...)
    # When running from a job, the working directory is the bundle root.
    # The YAML files are uploaded as part of the bundle deploy to:
    # /Workspace/Users/<user>/.bundle/ground-truth-infra/<target>/files/fixtures/
    fixtures_path = os.path.join(
        "/Workspace",
        "Users",
        "matthew.giglia@databricks.com",
        ".bundle",
        "ground-truth-infra",
        "dev",  # will be parameterized via job parameter
        "files",
        "fixtures",
    )

print(f"fixtures_path={fixtures_path}")

# ---------------------------------------------------------------------------
# Step 1: List *.yaml fixture files
# ---------------------------------------------------------------------------
fixture_files = []
try:
    for f in dbutils.fs.ls(fixtures_path.replace("/Workspace", "dbfs:/Workspace")):
        if f.name.endswith(".yaml") and not f.name.startswith("."):
            fixture_files.append(f.path)
except Exception as e:
    # Fall back to os.listdir for workspace paths
    try:
        for name in sorted(os.listdir(fixtures_path)):
            if name.endswith(".yaml") and not name.startswith("."):
                fixture_files.append(os.path.join(fixtures_path, name))
    except Exception as e2:
        print(f"Could not list fixtures: {e2}")

print(f"Fixture files found: {len(fixture_files)}")
for f in fixture_files:
    print(f"  {f}")

# ---------------------------------------------------------------------------
# Step 2: Emit fixture file list via task values
# ---------------------------------------------------------------------------
# The for_each_task downstream references this via:
#   inputs: "{{tasks.list_fixtures.values.fixture_files}}"
dbutils.jobs.taskValues.set(key="fixture_files", value=json.dumps(fixture_files))
dbutils.jobs.taskValues.set(key="fixture_count", value=len(fixture_files))
print(f"task_values set: fixture_count={len(fixture_files)}")
