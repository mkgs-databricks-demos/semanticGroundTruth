# L200-C8 — Executive Dashboard

## Component Design Document

**Component:** C8 — Executive Dashboard
**Type:** AI/BI Dashboard or React views
**Owner:** TBD
**References:** L100 § Component Inventory (C8)

---

### Overview

The Executive Dashboard provides visibility into the Ground Truth App's operational health, coverage progress, and ROI metrics. It can be implemented as an AI/BI Dashboard (for customers who prefer native Databricks dashboards) or as React views within the standalone app.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C1 Asset Registry (via CDF) | Data source | Operational data via Lakebase CDF Delta tables |
| Metric Views (Bundle 1) | Data source | Pre-computed KPIs |
| SQL Warehouse (Bundle 1) | Compute | Dashboard query execution |

### Design

#### KPI Definitions

| KPI | Formula | Granularity |
|---|---|---|
| **Coverage %** | Assets with ≥1 vote / Total assets | Domain, subdomain, asset type |
| **Certification %** | Assets above threshold / Total assets | Domain, subdomain, asset type |
| **Avg. Time to Certification** | AVG(first_certified_at - created_at) | Domain, asset type |
| **Active Reviewers (T7D)** | COUNT(DISTINCT user_id) WHERE vote_date ≥ NOW() - 7d | Overall, domain |
| **Vote Throughput** | COUNT(votes) per day/week | Overall, domain |
| **Confidence Distribution** | Histogram of Wilson scores | Overall |
| **Rejection Rate** | Rejections / Total votes | Domain, asset type |
| **Feedback Pipeline Success Rate** | Completed batches / Total batches | Overall |
| **Avg. Votes to Certification** | AVG(total_votes) WHERE certified = TRUE | Asset type |
| **Top Reviewers** | Ranked by vote count, edits accepted, streak | Overall |

#### Dashboard Layout

**Page 1: Executive Summary**
- Coverage % (card), Certification % (card), Active Reviewers T7D (card)
- Coverage trend over time (line chart)
- Certification progress by domain (stacked bar)

**Page 2: Participation**
- Top 10 reviewers leaderboard (table)
- Vote throughput trend (line chart)
- Active reviewers by domain (heatmap)

**Page 3: Quality**
- Confidence score distribution (histogram)
- Rejection rate by domain (bar chart)
- Avg. time to certification by asset type (bar chart)

**Page 4: Operations**
- Feedback pipeline success rate (card)
- Pending feedback batches (table)
- Stale assets approaching freshness interval (table)

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Dashboard load time | < 5s | Pre-computed metric views |
| Data freshness | < 1 minute | CDF replication ~15s + metric view refresh |
| Drill-down latency | < 3s | Filter by domain, subdomain, asset type |

### Testing

- **KPI accuracy tests:** Each KPI formula produces correct results against known test data
- **Dashboard render tests:** All visualizations render correctly with various data shapes
- **Empty state tests:** Dashboard handles zero votes, zero assets gracefully

### Deployment

- Metric views deployed in Bundle 1 (Infra)
- Dashboard views in Bundle 2 (App) React frontend, or as a separate AI/BI Dashboard
- SQL Warehouse from Bundle 1

> See [docs/diagrams/mermaid/04_data_flow.md] for the end-to-end data flow showing how CDF feeds the dashboard.

### Resolved Questions

1. ✅ **Both — AI/BI Dashboard as primary, React summary in app.** Executive dashboard is a native AI/BI Dashboard (customizable, shareable, schedulable). Standalone app includes React summary cards linking to the full dashboard.
2. ✅ **~15s CDF lag is acceptable.** Executives don't need sub-second data for operational dashboards.
3. ✅ **PDF/CSV export via AI/BI Dashboard native capabilities.** Scheduled snapshots (PNG + PDF) to Slack/Teams already supported.
