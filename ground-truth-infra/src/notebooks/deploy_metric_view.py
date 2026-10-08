# Databricks notebook source
# Design source: L300-01 §Step 4, L300-05 §Step 2
# Job: metric_view_deploy — Task 2 of 2 (for_each_task iteration)
#
# Reads a single fixture YAML file, resolves environment references
# (${catalog}, ${schema}), and executes the CREATE VIEW ... WITH METRICS SQL.
# Run once per fixture file via the for_each_task wrapper.

# COMMAND ----------
# %pip install --upgrade databricks-sdk pyyaml
# dbutils.library.restartPython()

# COMMAND ----------

import json
import yaml
import os

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------
try:
    fixture_file = dbutils.widgets.get("fixture_file")
except Exception:
    fixture_file = ""
try:
    catalog = dbutils.widgets.get("catalog")
except Exception:
    catalog = "dev_ground_truth"
try:
    schema = dbutils.widgets.get("schema")
except Exception:
    schema = "app"

print(f"fixture_file={fixture_file}, catalog={catalog}, schema={schema}")

if not fixture_file:
    raise ValueError("fixture_file parameter is required")

# ---------------------------------------------------------------------------
# Step 1: Read and parse the fixture YAML
# ---------------------------------------------------------------------------
# Fixture format (see fixtures/mv_*.yaml):
#   name: <metric_view_name>
#   source_table: <source_cdf_table>
#   measures: [...]
#   dimensions: [...]
#   sql: |
#     CREATE VIEW ... WITH METRICS LANGUAGE YAML AS ...

fixture_path = fixture_file.replace("dbfs:/Workspace", "/Workspace")
with open(fixture_path) as f:
    fixture = yaml.safe_load(f)

print(f"Loaded fixture: {fixture.get('name', 'unknown')}")

# ---------------------------------------------------------------------------
# Step 2: Resolve environment references in the SQL template
# ---------------------------------------------------------------------------
# Replace ${catalog} and ${schema} placeholders in the SQL with actual values
raw_sql = fixture.get("sql", "")
if not raw_sql:
    raise ValueError(f"No SQL found in fixture {fixture_path}")

resolved_sql = (
    raw_sql
    .replace("${catalog}", catalog)
    .replace("${schema}", schema)
    .replace("${var.catalog}", catalog)
    .replace("${var.schema}", schema)
)

print(f"Resolved SQL (first 200 chars): {resolved_sql[:200]}...")

# ---------------------------------------------------------------------------
# Step 3: Execute CREATE VIEW SQL
# ---------------------------------------------------------------------------
try:
    spark.sql(resolved_sql)
    view_name = fixture.get("name", "unknown")
    print(f"Metric view deployed successfully: {catalog}.{schema}.{view_name}")
except Exception as e:
    print(f"Failed to deploy metric view from {fixture_path}: {e}")
    raise
