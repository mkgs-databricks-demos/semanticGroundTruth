# L200-C5 — Campaign Manager

## Component Design Document

**Component:** C5 — Campaign Manager
**Type:** Node.js service + Lakebase
**Owner:** TBD
**References:** L100 § Campaign Model

---

### Overview

The Campaign Manager handles the lifecycle of review campaigns — automatic, manual, and freshness-based. It determines which assets are in the active review pool, manages RBAC assignments, and triggers campaigns when assets are created, modified, or become stale.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| C1 Asset Registry | Data source | Asset metadata, version changes |
| C2 Review Engine | Consumer | Provides active campaign pool to surfacing algorithm |
| Lakebase (Bundle 1) | Infrastructure | Campaign and assignment tables |

### Design

#### Lakebase Schema

```sql
CREATE TABLE campaigns (
    campaign_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    campaign_type   TEXT NOT NULL CHECK (campaign_type IN ('automatic', 'manual', 'freshness')),
    status          TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    
    -- Scoping
    scope_domain    TEXT,
    scope_subdomain TEXT,
    scope_asset_type TEXT,
    scope_asset_ids UUID[],
    
    -- Freshness config
    freshness_interval_days INTEGER,
    
    -- Metadata
    created_by      TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE campaign_assignments (
    assignment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(campaign_id),
    rbac_group      TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Campaign Types

**Automatic:** Triggered when an asset version changes (new `version_hash` detected). Creates a campaign scoped to the changed asset. Default assignment: all users.

**Manual:** Created by a Data Steward via the Admin UI. Scoped by domain, subdomain, asset type, or specific asset IDs. Can be assigned to specific RBAC groups.

**Freshness:** Background job checks `last_reviewed_at` against configurable `freshness_interval_days`. Assets exceeding the interval are added to a freshness campaign. Runs daily.

#### Campaign Lifecycle

```
Created → Active → Completed (all assets reach certification threshold)
                 → Paused (Data Steward pauses)
                 → Archived (manually archived)
```

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Campaign creation | < 100ms | Single row insert |
| Active campaign query | < 50ms | Indexed by status |
| Freshness check | < 5 minutes | Daily batch scan of all production assets |

### Testing

- **Lifecycle tests:** Campaign state transitions (create → active → complete)
- **Auto-trigger tests:** Version change triggers automatic campaign
- **Freshness tests:** Assets exceeding interval are correctly surfaced
- **RBAC tests:** Users only see campaigns assigned to their groups

### Deployment

- Part of Bundle 2 (App) — Node.js service
- Campaign tables created in Bundle 1 (Infra)
- Freshness check job runs as a Lakeflow Job in Bundle 1

> See [docs/diagrams/mermaid/12_campaign_lifecycle.md] for the campaign lifecycle state diagram.

### Resolved Questions

1. ✅ **Yes — assets can be in multiple campaigns.** Surfacing algorithm unions all active campaign pools. Coverage-weighted algorithm naturally surfaces least-reviewed assets. A vote counts toward all campaigns the asset belongs to.
2. ✅ **Configurable per campaign, default = all assets reviewed at least once.** Certification is continuous (Wilson score improves with more votes), so tying completion to certification could leave campaigns open indefinitely. "Reviewed at least once" is an achievable milestone. Data Steward can set stricter criteria per campaign.
3. ✅ **180 days default, configurable per domain.** Recommended tiers: 60 days (rapidly evolving domains), 180 days (default), 365 days (stable core metrics like financial definitions).
