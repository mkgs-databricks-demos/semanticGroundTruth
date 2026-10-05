# Research: Wilson Score Interval & Lakebase CDF

## Date: 2026-09-29

## 1. Wilson Score Interval — Confidence Scoring Model

### Why Wilson Score?
The Ground Truth App needs to rank UC semantic assets by how confidently they've been validated. The Wilson score interval is ideal because:
- It handles **small sample sizes** gracefully (an asset with 1 approval out of 1 vote doesn't get a perfect score)
- It naturally **penalizes low vote counts** while rewarding both high approval ratios and sufficient sample sizes
- It's the same algorithm Reddit uses for ranking — well-understood and battle-tested

### Formula (Lower Bound)

For an asset with:
- x = number of approvals (positive votes)
- n = total votes
- p̂ = x/n = observed approval proportion
- z = 1.96 (95% confidence)

```
score = (p̂ + z²/2n - z√(p̂(1-p̂)/n + z²/4n²)) / (1 + z²/n)
```

### Python Implementation

```python
from math import sqrt

def wilson_lower_bound(positive, total, z=1.96):
    if total == 0:
        return 0.0
    p = positive / total
    return (
        p + z*z / (2 * total)
        - z * sqrt(
            p * (1 - p) / total
            + z*z / (4 * total * total)
        )
    ) / (1 + z*z / total)
```

### Examples
| Approvals | Total Votes | Observed % | Wilson Score |
|-----------|-------------|------------|--------------|
| 1 | 1 | 100% | ~0.207 |
| 3 | 5 | 60% | ~0.231 |
| 60 | 100 | 60% | ~0.502 |
| 95 | 100 | 95% | ~0.897 |

Key insight: 1/1 (100%) scores LOWER than 60/100 (60%) — the algorithm correctly penalizes insufficient sample size.

### Extension for Ground Truth App
The base Wilson score handles binary approve/reject. For the Ground Truth App, we extend with:
- **Industry standard prior:** Before any business votes, the score starts at a configurable prior based on industry standard definitions (e.g., 0.5 = neutral). As business votes accumulate, the prior's influence decays.
- **Configurable z-value:** Data Steward can adjust the confidence level (higher z = more conservative scoring).
- **Certification threshold:** A configurable Wilson score threshold (e.g., 0.7) that an asset must exceed to be considered certified.

---

## 2. Lakebase Change Data Feed (CDF)

### What is Lakebase CDF?
Lakebase CDF captures every insert, update, and delete on a Lakebase Postgres table from the write-ahead log and stores it as a new row in a Unity Catalog managed Delta table. Changes are batched and flushed every ~15 seconds.

**Status:** Public Preview

### How it works
- Each change row carries: `_pg_change_type`, LSN, transaction ID, timestamp
- Destination tables follow the naming pattern: `lb_<table_name>_history`
- Tables are stored in the UC catalog and schema you choose
- Same shape as Delta Change Data Feed

### Setup
1. Set `REPLICA IDENTITY FULL` on the Postgres tables you want in the feed
2. Start CDF from the Lakebase UI or API
3. Data appears as `lb_<table_name>_history` Delta tables in UC

### Relevance to Ground Truth App
Lakebase CDF is critical for:
- **C9 Operational Genie Agent:** The metric views that power the Genie Agent read from CDF Delta tables, not directly from Postgres. This means the agent gets near-real-time operational data (~15s latency) without querying the OLTP database.
- **C8 Executive Dashboard:** Same pattern — dashboards read from CDF Delta tables.
- **Audit trail:** CDF provides an immutable history of all vote changes, campaign modifications, and score updates.
- **MCP Service co-location:** The CDF Delta tables live in the same catalog.schema as the Unity Gateway connection for the MCP Service — everything is co-located.

### Architecture Pattern
```
Lakebase (Postgres)
    ↓ WAL capture (~15s batches)
lb_votes_history (Delta in UC)
lb_campaigns_history (Delta in UC)
lb_user_activity_history (Delta in UC)
    ↓
Metric Views (Bundle 1)
    ↓
C9 Genie Agent / C8 Dashboard
```
