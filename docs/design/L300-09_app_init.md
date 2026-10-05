# L300-09 — App Initialization via `databricks apps init`

## Implementation Spec

**Phase:** 2 (Bundle 2 — App)
**Type:** Manual CLI (serverless notebook terminal)
**Prerequisites:** L300-08 complete (Bundle 1 deployed)
**References:** L100 § Deployment Architecture (Bundle 2), preferences/two-bundle-dab-pattern

---


> See [docs/diagrams/mermaid/03_deployment_architecture.md] for Bundle 2 in the deployment architecture.
### Step 1: Open a serverless compute notebook terminal

**Type:** Manual (workspace UI)

1. Create or open a notebook with serverless compute
2. Open the terminal (bottom panel)
3. Verify Databricks CLI is available: `databricks --version`

### Step 2: Initialize the app with `databricks apps init`

**Type:** Manual (terminal)

```bash
cd /Workspace/Users/<your-email>/ground-truth-app/bundle-app

databricks apps init
```

When prompted:
- **App name:** `ground-truth`
- **Framework:** Node.js (AppKit)
- **Plugins:**
  - ✅ Lakebase (required — Postgres backend)
  - ✅ OpenTelemetry (required — logs, metrics, traces)
  - ✅ Data API (required — read/write UC tables)

### Step 3: Verify generated scaffold

**Type:** Manual (terminal)

```bash
ls -la bundle-app/
# Expected:
# app.yml          — App configuration
# databricks.yml   — Bundle 2 configuration
# package.json     — Node.js dependencies
# server.js        — AppKit entry point
# frontend/        — React frontend scaffold
# node_modules/    — Dependencies (after npm install)
```

### Step 4: Configure app.yml for Ground Truth

**Type:** Manual (editor)

Update `bundle-app/app.yml`:

```yaml
command: ["node", "server.js"]

env:
  - name: LAKEBASE_PROJECT_ID
    value: "${var.lakebase_project_id}"
  - name: TARGET_CATALOG
    value: "${var.catalog}"
  - name: TARGET_SCHEMA
    value: "${var.schema}"
  - name: SQL_WAREHOUSE_ID
    value: "${var.warehouse_id}"

resources:
  - name: lakebase
    type: lakebase
    project: "${var.lakebase_project_id}"
  - name: sql-warehouse
    type: sql-warehouse
    id: "${var.warehouse_id}"

user_api_scopes:
  - sql
  - unity-catalog
  - ai-gateway
```

### Step 5: Configure Bundle 2 `databricks.yml`

**Type:** Manual (editor)

Update `bundle-app/databricks.yml`:

```yaml
bundle:
  name: ground-truth-app

variables:
  catalog:
    description: "Target UC catalog (must match Bundle 1)"
  schema:
    description: "Target UC schema (must match Bundle 1)"
  warehouse_id:
    description: "SQL Warehouse ID (from Bundle 1)"
  lakebase_project_id:
    description: "Lakebase project ID (from Bundle 1)"

workspace:
  root_path: /Workspace/Shared/.bundles/${bundle.name}/${bundle.target}

targets:
  dev:
    default: true
    variables:
      catalog: "dev_ground_truth"
      schema: "app"
      warehouse_id: "abc123def456"
      lakebase_project_id: "prj-xxxxxxxxxxxx"
```

### Step 6: Install dependencies and verify

**Type:** Manual (terminal)

```bash
cd bundle-app
npm install

# Add Ground Truth specific dependencies
npm install @modelcontextprotocol/server @modelcontextprotocol/node zod
npm install framer-motion
npm install pg  # Postgres client for Lakebase
```

### Step 7: Commit

**Type:** Manual (terminal)

```bash
git add bundle-app/
git commit -m "Bundle 2 (App) initialized via databricks apps init with Lakebase, OTel, Data API plugins"
```

---

### Open Questions

1. **User API scopes:** Is `ai-gateway` a valid user API scope for OBO? Need to verify the exact scope name for Unity Gateway MCP Service access.
