# L200-C1 — Asset Registry

## Component Design Document

**Component:** C1 — Asset Registry
**Type:** Lakebase tables + Node.js service layer
**Owner:** TBD
**References:** L100 § Component Inventory, § Interface Contracts, § Lakebase Schema

---

### Overview

The Asset Registry is the central data store that tracks all UC semantic assets under review. It maintains the mapping between each asset and its owning DAB repo, fixture path, version, environment, and current review state. All other components read from or write to the Asset Registry.

### Dependencies

| Dependency | Type | Description |
|---|---|---|
| Lakebase (Bundle 1) | Infrastructure | Postgres database for all registry tables |
| Lakebase CDF (Bundle 1) | Infrastructure | Change Data Feed for Delta table replication to UC |
| DAB Repos (External) | Data source | Fixture YAMLs parsed and registered |
| UC Entity Store (External) | Data source | Pages, Domains, Subdomains metadata |
| C2 Review Engine | Consumer | Reads reviewable asset pool |
| C5 Campaign Manager | Consumer | Reads asset metadata for campaign scoping |
| C6 Feedback Pipeline | Consumer | Reads unprocessed feedback; writes batch status |
| C8 Executive Dashboard | Consumer | Reads operational metrics via CDF Delta tables |
| C9 Genie Agent | Consumer | Reads operational metrics via metric views over CDF |

### Design

#### Lakebase Schema (Detailed)

##### `assets` — Core asset registry

```sql
CREATE TABLE assets (
    asset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('measure', 'dimension', 'page', 'domain', 'subdomain')),
    name            TEXT NOT NULL,
    description     TEXT,
    plain_english_logic TEXT,
    yaml_content    TEXT,
    
    -- GitOps lineage
    repo_url        TEXT NOT NULL,
    fixture_path    TEXT NOT NULL,
    branch          TEXT NOT NULL DEFAULT 'main',
    
    -- Environment mapping
    environment     TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
    target_catalog  TEXT NOT NULL,
    target_schema   TEXT NOT NULL,
    
    -- Versioning
    version         INTEGER NOT NULL DEFAULT 1,
    version_hash    TEXT NOT NULL,
    
    -- State
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_score DOUBLE PRECISION DEFAULT 0.0,
    total_votes     INTEGER DEFAULT 0,
    total_approvals INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    
    -- Unique constraint: one asset per repo+path+environment
    UNIQUE (repo_url, fixture_path, environment)
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_environment ON assets(environment);
CREATE INDEX idx_assets_confidence ON assets(confidence_score);
CREATE INDEX idx_assets_last_reviewed ON assets(last_reviewed_at);
```

##### `asset_versions` — Version history

```sql
CREATE TABLE asset_versions (
    version_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    version         INTEGER NOT NULL,
    version_hash    TEXT NOT NULL,
    yaml_content    TEXT NOT NULL,
    description     TEXT,
    plain_english_logic TEXT,
    change_source   TEXT CHECK (change_source IN ('manual', 'genie_code', 'import')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (asset_id, version)
);
```

##### `asset_synonyms` — Synonyms per asset

```sql
CREATE TABLE asset_synonyms (
    synonym_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    synonym         TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    added_by        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (asset_id, synonym)
);
```

##### `votes` — Individual votes

```sql
CREATE TABLE votes (
    vote_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    asset_version   INTEGER NOT NULL,
    user_id         TEXT NOT NULL,
    user_email      TEXT,
    vote_type       TEXT NOT NULL CHECK (vote_type IN ('approve', 'reject', 'edit')),
    feedback        TEXT,
    edits_json      JSONB,
    campaign_id     UUID,
    
    -- Processing state
    processed       BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_batch_id UUID,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One vote per user per asset version
    UNIQUE (asset_id, asset_version, user_id)
);

CREATE INDEX idx_votes_unprocessed ON votes(processed) WHERE processed = FALSE;
CREATE INDEX idx_votes_asset ON votes(asset_id);
CREATE INDEX idx_votes_user ON votes(user_id);
```

##### `synonym_votes` — Votes on synonyms

```sql
CREATE TABLE synonym_votes (
    synonym_vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synonym_id      UUID NOT NULL REFERENCES asset_synonyms(synonym_id),
    user_id         TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (synonym_id, user_id)
);
```

##### `example_questions` — "Use It in a Sentence"

```sql
CREATE TABLE example_questions (
    question_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID NOT NULL REFERENCES assets(asset_id),
    question_text   TEXT NOT NULL,
    added_by        TEXT NOT NULL,
    is_pre_seeded   BOOLEAN NOT NULL DEFAULT FALSE,
    total_approvals INTEGER DEFAULT 0,
    total_rejections INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_example_questions_asset ON example_questions(asset_id);
```

##### `confidence_scores` — Materialized Wilson scores

```sql
CREATE TABLE confidence_scores (
    asset_id        UUID PRIMARY KEY REFERENCES assets(asset_id),
    wilson_score    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_votes     INTEGER NOT NULL DEFAULT 0,
    total_approvals INTEGER NOT NULL DEFAULT 0,
    industry_prior  DOUBLE PRECISION DEFAULT 0.5,
    prior_weight    DOUBLE PRECISION DEFAULT 1.0,
    z_value         DOUBLE PRECISION DEFAULT 1.96,
    last_computed   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### `feedback_batches` — Processed feedback batches

```sql
CREATE TABLE feedback_batches (
    batch_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    vote_count      INTEGER NOT NULL DEFAULT 0,
    feature_branch_url TEXT,
    repo_url        TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

#### Asset Discovery & Registration

Assets enter the registry through two paths:

1. **Fixture YAML import:** A registration job scans DAB repo `fixtures/` folders, parses each YAML, and upserts into the `assets` table. Version hash is computed from YAML content to detect changes.

2. **UC entity store import:** Pages, Domains, and Subdomains are read from the UC entity store and registered with their descriptions.

#### Version Detection

```
version_hash = SHA256(yaml_content + description + synonyms_sorted)
```

When a fixture YAML changes (new hash), the asset version increments and a new `asset_versions` row is created. This triggers an automatic review campaign for the updated asset.

#### Lakebase CDF Configuration

All tables above are configured with `REPLICA IDENTITY FULL` for CDF. The resulting Delta tables (`lb_assets_history`, `lb_votes_history`, etc.) power the metric views in Bundle 1 and the Genie Agent in Bundle 3.

### Non-Functional Requirements

| NFR | Target | Notes |
|---|---|---|
| Read latency (asset lookup) | < 10ms p95 | Indexed by asset_id, type, environment |
| Write latency (vote insert) | < 50ms p95 | Single row insert |
| CDF replication lag | < 30s | Lakebase CDF batches every ~15s |
| Storage | Scales with asset count | Expect 100s–10,000s of assets per deployment |
| Availability | 99.9% | Lakebase managed availability |

### Testing

- **Unit tests:** Schema validation, version hash computation, unique constraint enforcement
- **Integration tests:** YAML import pipeline, CDF replication verification, cross-table referential integrity
- **Load tests:** Concurrent vote inserts (simulate 100+ users voting simultaneously)
- **Migration tests:** Schema migration scripts tested against copy-on-write Lakebase branches

### Deployment

- All tables created in Bundle 1 (Infra) via Lakebase migration scripts
- CDF enabled on all tables during post-deploy
- Indexes created after initial data load
- Copy-on-write branches (dev, test) for safe schema iteration

> See [docs/diagrams/mermaid/10_lakebase_er_diagram.md] for the Lakebase ER diagram.

### Resolved Questions

1. ✅ **Asset discovery:** Registered on first DAB deploy — the post-deploy job in each customer's DAB repo calls the Ground Truth App's registration API (`POST /api/assets/register` with `repo_url`, `fixture_path`, `target_catalog`, `target_schema`). Fallback: Admin can manually register repos without the post-deploy hook.
2. ✅ **Cross-repo assets:** No — each asset has exactly one owning repo (`repo_url + fixture_path` = unique owner). Cross-repo references (e.g., metric view referencing dimensions from another repo) are registered separately from their own repo. Cross-repo consistency is the Data Steward's responsibility.
3. ✅ **Soft delete:** When a fixture YAML is removed, the asset is soft-deleted (`is_active = FALSE`). Vote history, confidence scores, and audit trail are preserved. Admin can purge obsolete assets manually.
4. ✅ **Schema migration:** Both — production uses numbered Flyway-style migration scripts (versioned in the DAB repo, applied by post-deploy job). Dev/test branches use Lakebase copy-on-write reset from production for fast iteration.
