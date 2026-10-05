# L300-07 — Unity Gateway Connection Registration

## Implementation Spec

**Phase:** 1 (Bundle 1 — Infra)
**Type:** Manual CLI
**Prerequisites:** L300-01 complete
**References:** L100 § MCP registration, reference/mcp-server-registration

---

### Step 1: Register the Unity Gateway connection

**Type:** Manual (CLI or API)

The MCP Server will be registered as a Unity Gateway connection in the target catalog.schema. This is done in Bundle 1 so the connection exists before the app (Bundle 2) is deployed.

```bash
# Register the connection — the app URL will be updated in Bundle 2 post-deploy
# For now, create the connection with a placeholder URL
databricks connections create \
  --name "ground-truth-mcp" \
  --connection-type "HTTP" \
  --host "https://placeholder.databricksapps.com" \
  --catalog ${CATALOG} \
  --schema ${SCHEMA}
```

### Step 2: Configure as MCP Service in Unity Gateway

**Type:** Manual (workspace UI — Unity Gateway > MCPs)

1. Navigate to Unity Gateway > MCPs
2. Find the `ground-truth-mcp` connection
3. Configure as MCP Service
4. Set access control (UC grants) — default: all workspace users can invoke

### Step 3: Update connection URL after app deploy

**Type:** Bundle 2 post-deploy job (L300-13)

After the app is deployed in Bundle 2, the post-deploy job updates the connection URL to point to the actual app endpoint:

```bash
databricks connections update ground-truth-mcp \
  --host "https://<actual-app-url>/mcp"
```

---

### Open Questions

1. **Connection creation in DAB:** Can Unity Gateway connections be declared as DAB resources, or must they be created via CLI/API? If DAB-declarable, this should be in `resources/connections.yml`.
