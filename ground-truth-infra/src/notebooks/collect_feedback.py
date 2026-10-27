# Databricks notebook source
# DBTITLE 1,Collect Feedback
# MAGIC %md
# MAGIC # Collect Feedback
# MAGIC
# MAGIC **Job:** `feedback_pipeline`, task 1 of 4 (`collect_feedback` → `check_has_feedback` → `author_feedback_branch` → `register_feedback_branch`).
# MAGIC
# MAGIC Reads **unprocessed edit votes** from the Lakebase CDF Delta table `lb_votes_history` (latest row per vote `id`, deletes dropped), groups them by asset, resolves each edited field (majority, then most recent) and appends one row per asset to `feedback_staging` under a new `batch_id`. Approve/reject votes are not feedback and are never staged; skips live in `app.review_skips` and are not votes at all. Edit votes with only free-text feedback (no edited field) are left for the steward feedback queue.
# MAGIC
# MAGIC **Task values:** `batch_id`, `vote_count`, `asset_count`, `feedback_table`, `run_date` (`yyyymmdd`, UTC). `check_has_feedback` ends the run successfully when `vote_count` is 0.
# MAGIC
# MAGIC **Design source:** L300-04 §Step 1, L200-C6, `docs/plans/27_infra_feedback_pipeline_genie_task.md`. Pure helpers are unit-tested in `tests/test_feedback_pipeline.py`.

# COMMAND ----------

# DBTITLE 1,Parameters
dbutils.widgets.text("catalog", "", "Catalog")
dbutils.widgets.text("schema", "", "Schema")
dbutils.widgets.text("branch_prefix", "mg-genie-feedback-", "Feedback branch prefix")

catalog = dbutils.widgets.get("catalog").strip()
schema = dbutils.widgets.get("schema").strip()
branch_prefix = dbutils.widgets.get("branch_prefix").strip()
print(f"catalog={catalog}, schema={schema}, branch_prefix={branch_prefix}")

# COMMAND ----------

# DBTITLE 1,Pure helpers
# --- pure helpers (stdlib only; unit-tested in tests/test_feedback_pipeline.py) ---
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

FEEDBACK_BRANCH_PREFIX = "mg-genie-feedback-"
EDIT_FIELDS = ("description", "plain_english_logic", "display_name")
_IDENT = re.compile(r"^[A-Za-z0-9_]+$")


def validate_identifier(name):
    """Return a backtick-quoted UC identifier part; reject anything unexpected."""
    if not name or not _IDENT.match(name):
        raise ValueError(f"Invalid catalog/schema name: {name!r}")
    return f"`{name}`"


def validate_branch_prefix(prefix):
    """Feedback branches must be mg-genie-feedback-<yyyymmdd> (owner decision 2026-10-24)."""
    if prefix != FEEDBACK_BRANCH_PREFIX:
        raise ValueError(
            f"branch_prefix must be exactly {FEEDBACK_BRANCH_PREFIX!r}, got {prefix!r}"
        )
    return prefix


def run_date_str(now=None):
    """Batch date as yyyymmdd (UTC)."""
    return (now or datetime.now(timezone.utc)).strftime("%Y%m%d")


def _clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _ts(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def latest_non_deleted(rows, key="id", order="_sort_by"):
    """Latest CDF row per key (by `order`), ignoring update pre-images; drop keys whose latest row is a delete."""
    latest = {}
    for row in rows:
        if row.get("_pg_change_type") == "update_preimage":
            continue
        k = row[key]
        if k not in latest or row[order] > latest[k][order]:
            latest[k] = row
    return [r for r in latest.values() if r.get("_pg_change_type") != "delete"]


def select_unprocessed_edits(rows):
    """Unprocessed edit votes that propose at least one field value. Skips/approves/rejects are not feedback."""
    return [
        r
        for r in rows
        if r.get("vote_type") == "edit"
        and not r.get("is_processed")
        and any(_clean(r.get(f"edit_{f}")) for f in EDIT_FIELDS)
    ]


def resolve_field(proposals):
    """Resolve [(value, created_at), ...] for one field: majority wins, ties go to the most recent value.

    Returns {value, support, total, conflict} or None when nothing was proposed.
    `conflict` is True when two or more distinct values were proposed.
    """
    values = [(_clean(v), _ts(t)) for v, t in proposals if _clean(v)]
    if not values:
        return None
    counts = Counter(v for v, _ in values)
    latest = {}
    for v, t in values:
        latest[v] = max(latest.get(v, t), t)
    top = max(counts.values())
    winner = max((v for v, c in counts.items() if c == top), key=lambda v: latest[v])
    return {"value": winner, "support": top, "total": len(values), "conflict": len(counts) > 1}


def group_edit_votes(votes, assets):
    """Group edit votes by asset into staging rows.

    votes:  dicts with id, asset_id, user_id, created_at, feedback, edit_description,
            edit_plain_english_logic, edit_display_name.
    assets: {asset_id: dict with asset_type, name, display_name, description,
            plain_english_logic, fixture_path}.
    """
    by_asset = defaultdict(list)
    for v in votes:
        by_asset[v["asset_id"]].append(v)
    out = []
    for asset_id in sorted(by_asset):
        rows = sorted(by_asset[asset_id], key=lambda v: (_ts(v["created_at"]), v["id"]))
        edits = [
            {
                "vote_id": v["id"],
                "user_id": v.get("user_id"),
                "created_at": _ts(v["created_at"]),
                "feedback": _clean(v.get("feedback")),
                **{f: _clean(v.get(f"edit_{f}")) for f in EDIT_FIELDS},
            }
            for v in rows
        ]
        resolved = {}
        for f in EDIT_FIELDS:
            r = resolve_field([(e[f], e["created_at"]) for e in edits])
            if r:
                resolved[f] = r
        asset = assets.get(asset_id) or {}
        out.append(
            {
                "asset_id": asset_id,
                "asset_type": asset.get("asset_type"),
                "asset_name": asset.get("name"),
                "display_name": asset.get("display_name"),
                "fixture_path": asset.get("fixture_path"),
                "current_description": asset.get("description"),
                "current_plain_english_logic": asset.get("plain_english_logic"),
                "current_display_name": asset.get("display_name"),
                "vote_ids": [e["vote_id"] for e in edits],
                "vote_count": len(edits),
                "edits_json": json.dumps(edits),
                "resolved_json": json.dumps(resolved),
            }
        )
    return out

# COMMAND ----------

# DBTITLE 1,Validate parameters
validate_branch_prefix(branch_prefix)
fq = f"{validate_identifier(catalog)}.{validate_identifier(schema)}"
feedback_table = f"{catalog}.{schema}.feedback_staging"
run_date = run_date_str()
print(f"run_date={run_date}, feedback_table={feedback_table}")

# COMMAND ----------

# DBTITLE 1,Read unprocessed edit votes (latest row per vote)
# UUID columns replicate as BINARY(16); format them as canonical UUID strings.
def _uuid_sql(col):
    return (
        f"regexp_replace(lower(hex({col})), "
        "'^(.{8})(.{4})(.{4})(.{4})(.{12})$', '$1-$2-$3-$4-$5')"
    )


# vote_type never changes after insert, so filtering on it before taking the latest row is safe.
vote_rows = [
    r.asDict()
    for r in spark.sql(f"""
        SELECT _pg_change_type, _sort_by,
               {_uuid_sql('id')} AS id, {_uuid_sql('asset_id')} AS asset_id,
               user_id, vote_type, feedback,
               edit_description, edit_plain_english_logic, edit_display_name,
               is_processed, created_at
        FROM {fq}.lb_votes_history
        WHERE vote_type = 'edit'
    """).collect()
]
votes = select_unprocessed_edits(latest_non_deleted(vote_rows))
print(f"edit vote CDF rows: {len(vote_rows)}; unprocessed edit votes with a proposed value: {len(votes)}")

# COMMAND ----------

# DBTITLE 1,Look up the edited assets
assets = {}
asset_ids = sorted({v["asset_id"] for v in votes})
if asset_ids:
    params = {f"a{i}": a for i, a in enumerate(asset_ids)}
    asset_rows = [
        r.asDict()
        for r in spark.sql(
            f"""
            SELECT * FROM (
              SELECT _pg_change_type, _sort_by, {_uuid_sql('id')} AS id,
                     asset_type, name, display_name, description, plain_english_logic, fixture_path
              FROM {fq}.lb_assets_history
            ) WHERE id IN ({", ".join(":" + k for k in params)})
            """,
            args=params,
        ).collect()
    ]
    assets = {a["id"]: a for a in latest_non_deleted(asset_rows)}
missing = [a for a in asset_ids if a not in assets]
if missing:
    print(f"warn: {len(missing)} asset(s) not found in lb_assets_history (staged without metadata): {missing}")

# COMMAND ----------

# DBTITLE 1,Write the staging batch and emit task values
import uuid

from pyspark.sql import types as T

staged = group_edit_votes(votes, assets)
vote_count = sum(r["vote_count"] for r in staged)
asset_count = len(staged)
batch_id = str(uuid.uuid4()) if staged else ""

if staged:
    staging_schema = T.StructType(
        [
            T.StructField("batch_id", T.StringType(), False),
            T.StructField("run_date", T.StringType(), False),
            T.StructField("collected_at", T.TimestampType(), False),
            T.StructField("asset_id", T.StringType(), False),
            T.StructField("asset_type", T.StringType(), True),
            T.StructField("asset_name", T.StringType(), True),
            T.StructField("display_name", T.StringType(), True),
            T.StructField("fixture_path", T.StringType(), True),
            T.StructField("current_description", T.StringType(), True),
            T.StructField("current_plain_english_logic", T.StringType(), True),
            T.StructField("current_display_name", T.StringType(), True),
            T.StructField("vote_ids", T.ArrayType(T.StringType()), False),
            T.StructField("vote_count", T.IntegerType(), False),
            T.StructField("edits_json", T.StringType(), False),
            T.StructField("resolved_json", T.StringType(), False),
        ]
    )
    collected_at = datetime.now(timezone.utc)
    rows = [
        {"batch_id": batch_id, "run_date": run_date, "collected_at": collected_at, **r}
        for r in staged
    ]
    (
        spark.createDataFrame(rows, staging_schema)
        .write.format("delta")
        .mode("append")
        .option("mergeSchema", "true")
        .saveAsTable(f"{fq}.feedback_staging")
    )
    print(f"Staged batch {batch_id}: {asset_count} asset(s), {vote_count} vote(s) -> {feedback_table}")
else:
    print("No unprocessed edit votes; nothing staged. check_has_feedback will end the run.")

for key, value in {
    "batch_id": batch_id,
    "vote_count": vote_count,
    "asset_count": asset_count,
    "feedback_table": feedback_table,
    "run_date": run_date,
}.items():
    dbutils.jobs.taskValues.set(key=key, value=value)
print(f"task values: batch_id={batch_id!r}, vote_count={vote_count}, asset_count={asset_count}, run_date={run_date}")