# L200-C9 — Operational Genie Agent

## Component Design Document

**Component:** C9 — Operational Genie Agent
**Type:** Genie Agent (UC Metric Views + curated instructions)
**Owner:** TBD
**References:** L100 § Component Inventory (C9), § Deployment Architecture (Bundle 3)

---

### Overview

The Operational Genie Agent enables executives and admins to ask conversational questions about the Ground Truth App's usage, ROI, and operational health. It is backed by metric views over the app's own Lakebase CDF data and deployed as a separate Genie Agent in Bundle 3.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| Metric Views (Bundle 1) | Data source | Pre-computed KPIs over Lakebase CDF Delta tables |
| SQL Warehouse (Bundle 1) | Compute | Agent query execution |
| Lakebase CDF (Bundle 1) | Data source | Near-real-time operational data |
| Genie Agent Platform | Runtime | Agent hosting, OBO auth, agent mode |

### Design

#### Metric Views

The following metric views are deployed in Bundle 1 over Lakebase CDF Delta tables:

```yaml
# mv_review_activity — Review activity metrics
version: 1.1
source: <catalog>.<schema>.lb_votes_history
fields:
  - name: Vote Date
    expr: DATE(_pg_timestamp)
  - name: Vote Type
    expr: _pg_change_type
  - name: User ID
    expr: user_id
  - name: Asset Type
    expr: asset_type
  - name: Domain
    expr: domain
measures:
  - name: Total Votes
    expr: COUNT(1)
  - name: Unique Reviewers
    expr: COUNT(DISTINCT user_id)
  - name: Approval Rate
    expr: SUM(CASE WHEN vote_type = 'approve' THEN 1 ELSE 0 END) / COUNT(1)
```

```yaml
# mv_coverage_metrics — Coverage and certification metrics
version: 1.1
source: <catalog>.<schema>.lb_assets_history
fields:
  - name: Asset Type
    expr: asset_type
  - name: Domain
    expr: domain
  - name: Environment
    expr: environment
measures:
  - name: Total Assets
    expr: COUNT(DISTINCT asset_id)
  - name: Reviewed Assets
    expr: COUNT(DISTINCT CASE WHEN total_votes > 0 THEN asset_id END)
  - name: Certified Assets
    expr: COUNT(DISTINCT CASE WHEN confidence_score >= certification_threshold THEN asset_id END)
  - name: Coverage Pct
    expr: COUNT(DISTINCT CASE WHEN total_votes > 0 THEN asset_id END) / COUNT(DISTINCT asset_id)
```

#### Curated Instructions

```
You are the Ground Truth App operational analytics agent. You answer questions 
about the app's usage, reviewer participation, coverage progress, and ROI.

Key concepts:
- Coverage % = assets with at least 1 vote / total assets
- Certification % = assets above the Wilson score threshold / total assets
- Wilson score = confidence metric that penalizes small sample sizes
- Freshness = how recently a production asset was re-validated

Available metric views:
- mv_review_activity: vote counts, unique reviewers, approval rates by date/domain/asset type
- mv_coverage_metrics: coverage %, certification %, asset counts by domain/environment
- mv_user_leaderboard: top reviewers by vote count, edits accepted, streaks
- mv_feedback_pipeline: batch success rates, pending items, processing times

When asked about ROI, frame it as:
- Time saved vs. manual review processes
- Coverage velocity (how fast are we validating the semantic layer?)
- Quality improvement (rejection rate trends, confidence score trends)
```

#### Example Questions

- "Who are our top 10 reviewers this month?"
- "What's the coverage % for the Claims domain?"
- "How long does it take on average from first review to certification?"
- "Show me the approval rate trend over the last 30 days"
- "Which domains have the most stale assets?"
- "What's our feedback pipeline success rate this week?"

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Query response time | < 10s | Depends on SQL Warehouse |
| Data freshness | < 1 minute | CDF ~15s + metric view refresh |
| Agent accuracy | > 90% | Measured via Genie Agent benchmarking |

### Testing

- **Metric view accuracy:** Each metric view produces correct results against known test data
- **Agent benchmarking:** Run the example questions through the agent and verify correct SQL generation and results
- **OBO auth tests:** Agent respects user permissions (admin sees all, reviewer sees their own stats)

### Deployment

- Bundle 3 (Genie Agent) — deployed after Bundle 1, parallel with Bundle 2
- Metric views referenced from Bundle 1
- SQL Warehouse from Bundle 1
- Agent mode with OBO authentication

> See [docs/diagrams/mermaid/07_component_topology.md] for how C9 connects to the rest of the system.

### Resolved Questions

1. ✅ **Start with 4 metric views, expand as needed.** `mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`.
2. ✅ **Defer agent persona to V2.** For V1, it's "the Ground Truth operational agent." Personality/name is a V2 engagement feature.
3. ✅ **No cross-customer benchmarking for V1.** Each deployment is isolated. Revisit at 10+ customer deployments.
4. ✅ **Admin-only in Genie One for V1.** Scoped via UC permissions — only admin/executive roles see it.
