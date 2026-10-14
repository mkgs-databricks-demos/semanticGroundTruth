# Databricks notebook source
# Design source: L300-04 §Step 3, L200-C6
# Job: freshness_resurfacing — single task
# Schedule: Daily 6 AM
#
# Identifies stale production assets (not reviewed within the staleness window)
# and adds them to freshness campaigns so reviewers are prompted to re-evaluate.

# COMMAND ----------
# %pip install --upgrade databricks-sdk
# dbutils.library.restartPython()

# COMMAND ----------

from datetime import datetime, timedelta
from databricks.sdk import WorkspaceClient
from pyspark.sql import functions as F

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
    staleness_days = int(dbutils.widgets.get("staleness_days"))
except Exception:
    staleness_days = 90

stale_cutoff = (datetime.utcnow() - timedelta(days=staleness_days)).isoformat()
print(f"catalog={catalog}, schema={schema}, staleness_days={staleness_days}")
print(f"Stale cutoff: {stale_cutoff}")

# ---------------------------------------------------------------------------
# Step 1: Find assets not reviewed within the staleness window
# ---------------------------------------------------------------------------
# Source: lb_assets_history (Lakebase Lakehouse Sync → Delta)
# An asset is stale if its last_reviewed_at is older than staleness_days,
# or if it has never been reviewed (last_reviewed_at IS NULL).

stale_assets = spark.sql(f"""
    SELECT
        a.asset_id,
        a.asset_type,
        a.display_name,
        a.last_reviewed_at,
        DATEDIFF(current_timestamp(), a.last_reviewed_at) AS days_since_review
    FROM {catalog}.{schema}.lb_assets_history a
    WHERE a._change_type != 'DELETE'
      AND a.status = 'CERTIFIED'
      AND (
          a.last_reviewed_at IS NULL
          OR a.last_reviewed_at < '{stale_cutoff}'
      )
    ORDER BY a.last_reviewed_at ASC NULLS FIRST
""")

stale_count = stale_assets.count()
print(f"Stale assets found: {stale_count}")

# ---------------------------------------------------------------------------
# Step 2: Add stale assets to freshness campaigns
# ---------------------------------------------------------------------------
# Write stale asset IDs to lb_campaigns_history staging area.
# The app's campaign system picks these up and surfaces them to reviewers.

if stale_count > 0:
    campaigns = stale_assets.select(
        F.col("asset_id"),
        F.lit("FRESHNESS").alias("campaign_type"),
        F.lit(staleness_days).alias("staleness_days"),
        F.current_timestamp().alias("created_at")
    )
    freshness_table = f"{catalog}.{schema}.freshness_campaign_staging"
    campaigns.write.format("delta").mode("append").saveAsTable(freshness_table)
    print(f"Added {stale_count} assets to freshness campaigns at {freshness_table}")
else:
    print("No stale assets found. No campaign entries created.")

print("freshness_check complete.")
