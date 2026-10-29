# Databricks notebook source
# DBTITLE 1,Setup CDF Config
# MAGIC %md
# MAGIC # Setup CDF Config
# MAGIC Configures Lakebase Lakehouse Sync (CDF replication from Postgres to Delta).
# MAGIC
# MAGIC Idempotent: re-running with an existing config only waits for history tables and reports.
# MAGIC
# MAGIC **Design sources:** `docs/plans/02_infra_lakebase_cdf_setup.md`, `docs/plans/build_conventions.md` §6
# MAGIC
# MAGIC **SDK:** `w.postgres.create_cdf_config(parent=<database>, cdf_config=CdfConfig(catalog, schema, postgres_schema))`
# MAGIC
# MAGIC **Important:** The CDF API parent is the **database** resource path, not the branch.

# COMMAND ----------

# DBTITLE 1,Install latest Databricks SDK
# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# DBTITLE 1,Widgets
dbutils.widgets.text("database", "", "Lakebase database resource path")
dbutils.widgets.text("source_schema", "app", "Postgres source schema")
dbutils.widgets.text("catalog", "", "Target UC catalog")
dbutils.widgets.text("schema", "", "Target UC schema")
dbutils.widgets.text(
    "expected_tables",
    "votes,assets,user_activity,campaigns,campaign_assets,app_config,_migrations",
    "Comma-separated list of expected Postgres tables",
)
dbutils.widgets.text("wait_timeout_seconds", "900", "Max seconds to wait for history tables")

database = dbutils.widgets.get("database")
source_schema = dbutils.widgets.get("source_schema")
catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
expected_tables = [t.strip() for t in dbutils.widgets.get("expected_tables").split(",") if t.strip()]
wait_timeout_seconds = int(dbutils.widgets.get("wait_timeout_seconds"))

# Callers (setup_lakebase_cdf, post_deploy_setup.setup_cdf_config) must pass these exact widget names.
# A base_parameters key that matches no widget is silently ignored, which left `database` empty before build 5.
if not database.startswith("projects/") or "/databases/" not in database:
    raise ValueError(
        f"database must be the Lakebase database resource path projects/<p>/branches/<b>/databases/<d>, got {database!r}; "
        "pass it as the `database` parameter (${resources.postgres_databases.app_db.id} in the bundle)"
    )
if not catalog or not schema:
    raise ValueError(f"catalog and schema are required (got catalog={catalog!r}, schema={schema!r})")

print(f"database={database}")
print(f"source_schema={source_schema}")
print(f"catalog={catalog}, schema={schema}")
print(f"expected_tables={expected_tables}")
print(f"wait_timeout_seconds={wait_timeout_seconds}")

# COMMAND ----------

# DBTITLE 1,Configure CDF and wait for history tables
import json
import logging
import sys
from pathlib import Path

from databricks.sdk import WorkspaceClient

# --- Load src/lib ---
notebook_path = (
    dbutils.notebook.entry_point.getDbutils()
    .notebook()
    .getContext()
    .notebookPath()
    .get()
)
lib_path = str(
    Path("/Workspace")
    / Path(notebook_path).parent.relative_to("/")
    / ".."
    / "lib"
)
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

from lakebase_cdf import LakebaseCdfConfigurator
print(f"Loaded lib from: {lib_path}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("setup_cdf_config")

w = WorkspaceClient()

# --- Step 1: Ensure CDF config exists ---
configurator = LakebaseCdfConfigurator(
    w=w,
    database=database,
    source_schema=source_schema,
    dest_catalog=catalog,
    dest_schema=schema,
)

config, created = configurator.ensure()
logger.info("CDF config: name=%s, created=%s", config.name, created)

# --- Step 2: Wait for lb_*_history tables ---
found_tables = configurator.wait_for_tables(
    expected=expected_tables,
    timeout_s=wait_timeout_seconds,
    spark=spark,
)
logger.info("Found %d history tables: %s", len(found_tables), found_tables)

# --- Step 3: Exit with result ---
result = json.dumps({
    "config_name": config.name,
    "created": created,
    "tables": found_tables,
})
print(f"\nResult: {result}")
dbutils.notebook.exit(result)