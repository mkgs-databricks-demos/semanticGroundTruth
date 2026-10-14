# Unity Gateway Connection Setup

**Design source:** L300-07  
**Bundle:** Bundle 1 (ground-truth-infra)  
**Status:** Partially automated. Step 1 (HTTP connection) is created by `setup_gateway_connection.py` notebook via SQL DDL, auto-triggered on deploy via `job_run` resource. Step 2 (MCP Service registration) is a declarative DAB resource (`mcp_service`).

> **Updated 2026-10-11:** HTTP connections with `is_mcp_connection=true` require valid credentials at creation time. Every creation path validates credentials: REST API uses DCR (workspace may not support it), SQL DDL without creds falls back to DCR, SQL DDL with creds validates the token exchange immediately. Therefore the connection can only be created AFTER Bundle 2 deploys the app (which provisions the SPN with valid credentials). Pattern from hi-genie-orchestrator: SQL DDL with `secret()` refs + explicit `token_endpoint`. See `create_app_connection.sql` in the hi-genie project for reference.
>
> MCP Services are DAB-declarable (`mcp_service` resource, CLI 1.17.0+, `engine: direct`). Unity Gateway **connections** are NOT a DAB resource type — created via SQL DDL in `setup_gateway_connection.py`.

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
**Prerequisite:** Bundle 2 must be deployed first (provides the app SPN credentials)

### Why SQL DDL (not REST API / SDK)

HTTP connections with MCP support require credential validation at creation time:

| Method | Result on this workspace |
| --- | --- |
| REST API (`connections.create`) | Fails — requires DCR; workspace OIDC lacks `registration_endpoint` |
| Python SDK (`w.connections.create`) | Fails — same DCR requirement |
| SQL DDL without credentials | Fails — falls back to DCR |
| **SQL DDL with `secret()` refs** | **Works** — creates OAUTH_M2M connection, validates token immediately |

The hi-genie-orchestrator pattern uses SQL DDL with explicit credentials from a secret scope:

```sql
-- Pattern from hi-genie create_app_connection.sql
CREATE CONNECTION IF NOT EXISTS `semantic-ground-truth-mcp`
TYPE HTTP
OPTIONS (
  host 'https://<app-url>.databricksapps.com',
  base_path '/mcp',
  client_id secret('<scope>', '<client_id_key>'),
  client_secret secret('<scope>', '<client_secret_key>'),
  oauth_scope 'all-apis',
  token_endpoint 'https://fevm-hls-fde.cloud.databricks.com/oidc/v1/token'
)
```

### Connection naming

UC connections are **metastore-level** (flat names, no dots). The connection name is `semantic-ground-truth-mcp`, NOT `catalog.schema.semantic-ground-truth-mcp`.

### Manual fallback

Create via SQL editor on the infra SQL warehouse, substituting real values for the secret scope keys after Bundle 2 has deployed and SPN credentials are provisioned.

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
      mcp_service_id: semantic-ground-truth-mcp
      comment: "Semantic Ground Truth app MCP service ..."
      config:
        source_connection:
          # UC connections are metastore-level (flat names, no catalog.schema prefix)
          name: connections/semantic-ground-truth-mcp
        include_tool_selectors:
          - "review_*"
          - "campaign_*"
          - "metric_view_*"
      grants:
        - principal: data-engineers
          privileges:
            - EXECUTE
```

**Dependency:** The `source_connection` references the HTTP connection from Step 1. The connection must exist before the MCP service can be deployed. Pre-Bundle 2: the MCP service will fail (connection doesn't exist yet) — this is expected. Post-Bundle 2: re-deploy infra to register the MCP service.

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

The `deploy.sh` script checks connection existence but does NOT create it (DCR limitation).

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
