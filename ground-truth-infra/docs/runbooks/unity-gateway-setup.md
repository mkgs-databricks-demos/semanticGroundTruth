# Unity Gateway Connection Setup

**Design source:** L300-07  
**Bundle:** Bundle 1 (ground-truth-infra)  
**Status:** Manual post-deploy step — run after bundle deploy succeeds AND after Bundle 2 provides the app URL.

> Unity Gateway connections are NOT a DAB resource type as of Oct 2026. Manual CLI + UI.

---

## Overview

The `ground-truth-mcp` connection exposes the Ground Truth App MCP server as a Unity Gateway
connection, enabling the Bundle 3 Agent/Genie Space to call the app as a tool.

Connection flow:
```
Bundle 3 Agent
  └── Unity Gateway connection (ground-truth-mcp)
        └── Bundle 2 App MCP endpoint (https://<app-url>/mcp)
```

---

## Step 1: Create the HTTP Connection

Create a placeholder connection (URL updated after Bundle 2 deploys):

```bash
export DATABRICKS_HOST="https://fevm-hls-fde.cloud.databricks.com"
export DATABRICKS_TOKEN="<token>"

curl -X POST "${DATABRICKS_HOST}/api/2.1/unity-catalog/connections" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ground-truth-mcp",
    "connection_type": "HTTP",
    "comment": "MCP server for Semantic Ground Truth app (URL updated by Bundle 2 post-deploy).",
    "options": {
      "host": "https://placeholder.databricksapps.com",
      "port": "443",
      "base_path": "/mcp"
    }
  }'
```

---

## Step 2: Configure as MCP Service in Unity Gateway UI

1. Navigate to Unity Gateway in the Databricks UI
2. Click MCPs (left navigation)
3. Click Register MCP Service
4. Select connection: `ground-truth-mcp`
5. Set MCP endpoint path: `/mcp`
6. Set display name: `Semantic Ground Truth`
7. Save

---

## Step 3: Access Control

Add USE CONNECTION grant for workspace users via the Unity Catalog Permissions UI,
or via the REST API with the appropriate principal and privilege.

---

## Step 4: Update URL After Bundle 2 Deploys

Get the app URL from `databricks apps get ground-truth-app --output json`,
then PATCH the connection options to replace the placeholder host with the real app URL.

This is scripted in the solution-root `deploy.sh` under `update_gateway_connection()`.

---

## Validation

```bash
# Verify connection exists
curl -X GET "${DATABRICKS_HOST}/api/2.1/unity-catalog/connections/ground-truth-mcp" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}"
```

The connection also appears in:
- `post_deploy_validation.py` check 8 (Unity Gateway connection registered)
- Unity Gateway UI → MCPs → Semantic Ground Truth

---

## References
- L300-07 Unity Gateway Connection design spec
- [Databricks Connections API](https://docs.databricks.com/api/unity-catalog/connections)
- [Unity Gateway MCP setup](https://docs.databricks.com/en/generative-ai/agent-framework/tools/mcp.html)
