# L200-C2 — Review Engine

## Component Design Document

**Component:** C2 — Review Engine
**Type:** Node.js AppKit service
**Owner:** TBD
**References:** L100 § Component Inventory, § Interface Contracts, § Smart Surfacing Algorithm, § Confidence Scoring Model

---

### Overview

The Review Engine is the core business logic layer. It implements the smart surfacing algorithm, processes votes, computes Wilson confidence scores, and exposes the REST API consumed by both the Card UI (C3) and MCP Server (C4). It is the single point of truth for "what should this user review next?" and "how confident are we in this asset?"

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C1 Asset Registry | Data source | Reads reviewable asset pool; writes votes and scores |
| C5 Campaign Manager | Input | Active campaigns determine which assets are in the review pool |
| C3 Card UI | Consumer | Calls Review Engine REST API |
| C4 MCP Server | Consumer | Wraps Review Engine API as MCP tools |
| SQL Warehouse (Bundle 1) | Compute | Executes sample queries via OBO auth |

### Design

#### REST API

```
GET  /api/review/next
  Query params: ?user_id=<string>&campaign_id=<uuid>&asset_type=<string>
  Response: { card: ReviewCard, remaining_count: number }

POST /api/review/vote
  Body: { asset_id, vote: "approve"|"reject"|"edit", feedback?, edits?: { description?, synonyms_add?, synonyms_remove?, logic_correction? } }
  Response: { vote_id, new_confidence_score, user_stats }

POST /api/review/synonym
  Body: { asset_id, action: "add"|"remove", synonym: string }
  Response: { synonym_id, action_result }

POST /api/review/example
  Body: { asset_id, action: "add"|"approve"|"reject", question_text?: string, question_id?: uuid }
  Response: { question_id, action_result }

GET  /api/review/stats
  Query params: ?user_id=<string>
  Response: { user_stats: UserStats, leaderboard: LeaderboardEntry[], coverage: CoverageStats }

POST /api/review/run-query
  Body: { asset_id }
  Response: { query_result: { columns: Column[], rows: any[][], row_count: number, truncated: boolean } }
  Auth: OBO (user's UC permissions enforced)
```

#### Smart Surfacing Algorithm

```
function getNextCard(userId, campaignId?, assetType?):
  1. Get active campaign pool (or all assets if no campaign specified)
  2. Filter out assets this user has already reviewed at current version
  3. Filter by asset_type if specified
  4. Filter by RBAC (user's group membership vs. campaign assignments)
  5. Weight remaining assets by inverse of total_votes (fewer votes = higher weight)
  6. Apply freshness boost: assets approaching freshness expiry get 2x weight
  7. Weighted random selection from the pool
  8. Return selected asset as ReviewCard
```

**Key properties:**
- Sample without replacement (per user, per version)
- Coverage-weighted (assets with fewest votes surface first)
- Version-aware (updated assets re-enter the pool)
- Freshness-aware (stale production assets get priority boost)
- Deterministic for a given state (reproducible for testing)

#### Wilson Score Computation

```python
def compute_confidence(asset_id, z=1.96):
    votes = get_votes(asset_id, current_version)
    n = len(votes)
    x = count(v for v in votes if v.type == 'approve')
    
    if n == 0:
        return industry_prior  # configurable, default 0.5
    
    p_hat = x / n
    
    # Wilson lower bound
    wilson = (
        p_hat + z*z / (2*n)
        - z * sqrt(p_hat * (1 - p_hat) / n + z*z / (4*n*n))
    ) / (1 + z*z / n)
    
    # Blend with industry prior (decaying weight)
    prior = get_industry_prior(asset_id)
    prior_weight = max(0, 1 - n / prior_decay_threshold)  # decays to 0
    
    blended = prior_weight * prior + (1 - prior_weight) * wilson
    
    return blended
```

**Recomputation trigger:** Score is recomputed on every vote and materialized in `confidence_scores` table for fast reads.

#### Sample Query Execution

When a user clicks "Run a common aggregation":

1. Check if the asset has pre-configured `example_queries` in its fixture YAML
2. If yes, select one and execute via SQL Statement Execution API with OBO auth
3. If no, generate a simple aggregation query from the metric view definition using Genie Code
4. Execute against the appropriate environment (staging for candidates, production for freshness)
5. Return truncated results (max 100 rows) to the UI

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| `GET /api/review/next` latency | < 200ms p95 | Surfacing algorithm must be fast |
| `POST /api/review/vote` latency | < 100ms p95 | Vote + score recomputation |
| `POST /api/review/run-query` latency | < 30s p95 | Depends on SQL Warehouse |
| Concurrent users | 100+ simultaneous | Vote inserts must not conflict |
| Score accuracy | Wilson score matches reference implementation | Deterministic testing required |

### Testing

- **Unit tests:** Wilson score computation against known values (see research doc 02)
- **Surfacing algorithm tests:** Verify coverage-weighted distribution, version-awareness, freshness boost
- **API contract tests:** All 6 endpoints with valid/invalid inputs
- **Concurrency tests:** 100 simultaneous votes on the same asset — no lost votes, correct final score
- **Deterministic scoring tests:** Large representative sample of correctly calculated scores at multiple granularities (per L200-F methodology from Rapid Ontology Standup)

### Deployment

- Deployed as part of Bundle 2 (App) — Node.js AppKit service
- Shares the same process as C5 Campaign Manager and C7 Notification Service
- Reads from Lakebase via the app's SP connection
- Executes sample queries via OBO using the user's forwarded token

### Resolved Questions

1. ✅ **No weighting by role for V1.** All votes are equal — this is the "ground truth" philosophy. Wilson score handles the math. Data Steward's power is in the final certification decision, not weighted votes. Revisit for V2 if requested.
2. ✅ **Synchronous for V1.** Wilson score is O(1) arithmetic — recompute on every vote and materialize. No async complexity needed. Move to async (Lakebase trigger or CDF-driven) only if scale issues emerge.
3. ✅ **Two fallback strategies:** (a) Simple `SELECT dimension, MEASURE(measure) FROM view GROUP BY dimension LIMIT 10` auto-generated from YAML. (b) **Unit test walkthrough** — "Suppose this was your data set, the result would be: X" — a pre-computed example with known inputs and expected outputs that's easy for business users to verify. Data Steward can always add proper example queries to the fixture YAML later.
4. ✅ **No hard limit for V1.** Track velocity via an optional (default deployed) **Lakehouse Monitor quality monitor** on the Lakebase CDF tables. Anomalous patterns (e.g., 500 approvals in 10 minutes) flagged for Data Steward review. Configurable Admin limit available if a customer needs it.

> See [docs/diagrams/mermaid/06_card_lifecycle.md] for the card lifecycle state diagram.
> See [docs/diagrams/mermaid/11_surfacing_algorithm.md] for the surfacing algorithm flowchart. for the card lifecycle state diagram.
