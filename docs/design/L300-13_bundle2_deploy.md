# L300-13 — Bundle 2 Deploy + Post-Deploy Validation

## Implementation Spec

**Phase:** 2 (Bundle 2 — App)
**Type:** Manual CLI
**Prerequisites:** L300-09 through L300-12 complete
**References:** L100 § Deployment Architecture (Bundle 2)

---


> See [docs/diagrams/mermaid/03_deployment_architecture.md] for the CI/CD orchestration flow.
### Step 1: Validate Bundle 2

**Type:** Manual (CLI)

```bash
cd bundle-app
databricks bundle validate -t dev
```

### Step 2: Deploy Bundle 2

**Type:** Manual (CLI)

```bash
databricks bundle deploy -t dev --auto-approve
```

### Step 3: Start the app

**Type:** Manual (CLI)

```bash
databricks apps start ground-truth
```

Note the app URL from the output.

### Step 4: Run post-deploy validation

**Type:** Manual (CLI or script)

```bash
# Update the Unity Gateway connection with the actual app URL
databricks connections update ground-truth-mcp \
  --host "https://<app-url>/mcp"

# Grant the app's service principal necessary permissions
python scripts/post_deploy.py
```

The post-deploy script:
1. Grants the app SP `CONNECT` on the Lakebase project
2. Grants the app SP `SELECT` on the UC schema
3. Verifies the MCP endpoint is accessible
4. Seeds initial test data (if dev environment)
5. Runs a health check: `GET /health`

### Step 5: Verify the app

**Type:** Manual (browser)

1. Open the app URL in a browser
2. Verify OBO login works
3. Verify a review card loads (if test data seeded)
4. Verify the MCP endpoint: `GET <app-url>/mcp` returns tool list

### Step 6: Verify MCP in Genie One

**Type:** Manual (Genie One)

1. Open Genie One
2. Say: "I want to review some UC semantics"
3. Verify the Ground Truth MCP tools are discoverable
4. Verify the MCP Apps View renders (if pre-private preview is enabled)

---

### Open Questions

None — this is a procedural step.
