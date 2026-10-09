# Unity Gateway Connection Setup

**Design source:** L300-07  
**Bundle:** Bundle 1 (ground-truth-infra)  
**Status:** Partially automated. Step 1 (HTTP connection) is created by `setup_gateway_connection.py` notebook, auto-triggered on deploy via `job_run` resource. Step 2 (MCP Service registration) is now a declarative DAB resource (`mcp_service`). Manual steps eliminated.

> **Updated 2026-10-09:** MCP Services are now DAB-declarable (`mcp_service` resource, CLI 1.17.0+, requires `engine: direct`). See `docs/research/04_dab_secrets_jobruns_mcp.md` §4. Unity Gateway **connections** are still NOT a DAB resource type — created via SDK in `setup_gateway_connection.py`.

---

## Overview

The `ground-truth-mcp` connection exposes the Ground Truth App MCP server as a Unity Gateway
connection, enabling the Bundle 3 Agent/Genie Space to call the app as a tool.

Connection flow:
```
Bundle 3 Agent
  └── MCP Service (ground-truth-mcp)              ← DAB resource: mcp_service
        └── Unity Gateway HTTP connection           ← SDK: setup_gateway_connection.py
              └── Bundle 2 App MCP endpoint          ← https://<app-url>/mcp
```

---

## Step 1: Create the HTTP Connection (automated)

**Method:** `src/notebooks/setup_gateway_connection.py` (Group B task in `post_deploy_setup` job)
**Trigger:** Auto-triggered by `job_run` resource when `app_url` parameter is set

The notebook creates or updates the connection via the Python SDK:

```python
# Simplified logic from setup_gateway_connection.py
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

try:
    w.connections.get("ground-truth-mcp")
    # Exists — update with real app URL
    w.connections.update("ground-truth-mcp", options={"host": app_url, "port": "443", "base_path": "/mcp"})
except Exception:
    # Create new
    w.connections.create(
        name="ground-truth-mcp",
        connection_type="HTTP",
        comment="MCP server for Semantic Ground Truth app.",
        options={"host": app_url, "port": "443", "base_path": "/mcp"}
    )

# Grant USE CONNECTION
w.grants.update("connection", "ground-truth-mcp",
    changes=[PermissionsChange(add=[Privilege.USE_CONNECTION], principal="users")])
```

**Manual fallback (curl):**

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

## Step 2: MCP Service Registration (declarative)

**Method:** DAB `mcp_service` resource — deployed automatically by `bundle deploy`
**File:** `resources/mcp/ground_truth_mcp.mcp_service.yml`
**Requires:** `engine: direct` in `databricks.yml`, CLI ≥ 1.17.0

```yaml
resources:
  mcp_services:
    ground_truth_mcp:
      parent: schemas/${var.catalog}.${resources.schemas.ground_truth_schema.name}
      mcp_service_id: ground-truth-mcp
      comment: "Semantic Ground Truth app MCP service for Unity Gateway"
      config:
        source_connection:
          name: connections/${var.catalog}.${resources.schemas.ground_truth_schema.name}.ground-truth-mcp
        include_tool_selectors:
          - "review_*"
          - "campaign_*"
          - "metric_view_*"
      grants:
        - principal: data-engineers
          privileges:
            - EXECUTE
```

**Dependency:** The `source_connection` references the HTTP connection from Step 1. The connection must exist before the MCP service can be deployed. On first deploy (pre-Bundle 2), the MCP service may fail if the connection hasn't been created yet — this is expected and resolves after the Group B post-deploy tasks run.

> ~~Manual UI steps (Navigate to Unity Gateway → MCPs → Register MCP Service) are no longer needed.~~ The `mcp_service` resource handles registration, tool selection, and grants declaratively.

---

## Step 3: Access Control (automated)

Connection grants are handled by `setup_gateway_connection.py` (see Step 1 — `w.grants.update()` call).
MCP service grants are handled by the `mcp_service` resource's `grants` block (see Step 2).

No manual grant configuration needed.

---

## Step 4: Update URL After Bundle 2 Deploys (automated)

The `setup_gateway_connection.py` notebook receives the `app_url` as a widget parameter (passed from the `post_deploy_setup` job's `app_url` job parameter). It creates or updates the connection with the real URL in a single idempotent call.

**When to run:** After Bundle 2 deploys, re-run the post-deploy setup with the app URL:

```bash
# Option A: Manual run with params
databricks bundle run post_deploy_setup --target dev \
  --params app_url=https://<app>.databricksapps.com

# Option B: Redeploy (if job_run resource is configured with app_url)
databricks bundle deploy --target dev
```

The `deploy.sh` script can also call `update_gateway_connection()` as before.

---

## Validation

```bash
# Verify connection exists
curl -X GET "${DATABRICKS_HOST}/api/2.1/unity-catalog/connections/ground-truth-mcp" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}"

# Verify MCP service exists (after bundle deploy)
databricks unity-catalog mcp-services get \
  --full-name "${CATALOG}.${SCHEMA}.ground-truth-mcp"
```

The resources also appear in:
- `post_deploy_validation.py` check 8 (Unity Gateway connection registered)
- Unity Gateway UI → MCPs → Semantic Ground Truth
- `databricks bundle summary --target dev` (mcp_service resource listed)

---

## References
- L300-07 Unity Gateway Connection design spec
- `docs/research/04_dab_secrets_jobruns_mcp.md` §4 — MCP Service DAB resource research
- `docs/plans/post_deploy_automation_plan.md` — Phase 0 (MCP Service) + Task 4 (Gateway connection)
- [Databricks Connections API](https://docs.databricks.com/api/unity-catalog/connections)
- [Register an external MCP server (DABs)](https://docs.databricks.com/aws/en/ai-gateway/register-mcp-service/)
- [Unity Gateway MCP setup](https://docs.databricks.com/en/generative-ai/agent-framework/tools/mcp.html)
- [DAB resources reference — mcp_service](https://docs.databricks.com/aws/en/dev-tools/bundles/resources/)
