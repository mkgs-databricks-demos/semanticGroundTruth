# CDF Bronze Operations

Operational procedures for the Lakebase CDF → bronze pipeline in the `ground-truth-infra` bundle.

## Architecture overview

```
Lakebase (Postgres)          Lakehouse Sync (CDF)          Bronze (SDP)             Metric Views
┌───────────────────┐    ┌────────────────────────┐    ┌────────────────────┐    ┌───────────────────┐
│ app.votes          │ ──▶ │ lb_votes_history        │ ──▶ │ bronze_lakebase_cdf │ ──▶ │ mv_review_activity│
│ app.assets         │ ──▶ │ lb_assets_history       │    │ (VARIANT `data`)   │    │ mv_coverage_*     │
│ app.campaigns      │ ──▶ │ lb_campaigns_history    │    │ _source_table col  │    │ mv_user_*         │
│ ...17 tables total │ ──▶ │ ...21 history tables    │    │ clustered by src   │    │ ...7 views total  │
└───────────────────┘    └────────────────────────┘    └────────────────────┘    └───────────────────┘
```

**CDF config parent:** the Lakebase **database** resource (`projects/<id>/branches/production/databases/ground-truth-app`), not the branch.

**Bronze schema** (10 columns per row, `build_conventions.md` §7):

| Column | Type | Source |
|---|---|---|
| `_source_table` | STRING | Postgres table name, e.g. `votes` |
| `_source_history_table` | STRING | History table name, e.g. `lb_votes_history` |
| `_record_key` | STRING | Composite PK as JSON, e.g. `{"id": 42}` |
| `_pg_change_type` | STRING | `INSERT`, `UPDATE`, `DELETE` |
| `_pg_lsn` | LONG | Postgres Log Sequence Number |
| `_pg_xid` | LONG | Postgres transaction id |
| `_timestamp` | TIMESTAMP_NTZ | CDF capture timestamp |
| `_sort_by` | LONG | Ordering within a batch |
| `_ingested_at` | TIMESTAMP_NTZ | Pipeline ingestion time |
| `data` | VARIANT | Full row payload (all non-metadata columns) |

---

## 1. CDF re-snapshot recovery (reset the flow checkpoint)

When a migration ALTERs a synced table (for example migration 009 on `app.votes` and `app.user_activity`, 2026-10-26 03:55 UTC), Lakehouse Sync re-snapshots its `lb_<table>_history` table. That is a non-append commit (`wal2delta.resnapshot`), so the bronze streaming flow fails with `DELTA_SOURCE_TABLE_IGNORE_CHANGES`.

> **Do not full refresh `bronze_lakebase_cdf`.** The re-snapshot drops the earlier change rows from the history table, so bronze is the only copy of those LSNs. A full refresh deletes them for good. Do not set `skipChangeCommits` either: it would drop the snapshot rows.

**Recovery steps (session 37, build 4):**

1. Wait for the Lakehouse Sync re-snapshot to complete.
2. Find the failing flows in the pipeline event log (names `<catalog>.<schema>.bronze_from_<table>`).
3. Start an update that resets the checkpoint of only those flows:
   ```bash
   databricks pipelines start-update <cdf_bronze pipeline id> --json '{
     "reset_checkpoint_selection": [
       "hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.bronze_from_votes",
       "hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.bronze_from_user_activity"
     ]
   }'
   ```
   The flows re-read the history table from the start and append it again, so bronze gets duplicate `(_record_key, _pg_lsn)` rows. That is expected: every CDF metric view keeps the latest row per `_record_key` (no `update_preimage`, no `delete`).
4. Verify the update is `COMPLETED` with 0 failed/dropped records, every `_pg_lsn` in the history table is present in bronze, and the metric view measures match the history tables (for example `mv_review_activity` `Total Votes` = distinct vote ids).

> **Never** enable Delta CDF, row filters, or column masks on `lb_*_history` tables.

---

## 2. Adding a new Postgres table to bronze

When a new table is added to the app's Postgres `app` schema (via a new migration), follow these steps to include it in the CDF → bronze pipeline.

### Step 1: Ensure REPLICA IDENTITY FULL

Migration 007 sets `REPLICA IDENTITY FULL` on all existing tables, and the migration runner re-applies it after every run. Verify the new table has it:

```sql
-- In Lakebase
SELECT relname, relreplident
FROM pg_class
WHERE relname = '<new_table>';
-- 'f' = FULL (correct), 'd' = DEFAULT (needs fix)
```

### Step 2: CDF config auto-discovers

The `setup_cdf_config` job configures CDF at the **database** level (`parent = database resource`). All tables in the `app` schema are automatically captured. New tables appear as `lb_<table>_history` once they have at least one row.

To force CDF to pick up the new table immediately, insert a row into the table, then verify:

```sql
SELECT * FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.lb_<table>_history LIMIT 5;
```

### Step 3: Add the table to the bronze pipeline config

Edit `ground-truth-infra/fixtures/pipelines/cdf_bronze_tables.yaml`:

```yaml
- table: <new_table>
  history_table: lb_<new_table>_history
  keys:
    - id           # or the table's primary key columns
```

The `CdfBronzeBuilder` class reads this YAML at graph-build time and creates a streaming append flow for each entry. Tables listed but not yet created are **skipped and logged** (no pipeline failure).

### Step 4: Deploy and update the pipeline

```bash
cd ground-truth-infra
databricks bundle deploy --target dev --var=run_setup=false
databricks bundle run cdf_bronze --target dev
```

The pipeline creates a new flow named `bronze_from_<table>` that appends to `bronze_lakebase_cdf` with `_source_table = '<table>'`.

### Step 5: Update metric views (if needed)

If the new table needs a metric view:

1. Create a fixture in `ground-truth-infra/fixtures/metric_views/mv_<name>.yaml`.
2. The view should query `bronze_lakebase_cdf` filtered by `_source_table`, extracting fields from the `data` VARIANT column.
3. Deploy:
   ```bash
   databricks bundle run metric_view_deploy --target dev
   ```
4. Add the new metric view to the Genie space definition (`ground-truth-agent/ground_truth_ops.geniespace.json`).

---

## 3. Current CDF tables (as of 2026-10-23; build 4 adds 2)

21 history tables, 13 distinct source tables in bronze (281 rows at last converge). Build 4 (migration 009) adds `lb_review_skips_history` and `lb_user_settings_history`, and both are in `fixtures/pipelines/cdf_bronze_tables.yaml` (`review_skips` keys `[id]`, `user_settings` keys `[user_id]`). Lakehouse Sync creates a history table only after the source table has a row.

`lb_assets_history`, `lb_votes_history`, `lb_campaigns_history`, `lb_campaign_assets_history`, `lb_campaign_assignments_history`, `lb_synonyms_history`, `lb_example_questions_history`, `lb_notifications_history`, `lb_user_activity_history`, `lb_confidence_scores_history`, `lb_feedback_batches_history`, `lb_app_config_history`, `lb_mcp_sessions_history`, `lb_asset_sources_history`, `lb_asset_versions_history`, `lb_app_groups_history`, `lb_app_group_members_history`, `lb_feedback_batch_items_history`, `lb_audit_log_history`, `lb_badge_awards_history`, `lb__migrations_history`

---

## 4. Metric views over bronze (7 total)

All query `bronze_lakebase_cdf` filtered by `_source_table` and extract fields from `data::<field>`.

| Metric view | Source table | Key measures |
|---|---|---|
| `mv_review_activity` | votes, review_skips | Total Votes, Unique Reviewers, Approval Rate, skips, skip_rate |
| `mv_coverage_metrics` | assets | Total Assets, Reviewed Count, Coverage Pct, Certification Pct |
| `mv_user_leaderboard` | user_activity | Total Reviews, Edits Accepted, Current Streak |
| `mv_feedback_pipeline` | feedback_batches | Total Batches, Success Rate, Avg Processing Time |
| `mv_campaign_progress` | campaigns, campaign_assets | Active Campaigns, Assets Per Campaign, Completion Pct |
| `mv_otel_error_rate` | (OTel logs table) | Error Count, Total Logs, Error Rate |
| `mv_otel_request_latency` | (OTel spans table) | p50/p95/p99 Latency |

---

## 5. Troubleshooting

**Pipeline fails with `PY4J_BLOCKED_API`:** The SDP serverless environment blocks `spark.catalog.tableExists()`. The `CdfBronzeBuilder` uses `information_schema.tables` instead. If a new method introduces `spark.catalog.*`, replace it with an equivalent SQL query.

**Pipeline fails with `DELTA_FEATURES_REQUIRE_MANUAL_ENABLEMENT: timestampNtz`:** Ensure the streaming table definition includes `table_properties={"delta.feature.timestampNtz": "supported"}`.

**Metric view deploy shows 0 iterations:** Check that `fixtures_path` in `metric_view_deploy.job.yml` is set to `${workspace.file_path}/fixtures/metric_views` (not an empty string).

**Statement Execution API timeout:** The `deploy_metric_view.py` notebook caps `wait_timeout` at 50s and polls for longer-running statements.
