# Databricks notebook source
# DBTITLE 1,Description
# Design source: L300-01 §Step 4, L300-05 §Step 2, root plan 04
# Job: metric_view_deploy — Task 2 of 2 (for_each_task iteration)
#
# Reads a single fixture YAML file, resolves environment references
# (${catalog}, ${schema}), and executes the CREATE VIEW SQL on the
# SQL warehouse via the Databricks SDK Statement Execution API.
# Verifies the view with DESCRIBE TABLE EXTENDED ... AS JSON.
# validate_only=true runs EXPLAIN on the source query only.
# Run once per fixture file via the for_each_task wrapper.

# COMMAND ----------

# DBTITLE 1,Install latest Databricks SDK
# MAGIC %pip install --upgrade databricks-sdk pyyaml
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# DBTITLE 1,Deploy or validate metric view
import json
import yaml
import re

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementState

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
    catalog = "hls_fde_dev"
try:
    schema = dbutils.widgets.get("schema")
except Exception:
    schema = "dev_matthew_giglia_semantic_ground_truth"
try:
    warehouse_id = dbutils.widgets.get("warehouse_id")
except Exception:
    warehouse_id = ""
try:
    validate_only = dbutils.widgets.get("validate_only").strip().lower() in ("true", "1", "yes")
except Exception:
    validate_only = False

print(f"fixture_file={fixture_file}, catalog={catalog}, schema={schema}")
print(f"warehouse_id={warehouse_id}, validate_only={validate_only}")

if not fixture_file:
    raise ValueError("fixture_file parameter is required")
if not warehouse_id:
    raise ValueError("warehouse_id parameter is required")

w = WorkspaceClient()

# ---------------------------------------------------------------------------
# Step 1: Read and parse the fixture YAML
# ---------------------------------------------------------------------------
fixture_path = fixture_file.replace("dbfs:/Workspace", "/Workspace")
with open(fixture_path) as f:
    fixture = yaml.safe_load(f)

name = fixture.get("name", "unknown")
raw_sql = fixture.get("sql", "")
if not raw_sql:
    raise ValueError(f"No SQL found in fixture {fixture_path}")

print(f"Loaded fixture: {name}")

# ---------------------------------------------------------------------------
# Step 2: Resolve environment references in the SQL template
# ---------------------------------------------------------------------------
resolved_sql = (
    raw_sql
    .replace("${catalog}", catalog)
    .replace("${schema}", schema)
    .replace("${var.catalog}", catalog)
    .replace("${var.schema}", schema)
)


def execute_on_warehouse(sql: str, timeout_seconds: int = 120) -> object:
    """Execute SQL on the warehouse and return the statement result."""
    result = w.statement_execution.execute_statement(
        warehouse_id=warehouse_id,
        statement=sql,
        wait_timeout=f"{timeout_seconds}s",
    )
    if result.status.state == StatementState.SUCCEEDED:
        return result
    error = result.status.error
    raise RuntimeError(
        f"SQL failed ({result.status.state}): {error.message if error else 'unknown error'}"
    )


# ---------------------------------------------------------------------------
# Step 3: Deploy or validate
# ---------------------------------------------------------------------------
if validate_only:
    # Extract the source query from metric view YAML embedded in $$ delimiters
    match = re.search(r"\$\$(.*?)\$\$", resolved_sql, re.DOTALL)
    if not match:
        raise ValueError(f"Could not find $$ delimiters in fixture {name}")
    mv_def = yaml.safe_load(match.group(1))
    source_query = mv_def.get("source", "")
    if not source_query:
        raise ValueError(f"No source query found in fixture {name}")

    explain_sql = f"EXPLAIN {source_query.strip()}"
    print(f"[validate_only] Running EXPLAIN for {name}...")
    execute_on_warehouse(explain_sql)
    print(f"[validate_only] {name}: EXPLAIN succeeded ✓")
else:
    # Execute CREATE VIEW SQL on the warehouse
    print(f"Deploying metric view: {name}...")
    execute_on_warehouse(resolved_sql)
    print(f"Metric view created: {catalog}.{schema}.{name}")

    # Verify with DESCRIBE TABLE EXTENDED
    verify_sql = f"DESCRIBE TABLE EXTENDED {catalog}.{schema}.{name} AS JSON"
    print(f"Verifying: {verify_sql}")
    verify_result = execute_on_warehouse(verify_sql)

    if verify_result.result and verify_result.result.data_array:
        print(f"Verified: {catalog}.{schema}.{name} exists ✓")
        for row in verify_result.result.data_array[:3]:
            print(f"  {row}")
    else:
        print(f"Warning: DESCRIBE returned no data for {catalog}.{schema}.{name}")

print(f"Done: {name}")