# L300-05 — Metric Views over Lakebase CDF Tables

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Genie Code session
**Prerequisites:** L300-02 complete (Lakebase with CDF enabled)
**References:** L200-C9 § Metric Views, L100 § Deployment Architecture (Bundle 1)

---

### Step 1: Verify CDF Delta tables exist

**Type:** Manual (SQL)

```sql
-- After CDF is enabled and some data exists, verify the Delta tables
SHOW TABLES IN ${catalog}.${schema} LIKE 'lb_*';

-- Expected: lb_assets_history, lb_votes_history, lb_user_activity_history, 
--           lb_confidence_scores_history, lb_campaigns_history, lb_feedback_batches_history
```

### Step 2: Create operational metric views

**Type:** Genie Code session

Prompt:
```
Create 4 metric view fixture YAMLs in bundle-infra/fixtures/ for the operational 
Genie Agent (C9). Each metric view reads from Lakebase CDF Delta tables.

Target catalog: ${catalog}, schema: ${schema}

1. fixtures/mv_review_activity.yaml:
   Source: ${catalog}.${schema}.lb_votes_history
   Fields: Vote Date (DATE from _pg_timestamp), Vote Type, User ID, Asset Type
   Measures: Total Votes (COUNT), Unique Reviewers (COUNT DISTINCT user_id), 
             Approval Rate (SUM approve / COUNT)

2. fixtures/mv_coverage_metrics.yaml:
   Source: ${catalog}.${schema}.lb_assets_history
   Fields: Asset Type, Domain, Environment
   Measures: Total Assets (COUNT DISTINCT asset_id), 
             Reviewed Assets (COUNT DISTINCT WHERE total_votes > 0),
             Certified Assets (COUNT DISTINCT WHERE confidence_score >= threshold),
             Coverage Pct (Reviewed / Total)

3. fixtures/mv_user_leaderboard.yaml:
   Source: ${catalog}.${schema}.lb_user_activity_history
   Fields: User ID, User Email
   Measures: Total Reviews, Edits Accepted, Current Streak Days, 
             Badges Earned

4. fixtures/mv_feedback_pipeline.yaml:
   Source: ${catalog}.${schema}.lb_feedback_batches_history
   Fields: Batch Date (DATE from created_at), Status
   Measures: Total Batches (COUNT), Completed Batches, Failed Batches,
             Success Rate (Completed / Total), Avg Processing Time
```

### Step 3: Deploy metric views via forEach task

**Type:** Manual (CLI)

```bash
# The metric_view_deploy job iterates over fixtures/ and deploys each
databricks bundle run -t dev metric_view_deploy
```

### Step 4: Verify metric views are queryable

**Type:** Manual (SQL)

```sql
-- Test each metric view
SELECT MEASURE(`Total Votes`), `Vote Date`
FROM ${catalog}.${schema}.mv_review_activity
WHERE `Vote Date` >= DATEADD(DAY, -7, CURRENT_DATE())
GROUP BY `Vote Date`
ORDER BY `Vote Date`;
```

---

### Open Questions

1. **CDF table availability timing:** How long after enabling CDF do the Delta tables appear? Is there a race condition if we try to create metric views before any data flows through?
