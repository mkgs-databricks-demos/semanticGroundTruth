# Research: New DAB Resource Types — UC Secrets, Job Runs, and MCP Services

## Date: 2026-10-09

## Summary

Three recently-added DAB resource types directly impact the Semantic Ground Truth infra bundle:

| Resource Type | CLI Version | Impact |
|---------------|-------------|--------|
| **`secret` (Unity Catalog)** | 1.12.0+ | Secrets can be declared in YAML. Replaces `setup_secrets.py` notebook entirely. |
| **`secret_scope`** | 0.252.0+ | Workspace-level scopes can be declared in YAML. But UC secrets are preferred — they may make scopes unnecessary. |
| **`job_run`** | 1.7.0+ | Triggers a run of an existing job on `bundle deploy`. Replaces manual `bundle run post_deploy_setup`. |
| **`mcp_service`** | 1.17.0+ | MCP Services can be declared in YAML. Replaces manual Unity Gateway MCP registration. |

All four require the **direct deployment engine** (`engine: direct` in `databricks.yml` or `DATABRICKS_BUNDLE_ENGINE=direct`).

**Key finding:** These four resource types, combined with the existing `genie_task` finding (doc 03), eliminate nearly ALL manual post-deploy steps. The `post_deploy_setup` job can be dramatically simplified or replaced entirely by declarative resources + a single `job_run`.

---

## 1. UC Secrets (`secret`)

### What It Is

A Unity Catalog secret is a three-level namespace object (`catalog.schema.secret`) that stores sensitive values (passwords, tokens, API keys). Unlike workspace-level secrets (organized into scopes), UC secrets are governed by Unity Catalog privileges and are accessible across all workspaces attached to a metastore.

### DAB YAML

```yaml
resources:
  secrets:
    slack_webhook:
      catalog_name: ${var.catalog}
      schema_name: ${resources.schemas.ground_truth_schema.name}
      name: slack_webhook_url
      value: ${var.slack_webhook_url}
      comment: "Slack webhook for pipeline failure notifications"
      lifecycle:
        prevent_destroy: true

    teams_webhook:
      catalog_name: ${var.catalog}
      schema_name: ${resources.schemas.ground_truth_schema.name}
      name: teams_webhook_url
      value: ${var.teams_webhook_url}
      comment: "Teams webhook for pipeline failure notifications"
      lifecycle:
        prevent_destroy: true

    git_token:
      catalog_name: ${var.catalog}
      schema_name: ${resources.schemas.ground_truth_schema.name}
      name: git_token
      value: ${var.git_token}
      comment: "GitHub PAT for feedback pipeline branch creation"
      lifecycle:
        prevent_destroy: true
```

### Schema

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `catalog_name` | String | Yes | UC catalog where the secret resides |
| `schema_name` | String | Yes | UC schema where the secret resides |
| `name` | String | Yes | Secret name (unique within schema) |
| `value` | String | Yes | The secret value (input-only, never returned in responses). Max 60 KiB. |
| `comment` | String | No | Description (1–65536 chars) |
| `expire_time` | String | No | Informational expiration timestamp (no automatic action) |
| `grants` | Sequence | No | UC grants on this secret |
| `owner` | String | No | Owner principal (defaults to deployer) |
| `lifecycle` | Map | No | `prevent_destroy: true` to protect from accidental deletion |

### Key Details

- **Three-level namespace:** `catalog.schema.secret` — same governance as tables/volumes
- **Cross-workspace:** Available on all workspaces attached to the metastore
- **Retrieval:** `dbutils.secrets.get(scope=None, key='catalog.schema.secret_name')` on DBR 17.3+ or serverless env v4+
- **Alternative retrieval:** `SELECT secret('catalog.schema.secret_name')` in SQL
- **Deploy-time values:** Use `${var.secret_name}` variables — values passed via `--var` flags, env vars (`BUNDLE_VAR_secret_name`), or `.databricks/.bundle/<target>/variable-overrides.json`
- **Security:** Values are never returned in API responses. The `value` field is write-only.
- **Direct engine required:** `engine: direct` must be set

### Impact on Infra Bundle

**Before:** `setup_secrets.py` notebook creates workspace-level scope + puts 3 secrets via `w.secrets.create_scope()` / `w.secrets.put_secret()`

**After:** Three `secret` resources in YAML. No notebook needed. Values injected at deploy time.

**Migration path:**
1. Add `secret` resources to `resources/secrets.yml` (or `resources/secrets/` directory)
2. Add bundle variables for the secret values
3. Update consuming notebooks to use UC secret path instead of scope-based path:
   - Before: `dbutils.secrets.get(scope="ground-truth-infra", key="slack_webhook_url")`
   - After: `dbutils.secrets.get(scope=None, key="hls_fde_dev.dev_matthew_giglia_ground_truth.slack_webhook_url")`
4. Remove `setup_secrets.py` from `post_deploy_setup` job
5. Remove workspace-level scope entirely (or keep as fallback)

**Trade-off — UC Secrets vs Workspace Secrets:**

| Aspect | UC Secrets | Workspace Secrets |
|--------|------------|-------------------|
| Governance | UC privileges (GRANT/REVOKE) | Scope ACLs (READ/WRITE/MANAGE) |
| Namespace | `catalog.schema.secret` | `scope.key` |
| Cross-workspace | Yes (metastore-wide) | No (workspace-scoped) |
| DAB-declarable | Yes (`secret` resource) | Scope yes (`secret_scope`), keys require SDK |
| Compute requirement | DBR 17.3+ / serverless env v4+ | Any compute |
| Audit | UC audit logs | Workspace audit logs |

**Recommendation:** Use UC secrets for this project. The HIPAA requirement benefits from UC-governed audit trails, and all our compute is serverless (env v4+).

---

## 2. Secret Scopes (`secret_scope`)

### What It Is

The traditional workspace-level secret scope. Now DAB-declarable — the scope itself can be created in YAML, but individual secrets within the scope still need SDK calls or CLI commands.

### DAB YAML

```yaml
resources:
  secret_scopes:
    ground_truth_scope:
      name: ground-truth-infra
      backend_type: DATABRICKS
      permissions:
        - user_name: matthew.giglia@databricks.com
          level: MANAGE
        - group_name: data-engineers
          level: READ
      lifecycle:
        prevent_destroy: true
```

### Schema

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | String | No | Scope name (unique within workspace) |
| `backend_type` | String | No | `DATABRICKS` (default) or `AZURE_KEYVAULT` |
| `keyvault_metadata` | Map | No | Azure Key Vault config (Azure only) |
| `permissions` | Sequence | No | ACLs — `group_name`/`user_name`/`service_principal_name` + `level` (READ/WRITE/MANAGE) |
| `lifecycle` | Map | No | `prevent_destroy: true` |

### Key Details

- **Scope only:** Declares the scope container and its ACLs. Does NOT declare individual secret key-value pairs.
- **Secret values still need:** `databricks secrets put-secret <scope> <key> --string-value "..."` or SDK `w.secrets.put_secret()`
- **Partially declarative:** The scope creation and permission setup are declarative, but the actual secret storage is not.
- **Added in CLI 0.252.0** — much older than UC secrets (1.12.0)

### Impact on Infra Bundle

**Verdict:** Less useful than UC secrets for our project. The scope can be declared, but the 3 secret values still need a notebook or CLI call. UC secrets (`secret` resource) declare both the container and the value in one resource.

**However:** If consuming code is locked to older runtimes that don't support UC secret retrieval, `secret_scope` + a setup notebook for values is the fallback path.

---

## 3. Job Runs (`job_run`)

### What It Is

A `job_run` resource triggers a run of an **existing job** as part of `bundle deploy`. Unlike a `job` resource (which defines a job), a `job_run` references an existing job by ID and triggers it during deployment.

This is the DAB-native equivalent of `databricks bundle run <job_name>` — but declarative, automatic, and with lifecycle controls.

### DAB YAML

```yaml
resources:
  job_runs:
    run_post_deploy:
      job_id: ${resources.jobs.post_deploy_setup.id}
      job_parameters:
        app_url: ""
        app_sp_client_id: ""
      only:
        - setup_secrets
        - setup_genie_automation
        - +setup_job_params  # + prefix = also run upstream tasks
      lifecycle:
        triggers:
          - always  # re-fire on every deploy, not just config changes
```

### Schema

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `job_id` | Integer | Yes | ID of the job to run. Can use DAB substitution. |
| `job_parameters` | Map | No | Job-level parameter overrides (e.g. `param: overriding_val`) |
| `only` | Sequence | No | Task keys to run. Prefix with `+` for upstream deps, suffix with `+` for downstream. Empty = all tasks. |
| `performance_target` | String | No | `STANDARD` or `PERFORMANCE_OPTIMIZED` (serverless) |
| `pipeline_params` | Map | No | Pipeline refresh settings (for pipeline tasks) |
| `queue` | Map | No | `enabled: true` to queue the run |
| `lifecycle` | Map | No | `prevent_destroy`, plus `triggers` (see below) |

### Lifecycle Triggers

The `lifecycle.triggers` field controls **when** the `job_run` fires:

| Trigger | Behavior |
|---------|----------|
| (default — no triggers) | Fires only when the `job_run` resource's own configuration changes |
| `always` | Fires on **every** `bundle deploy`, regardless of whether config changed |

This is powerful: a `job_run` with `triggers: [always]` is a **deploy hook** — it runs the referenced job every time the bundle deploys.

### Key Details

- **Deploy-time execution:** The run triggers during `bundle deploy`, not as a separate step
- **References existing jobs:** The `job_id` must point to a job that already exists (either declared in the same bundle or externally). DAB substitution `${resources.jobs.<name>.id}` works for same-bundle jobs.
- **Task selection:** The `only` field lets you cherry-pick which tasks to run — critical for our two-group pattern (Group A unblocked, Group B post-Bundle 2)
- **Ordering:** If the same bundle declares both the `job` and the `job_run`, the job is created/updated first, then the run triggers
- **Direct engine required:** `engine: direct` must be set
- **Added in CLI 1.7.0**, triggers added in 1.13.0

### Impact on Infra Bundle

**Before:** After `bundle deploy`, manually run `databricks bundle run post_deploy_setup --target dev`

**After:** Declare a `job_run` resource that auto-triggers the post-deploy setup job on every deploy:

```yaml
resources:
  job_runs:
    run_post_deploy_group_a:
      job_id: ${resources.jobs.post_deploy_setup.id}
      job_parameters:
        app_url: ""  # empty = skip Group B
      only:
        - setup_genie_automation
        - +setup_job_params
      lifecycle:
        triggers:
          - always
```

This eliminates the need for a separate `bundle run` step in the deploy workflow. The post-deploy setup runs automatically as part of `bundle deploy`.

**Note:** Secrets tasks don't need to be in the `job_run.only` list if we switch to UC `secret` resources — they'd be deployed declaratively, not via a notebook.

---

## 4. MCP Services (`mcp_service`)

### What It Is

An MCP (Model Context Protocol) Service registers an external MCP server through a Unity Catalog connection and exposes its tools through Unity Gateway. This is the DAB-declarable version of the manual Unity Gateway MCP registration step.

### DAB YAML

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
        rate_limits: []
      grants:
        - principal: data-engineers
          privileges:
            - EXECUTE
```

### Schema

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `parent` | String | Yes | UC schema in format `schemas/{catalog}.{schema}` |
| `mcp_service_id` | String | Yes | Service ID (becomes final component of resource name) |
| `comment` | String | No | Description |
| `config` | Map | No | Operational configuration |
| `config.source_connection` | Map | Yes (in config) | UC connection referencing the MCP server |
| `config.source_connection.name` | String | Yes | Connection in format `connections/{catalog}.{schema}.{name}` |
| `config.include_tool_selectors` | Sequence | No | Tool name patterns to expose (empty = all). Max 1024 selectors, 256 chars each. |
| `config.rate_limits` | Sequence | No | Rate limits by scope (user, group, SP, service-wide) |
| `grants` | Sequence | No | UC grants on the MCP service |
| `lifecycle` | Map | No | `prevent_destroy: true` |

### Key Details

- **Depends on a UC connection:** The `source_connection.name` references a Unity Catalog HTTP connection that must exist first. Connections are NOT currently DAB-declarable — they still need API/CLI creation.
- **Tool filtering:** `include_tool_selectors` uses exact names or prefix patterns (`read_*`). Empty list exposes all tools.
- **Rate limits:** Can limit by user, group, service principal, or service-wide. Supports request and token limits.
- **Direct engine required:** `engine: direct` must be set
- **Added in CLI 1.17.0**

### Impact on Infra Bundle

**Before:** Manual Unity Gateway UI step to register MCP Service after creating the HTTP connection

**After:** The MCP service registration is declarative. But the underlying HTTP connection still needs API creation (no `connection` DAB resource type exists yet).

**Revised manual steps after this finding:**
1. Create UC HTTP connection (`setup_gateway_connection.py` notebook or CLI) — still manual/API
2. MCP Service registration — **now declarative** via `mcp_service` resource
3. MCP Service tool configuration in Unity Gateway UI — **now declarative** via `include_tool_selectors`

This reduces the Unity Gateway setup from 3 manual steps to 1 (the connection itself).

---

## 5. Revised Post-Deploy Architecture

With these four resource types, the infra bundle's post-deploy story changes dramatically:

### Before (6 manual steps)

| Step | Method | Automation |
|------|--------|-----------|
| 1. UC Secrets | `setup_secrets.py` notebook | SDK |
| 2. Genie Code automation | `setup_genie_automation.py` notebook | API |
| 3. Job params (wire `configuration_id`) | `setup_job_params.py` notebook | API |
| 4. Unity Gateway connection | `setup_gateway_connection.py` notebook | SDK |
| 5. MCP Service registration | Unity Gateway UI | Manual |
| 6. Lakebase CDF config | `setup_cdf_config.py` notebook | SDK |
| 7. app_role SP update | `setup_app_role_sp.py` notebook | SDK |

### After (declarative + 1 job with 3 tasks + 1 auto-triggered run)

| Step | Method | DAB Resource |
|------|--------|-----------|
| 1. UC Secrets | **Declarative YAML** | `secret` (3 resources) |
| 2. Genie Code automation | Notebook task | Still API (`setup_genie_automation.py`) |
| 3. Job params (wire `configuration_id`) | Notebook task | Still API (`setup_job_params.py`) |
| 4. Unity Gateway connection | Notebook task | Still API (`setup_gateway_connection.py`) |
| 5. MCP Service registration | **Declarative YAML** | `mcp_service` |
| 6. Lakebase CDF config | Notebook task | Still API (`setup_cdf_config.py`) |
| 7. app_role SP update | Notebook task | Still API (`setup_app_role_sp.py`) |
| **Auto-trigger** | **Declarative YAML** | `job_run` triggers post_deploy_setup on every deploy |

### Net Result

| Metric | Before | After |
|--------|--------|-------|
| Manual post-deploy steps | 7 | 0 (auto-triggered) |
| Post-deploy notebooks | 7 | 5 (secrets + MCP eliminated) |
| `bundle deploy` is self-contained | No | Yes (with `job_run`) |
| Secret values in code | Notebook runtime | Deploy-time variables |

---

## 6. Engine Requirement: Direct Deployment

All four resource types require the **direct deployment engine**. This is set in `databricks.yml`:

```yaml
bundle:
  name: ground-truth-infra
  engine: direct  # Required for secret, job_run, mcp_service
```

Or via environment variable: `DATABRICKS_BUNDLE_ENGINE=direct`

**Migration:** Existing bundles can migrate with `databricks bundle deployment migrate`. For new bundles (ours), just add `engine: direct`.

**What changes:**
- Resource management uses the new deployment engine (more granular updates)
- No functional impact on existing resources (jobs, schemas, Lakebase, etc.)
- Enables the newer resource types

---

## 7. Bonus Finding: Complete DAB Resource Type List

For reference, the full list of DAB-supported resource types as of CLI 1.17.0+:

| Resource | Python Support | Direct Engine Only |
|----------|---------------|--------------------|
| `alert` | Yes | No |
| `app` | Yes | No |
| `catalog` | Yes | No |
| `cluster` | Yes | No |
| `cluster_policy` | Yes | No |
| `dashboard` | Yes | No |
| `database_catalog` | Yes | No |
| `database_instance` | Yes | No |
| `experiment` | Yes | No |
| `external_location` | Yes | No |
| `genie_spaces` | Yes | No |
| `instance_pool` | Yes | No |
| `job` | Yes | No |
| **`job_run`** | Yes | **Yes** |
| **`mcp_service`** | Yes | **Yes** |
| `model` (legacy) | Yes | No |
| `model_provider_service` | Yes | No |
| `model_service` | Yes | No |
| `model_serving_endpoint` | Yes | No |
| `pipeline` | Yes | No |
| `postgres_branch` | No | No |
| `postgres_catalog` | No | No |
| `postgres_database` | No | No |
| `postgres_endpoint` | No | No |
| `postgres_project` | No | No |
| `postgres_role` | No | No |
| `postgres_snapshot_schedule` | No | No |
| `postgres_synced_table` | No | No |
| `quality_monitor` | Yes | No |
| `registered_model` | Yes | No |
| `schema` | Yes | No |
| **`secret`** | Yes | **Yes** |
| **`secret_scope`** | Yes | No |
| `sql_warehouse` | Yes | No |
| `synced_database_table` | Yes | No |
| `vector_search_endpoint` | Yes | No |
| `vector_search_index` | Yes | No |
| `volume` | Yes | No |

**Notable new additions for our project:**
- `genie_spaces` — could be useful for the agent bundle (data room for ground truth queries)
- `mcp_service` — replaces manual Unity Gateway MCP registration
- `secret` + `secret_scope` — replaces manual secret management
- `job_run` — deploy hooks
- `postgres_snapshot_schedule` — Lakebase backup automation (not in our current plan but available)
- `quality_monitor` — data quality monitoring (relevant for ground truth data validation)

---

## 8. Impact on Plan Files

These findings require updates to both existing plan files:

### `post_deploy_automation_plan.md`

| Section | Change |
|---------|--------|
| Task 1 (`setup_secrets`) | **Eliminate** — replace with `secret` resources in YAML |
| Job trigger | Add `job_run` resource that auto-triggers the job on deploy |
| Deployment workflow | Remove manual `bundle run` step — it's automatic now |
| Files to Create | Remove `setup_secrets.py` from the list |
| Engine requirement | Add `engine: direct` to `databricks.yml` |

### `feedback_pipeline_rework_plan.md`

No direct changes — `genie_task` findings are unchanged. But the deploy sequence simplifies because `job_run` auto-triggers the post-deploy setup.

### `infra_build_plan.md`

| Section | Change |
|---------|--------|
| Resource Inventory | Add UC secrets (3), MCP service (1), job_run (1) to DAB-declared table |
| Manual/CLI Resources | Move secrets + MCP registration to DAB-declared; remove from manual table |
| Variables | Add `slack_webhook_url`, `teams_webhook_url`, `git_token` as sensitive vars |
| Engine | Add `engine: direct` requirement note |

---

## 9. Recommended Variable Pattern for Secrets

Secret values should never be in source control. Use bundle variables with deploy-time injection:

```yaml
# databricks.yml
variables:
  slack_webhook_url:
    description: "Slack webhook URL for failure notifications"
    type: string
  teams_webhook_url:
    description: "Teams webhook URL for failure notifications"
    type: string
  git_token:
    description: "GitHub PAT for feedback pipeline branch creation"
    type: string
```

**Injection methods (choose one):**

1. **CLI flags:** `databricks bundle deploy --var slack_webhook_url=https://hooks.slack.com/...`
2. **Environment variables:** `export BUNDLE_VAR_slack_webhook_url=https://hooks.slack.com/...`
3. **Variable overrides file:** `.databricks/.bundle/<target>/variable-overrides.json` (gitignored)
4. **CI/CD secrets:** GitHub Actions / Azure DevOps secrets → env vars

---

## 10. Open Questions

1. **UC Secrets compute compatibility:** Our notebooks run on serverless — confirmed compatible (env v4+). But do the Lakeflow Job environments support UC secret retrieval? Need to verify.
2. **`job_run` ordering guarantees:** If the bundle declares both `job` and `job_run` resources, is it guaranteed the job is created before the run triggers? Docs imply yes, but not explicitly stated.
3. **`job_run` + `genie_task` interaction:** If `setup_job_params` patches the `feedback_pipeline` job to add a `genie_task`, and a `job_run` fires on every deploy, does the job_run conflict with the `bundle deploy` that just set the job definition? Potential race condition.
4. **`mcp_service` without connection:** Can the `mcp_service` resource be deployed with a placeholder connection (before Bundle 2 provides the real app URL)? Or does it fail if the connection doesn't exist?
5. **Direct engine migration:** Does enabling `engine: direct` affect any existing resources (jobs, schemas, Lakebase)? The docs say no functional impact, but we should test with `bundle validate` first.

---

## References

- [DAB resources reference](https://docs.databricks.com/aws/en/dev-tools/bundles/resources/) — complete resource type list and schemas
- [Unity Catalog Secrets](https://docs.databricks.com/aws/en/security/secrets/unity-catalog-secrets/) — UC secret management
- [Register an external MCP server](https://docs.databricks.com/aws/en/ai-gateway/register-mcp-service/) — MCP service registration including DAB YAML
- [Run Job task for jobs](https://docs.databricks.com/aws/en/jobs/tasks/run-job/) — Run Job task type (related but different from `job_run` resource)
- [Migrate to direct deployment engine](https://docs.databricks.com/aws/en/dev-tools/bundles/direct/) — engine migration guide
- L300-03 Secrets & Notifications — original infra secret design
- L300-07 Unity Gateway — original MCP service design
