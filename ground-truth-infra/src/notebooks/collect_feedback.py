# Databricks notebook source
# Design source: L300-04 §Step 1, L200-C6
# Job: feedback_pipeline — Task 1 of 2
# Schedule: Daily 11 PM
#
# Queries unprocessed votes from Lakebase CDF Delta tables,
# groups them by asset, and compiles a feedback JSON payload
# written to a staging Delta table for downstream tasks.

# COMMAND ----------
# %pip install --upgrade databricks-sdk
# dbutils.library.restartPython()

# COMMAND ----------

import json
from datetime import datetime, timedelta
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

# ---------------------------------------------------------------------------
# Parameters (set as job task parameters)
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
    cutoff_hours = int(dbutils.widgets.get("cutoff_hours"))
except Exception:
    cutoff_hours = 24

print(f"catalog={catalog}, schema={schema}, cutoff_hours={cutoff_hours}")

# ---------------------------------------------------------------------------
# Step 1: Query unprocessed votes from the Lakebase CDF Delta table
# ---------------------------------------------------------------------------
# Source: lb_votes_history (Lakebase Lakehouse Sync → Delta)
# Unprocessed = votes not yet included in a feedback batch
cutoff_ts = (datetime.utcnow() - timedelta(hours=cutoff_hours)).isoformat()

unprocessed_votes = spark.sql(f"""
    SELECT
        v.asset_id,
        v.vote_type,
        v.reviewer_id,
        v.comment,
        v.proposed_yaml,
        v.created_at
    FROM {catalog}.{schema}.lb_votes_history v
    LEFT JOIN {catalog}.{schema}.lb_feedback_batches_history fb
        ON v.vote_id = fb.vote_id
        AND fb._change_type != 'DELETE'
    WHERE fb.vote_id IS NULL
      AND v._change_type = 'INSERT'
      AND v.created_at >= '{cutoff_ts}'
    ORDER BY v.asset_id, v.created_at
""")

asset_count = unprocessed_votes.select("asset_id").distinct().count()
print(f"Unprocessed votes found. Distinct assets: {asset_count}")

# ---------------------------------------------------------------------------
# Step 2: Group votes by asset_id, collect vote details
# ---------------------------------------------------------------------------
from pyspark.sql import functions as F

votes_by_asset = (
    unprocessed_votes
    .groupBy("asset_id")
    .agg(
        F.collect_list("vote_type").alias("vote_types"),
        F.collect_list("reviewer_id").alias("reviewer_ids"),
        F.collect_list("comment").alias("comments"),
        F.collect_list("proposed_yaml").alias("proposed_yamls")
    )
)

# ---------------------------------------------------------------------------
# Step 3: Write feedback payload to staging table
# ---------------------------------------------------------------------------
feedback_table = f"{catalog}.{schema}.feedback_staging"
votes_by_asset.write.format("delta").mode("append").saveAsTable(feedback_table)
print(f"Feedback payload appended to {feedback_table}")

# Pass metadata to the next task via task values
dbutils.jobs.taskValues.set(key="asset_count", value=asset_count)
dbutils.jobs.taskValues.set(key="feedback_table", value=feedback_table)
print(f"task_values: asset_count={asset_count}, feedback_table={feedback_table}")
