# L300-03 — UC Secrets, SQL Warehouse, Notification Destinations

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual CLI + DAB resources
**Prerequisites:** L300-02 complete (Lakebase project exists)
**References:** L100 § Technology Decisions (Secrets, SQL Warehouse, Notifications)

---

### Step 1: Create UC Secrets

**Type:** Manual (SQL or CLI)

```sql
-- Create secrets for sensitive configuration
CREATE SECRET IF NOT EXISTS ${catalog}.${schema}.slack_webhook_url
  WITH VALUE = '<slack-webhook-url>';

CREATE SECRET IF NOT EXISTS ${catalog}.${schema}.teams_webhook_url
  WITH VALUE = '<teams-webhook-url>';

CREATE SECRET IF NOT EXISTS ${catalog}.${schema}.git_token
  WITH VALUE = '<git-personal-access-token-for-branch-creation>';
```

### Step 2: Configure SQL Warehouse

**Type:** Manual (workspace UI or CLI)

```bash
# Create a serverless SQL warehouse for the app
# Or reference an existing one
# Note the warehouse_id for Bundle 1 variables

databricks warehouses create \
  --name "ground-truth-warehouse" \
  --cluster-size "2X-Small" \
  --warehouse-type "PRO" \
  --enable-serverless-compute true \
  --auto-stop-mins 10
```

### Step 3: Configure notification destinations

**Type:** Manual (workspace settings UI)

1. Navigate to workspace Settings → Notifications → Notification destinations
2. Click "Add destination"
3. For Slack: Select "Slack", enter webhook URL or use Genie App (Beta)
4. For Teams: Select "Microsoft Teams", enter webhook URL or use Genie App (Beta)
5. Note the destination IDs for the app configuration

### Step 4: Add secrets and warehouse to Bundle 1 variables

**Type:** Manual (editor)

Update `bundle-infra/databricks.yml` targets with actual values:

```yaml
targets:
  dev:
    variables:
      catalog: "dev_ground_truth"
      schema: "app"
      warehouse_id: "abc123def456"
      lakebase_project_id: "prj-xxxxxxxxxxxx"
  # ... staging and prod similarly
```

---

### Open Questions

1. **UC Secrets access from Node.js:** Can the Databricks JS SDK read UC Secrets directly, or does the app need to read them via SQL (`SELECT secret(...)`) through the Statement Execution API?
