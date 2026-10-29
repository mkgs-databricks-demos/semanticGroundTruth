# Databricks notebook source
# Design source: L300-01 §Step 4, L300-08
# Job: post_deploy_validation — single task
# Schedule: on-demand (run after full bundle deploy)
#
# Validates all Bundle 1 resources deployed correctly.
# All checks produce a summary table; raises an exception if any check fails.

# COMMAND ----------

# DBTITLE 1,Install latest Databricks SDK
# The serverless pre-installed SDK has no w.postgres (Lakebase) API; upgrade first.
%pip install --upgrade databricks-sdk
dbutils.library.restartPython()

# COMMAND ----------

# DBTITLE 1,Validate infra resources
from databricks.sdk import WorkspaceClient
from databricks.sdk.service import sql, jobs
import json

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
    lakebase_project_id = dbutils.widgets.get("lakebase_project_id")
except Exception:
    lakebase_project_id = ""
try:
    warehouse_id = dbutils.widgets.get("warehouse_id")
except Exception:
    warehouse_id = ""

# Job ids from the bundle (resource references in the job YAML). Job names carry the
# target's name prefix (e.g. "[dev matthew_giglia] "), so a lookup by resource key never matches.
JOB_KEYS = ["feedback_pipeline", "freshness_resurfacing", "metric_view_deploy", "post_deploy_validation"]
job_ids = {}
for key in JOB_KEYS:
    try:
        job_ids[key] = dbutils.widgets.get(f"{key}_job_id").strip()
    except Exception:
        job_ids[key] = ""

print(f"catalog={catalog}, schema={schema}")
print(f"lakebase_project_id={lakebase_project_id}")
print(f"warehouse_id={warehouse_id}")
print(f"job_ids={job_ids}")

# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

checks = []

def check(name, fn):
    """Run a validation check and record pass/fail."""
    try:
        result = fn()
        status = "PASS" if result else "FAIL"
        detail = str(result) if result else "returned falsy"
    except Exception as e:
        status = "FAIL"
        detail = str(e)
    checks.append({"check": name, "status": status, "detail": detail})
    icon = "✅" if status == "PASS" else "❌"
    print(f"{icon} [{status}] {name}: {detail}")
    return status == "PASS"

# 1. UC schema exists
check(
    "UC schema exists",
    lambda: f"schema {w.schemas.get(f'{catalog}.{schema}').full_name} exists"
)

# 2. SQL Warehouse accessible
def check_warehouse():
    if not warehouse_id:
        return "skipped (warehouse_id not provided)"
    wh = w.warehouses.get(warehouse_id)
    return f"warehouse {wh.name} state={wh.state.value}"
check("SQL Warehouse accessible", check_warehouse)

# 3. Lakebase project accessible
def check_lakebase():
    if not lakebase_project_id:
        return "skipped (lakebase_project_id not provided)"
    # The bundle passes the resource id, which is already "projects/<id>".
    name = lakebase_project_id if lakebase_project_id.startswith("projects/") else f"projects/{lakebase_project_id}"
    project = w.postgres.get_project(name=name)
    display = getattr(getattr(project, "status", None), "display_name", None) or getattr(getattr(project, "spec", None), "display_name", None)
    return f"project {project.name} ({display}) exists"
check("Lakebase project accessible", check_lakebase)

# 4. Metric views queryable (check each metric view exists)
for mv_name in ["mv_review_activity", "mv_coverage_metrics", "mv_user_leaderboard", "mv_feedback_pipeline"]:
    def make_mv_check(name):
        def fn():
            return bool(
                spark.sql(f"SHOW VIEWS IN {catalog}.{schema}")
                    .filter(f"viewName = '{name}'")
                    .count()
            )
        return fn
    check(f"Metric view {mv_name} exists", make_mv_check(mv_name))

# 5. All 4 jobs created (check by the job id the bundle passes)
for job_key in JOB_KEYS:
    def make_job_check(key):
        def fn():
            job_id = job_ids.get(key)
            if not job_id:
                raise ValueError(f"{key}_job_id parameter is empty")
            job = w.jobs.get(int(job_id))
            return f"job '{job.settings.name}' found (id={job.job_id})"
        return fn
    check(f"Job '{job_key}' exists", make_job_check(job_key))

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
failed = [c for c in checks if c["status"] == "FAIL"]
print(f"\n=== Validation Summary ===")
print(f"Total checks: {len(checks)}  PASS: {len(checks) - len(failed)}  FAIL: {len(failed)}")

if failed:
    for c in failed:
        print(f"  FAIL: {c['check']} — {c['detail']}")
    raise Exception(f"{len(failed)} validation check(s) failed. See output above.")
else:
    print("All validation checks passed. Bundle 1 deployment is healthy.")