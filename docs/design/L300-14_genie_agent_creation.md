# L300-14 — Genie Agent Creation + Curated Instructions

## Implementation Spec

**Phase:** 3 (Bundle 3 — Genie Agent)
**Type:** Genie Code session + Manual
**Prerequisites:** L300-08 complete (Bundle 1 metric views deployed)
**References:** L200-C9

---


> See [docs/diagrams/mermaid/04_data_flow.md] for how the Genie Agent connects to CDF metric views.
### Step 1: Create the Genie Agent

**Type:** Manual (workspace UI or API)

1. Navigate to Genie Agents
2. Create new agent: "Ground Truth Operations"
3. Add metric views from Bundle 1:
   - `${catalog}.${schema}.mv_review_activity`
   - `${catalog}.${schema}.mv_coverage_metrics`
   - `${catalog}.${schema}.mv_user_leaderboard`
   - `${catalog}.${schema}.mv_feedback_pipeline`
4. Set SQL Warehouse to the one provisioned in Bundle 1

### Step 2: Add curated instructions

**Type:** Manual (Genie Agent UI)

Add the following general instructions:

```
You are the Ground Truth App operational analytics agent. You answer questions 
about the app's usage, reviewer participation, coverage progress, and ROI.

Key concepts:
- Coverage % = assets with at least 1 vote / total assets
- Certification % = assets above the Wilson score threshold / total assets
- Wilson score = confidence metric that penalizes small sample sizes
- Freshness = how recently a production asset was re-validated
- Approval Rate = approvals / total votes

When asked about ROI, frame it as:
- Time saved vs. manual review processes
- Coverage velocity (how fast are we validating the semantic layer?)
- Quality improvement (rejection rate trends, confidence score trends)

Always specify the time range in your queries. Default to last 30 days if not specified.
```

### Step 3: Add example SQL instructions

**Type:** Manual (Genie Agent UI)

Add example queries:

```sql
-- Top 10 reviewers this month
SELECT `User ID`, MEASURE(`Total Reviews`) as reviews
FROM ${catalog}.${schema}.mv_user_leaderboard
GROUP BY `User ID`
ORDER BY reviews DESC
LIMIT 10

-- Coverage % by domain
SELECT `Domain`, MEASURE(`Coverage Pct`) as coverage
FROM ${catalog}.${schema}.mv_coverage_metrics
WHERE `Environment` = 'production'
GROUP BY `Domain`

-- Vote throughput trend (last 30 days)
SELECT `Vote Date`, MEASURE(`Total Votes`) as votes, MEASURE(`Unique Reviewers`) as reviewers
FROM ${catalog}.${schema}.mv_review_activity
WHERE `Vote Date` >= DATEADD(DAY, -30, CURRENT_DATE())
GROUP BY `Vote Date`
ORDER BY `Vote Date`
```

### Step 4: Configure Bundle 3 `databricks.yml`

**Type:** Manual (editor)

Create `bundle-agent/databricks.yml`:

```yaml
bundle:
  name: ground-truth-agent

variables:
  catalog:
    description: "Target UC catalog (must match Bundle 1)"
  schema:
    description: "Target UC schema (must match Bundle 1)"
  genie_agent_id:
    description: "Genie Agent ID (created in Step 1)"

workspace:
  root_path: /Workspace/Shared/.bundles/${bundle.name}/${bundle.target}

resources:
  genie_agents:
    ground_truth_ops:
      display_name: "Ground Truth Operations"
      description: "Conversational analytics on Ground Truth App usage, ROI, and operational health"
      table_identifiers:
        - "${var.catalog}.${var.schema}.mv_review_activity"
        - "${var.catalog}.${var.schema}.mv_coverage_metrics"
        - "${var.catalog}.${var.schema}.mv_user_leaderboard"
        - "${var.catalog}.${var.schema}.mv_feedback_pipeline"
      sql_warehouse_id: ${var.warehouse_id}

targets:
  dev:
    default: true
    variables:
      catalog: "dev_ground_truth"
      schema: "app"
```

### Step 5: Deploy Bundle 3

**Type:** Manual (CLI)

```bash
cd bundle-agent
databricks bundle validate -t dev
databricks bundle deploy -t dev --auto-approve
```

---

### Open Questions

1. **Genie Agent in DAB:** Is the `genie_agents` resource type fully supported in DABs for declarative deployment? If not, the agent must be created via UI/API and the DAB only manages supporting resources.
