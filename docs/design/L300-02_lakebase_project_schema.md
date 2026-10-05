# L300-02 — Lakebase Project + Branches + Schema Migrations

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual CLI + SQL
**Prerequisites:** L300-01 complete, Databricks CLI authenticated
**References:** L200-C1 § Lakebase Schema, L100 § Deployment Architecture

---


> See [docs/diagrams/mermaid/10_lakebase_er_diagram.md] for the Lakebase ER diagram.
### Step 1: Create the Lakebase project

**Type:** Manual (Databricks CLI)

```bash
# Create the Lakebase project
databricks postgres create-project ground-truth \
  --catalog ${CATALOG} \
  --schema ${SCHEMA}

# Note the project ID — needed for Bundle 1 variables
# Output: project_id = "prj-xxxxxxxxxxxx"
```

### Step 2: Create environment branches

**Type:** Manual (Databricks CLI)

```bash
# Production branch is created automatically with the project
# Create dev branch (copy-on-write from production)
databricks postgres create-branch ground-truth dev \
  --parent production

# Create test branch (copy-on-write from production)
databricks postgres create-branch ground-truth test \
  --parent production
```

### Step 3: Create migration scripts

**Type:** Genie Code session

Prompt:
```
Create numbered Flyway-style SQL migration scripts in bundle-infra/src/migrations/.
Each script should be idempotent (use IF NOT EXISTS where possible).

V001__create_assets_table.sql:
- Create the `assets` table with all columns from L200-C1 schema
- Include indexes: asset_type, environment, confidence_score, last_reviewed_at
- Include unique constraint on (repo_url, fixture_path, environment)

V002__create_asset_versions_table.sql:
- Create `asset_versions` with FK to assets
- Unique constraint on (asset_id, version)

V003__create_synonyms_and_votes.sql:
- Create `asset_synonyms` with FK to assets, unique on (asset_id, synonym)
- Create `votes` with FK to assets, unique on (asset_id, asset_version, user_id)
- Create index on votes(processed) WHERE processed = FALSE
- Create `synonym_votes` with FK to asset_synonyms

V004__create_example_questions.sql:
- Create `example_questions` with FK to assets
- Index on asset_id

V005__create_campaigns_and_assignments.sql:
- Create `campaigns` table
- Create `campaign_assignments` with FK to campaigns

V006__create_confidence_scores.sql:
- Create `confidence_scores` with FK to assets (1:1)

V007__create_feedback_batches.sql:
- Create `feedback_batches` table

V008__create_notifications.sql:
- Create `notifications` table

V009__create_user_activity.sql:
- Create `user_activity` table for gamification state

V010__enable_cdf.sql:
- ALTER TABLE ... REPLICA IDENTITY FULL for all tables that need CDF
- Tables: assets, votes, user_activity, confidence_scores, campaigns, feedback_batches
```

### Step 4: Create the migration runner notebook

**Type:** Genie Code session

Prompt:
```
Create bundle-infra/src/notebooks/run_migrations.py:
- Connects to the Lakebase project using the app's service principal credentials
- Reads all V*.sql files from src/migrations/ in order
- Tracks applied migrations in a `schema_migrations` table
- Skips already-applied migrations
- Applies new migrations in order
- Logs each migration applied
- Rolls back on failure (within a transaction)
```

### Step 5: Run initial migrations

**Type:** Manual (run notebook or CLI)

```bash
# Deploy Bundle 1 first to get notebooks into workspace
databricks bundle deploy -t dev

# Run the migration job
databricks bundle run -t dev post_deploy_validation
```

Or run the migration notebook directly:
```bash
databricks jobs run-now --notebook-path /Workspace/Shared/.bundles/ground-truth-infra/dev/src/notebooks/run_migrations.py
```

---

### Open Questions

1. **Lakebase migration tooling:** Is there a recommended migration framework for Lakebase (like Flyway or Alembic), or is a custom migration runner the standard pattern?
2. **CDF table naming:** When CDF is enabled, are the Delta table names configurable, or always `lb_<table_name>_history`?
