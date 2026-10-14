# Post-Deploy Automation Plan

## Purpose

Replace the 6 manual post-deploy steps documented in `PROJECT_MEMORY.md` with a mix of **declarative DAB resources** and SDK-driven notebook tasks in a `post_deploy_setup` Lakeflow Job, auto-triggered on every deploy via a `job_run` resource.

**Design sources:** Original manual steps from L300-03, L300-06, L300-07, L300-08; SDK research from session 2026-10-09; DAB resource type research from `docs/research/04_dab_secrets_jobruns_mcp.md`.

**Prerequisites:**
- `bundle deploy --target dev` succeeded (Phase 1–8 of `infra_build_plan.md`).
- `engine: direct` set in `databricks.yml` (required for `secret`, `job_run`, `mcp_service` resources).
- Databricks CLI ≥ 1.17.0 (for `mcp_service`; `secret` needs ≥ 1.12.0, `job_run` needs ≥ 1.7.0).

---

## Scope

The original 6 manual steps are now handled by three mechanisms:

| Mechanism | Steps | When |
|-----------|-------|---------|
| **Declarative resources** (deploy-time) | UC Secrets (3), MCP Service registration | Deployed by `bundle deploy` — no notebook needed |
| **Job Group A — Unblocked** (auto-triggered) | Genie Code automation, feedback_pipeline job params | Auto-triggered on every deploy via `job_run` resource |
| **Job Group B — Post-Bundle 2** (auto-triggered) | Unity Gateway connection, Lakebase CDF config, app_role SP update | Auto-triggered when `app_url` param is set |

Groups A and B are tasks in the same `post_deploy_setup` job. A `job_run` resource auto-triggers this job on every `bundle deploy` — no manual `bundle run` step needed. Group B tasks have `run_if: AT_LEAST_ONE_SUCCESS` on a gate task that checks whether Bundle 2 outputs are available.

---

## New Resources

### Declarative Resources (deploy-time)

These are created/updated by `bundle deploy` itself — no notebook or API call needed:

| Resource Key | Type | File | What It Replaces |
|-------------|------|------|------------------|
| `slack_webhook` | `secret` (UC) | `resources/secrets/slack_webhook.secret.yml` | `setup_secrets.py` Task 1 (scope + put) |
| `teams_webhook` | `secret` (UC) | `resources/secrets/teams_webhook.secret.yml` | `setup_secrets.py` Task 1 |
| `git_token` | `secret` (UC) | `resources/secrets/git_token.secret.yml` | `setup_secrets.py` Task 1 |
| `ground_truth_mcp` | `mcp_service` | `resources/mcp/ground_truth_mcp.mcp_service.yml` | Manual Unity Gateway UI MCP registration |
| `run_post_deploy` | `job_run` | `resources/jobs/run_post_deploy.job_run.yml` | Manual `databricks bundle run post_deploy_setup` |

### Job: `post_deploy_setup`

**File:** `resources/jobs/post_deploy_setup.job.yml`
**Schedule:** Auto-triggered by `job_run` resource on every `bundle deploy`

```
post_deploy_setup job (auto-triggered by job_run on deploy)
  ├── Task 1: setup_genie_automation  (Group A — unblocked)
  ├── Task 2: setup_job_params        (Group A — depends on Task 1)
  ├── Task 3: check_bundle2_ready     (condition_task — gate)
  ├── Task 4: setup_gateway_connection (Group B — depends on Task 3)
  ├── Task 5: setup_cdf_config        (Group B — depends on Task 3)
  └── Task 6: setup_app_role_sp       (Group B — depends on Task 3)
```

> **Note:** `setup_secrets` task eliminated — UC secrets are now declarative resources. MCP Service registration also eliminated — `mcp_service` resource handles it.

### Notebooks

| File | Purpose | SDK Methods | Group |
|------|---------|-------------|-------|
| ~~`src/notebooks/setup_secrets.py`~~ | ~~Create scope + put secrets~~ | ~~`w.secrets.create_scope()`, `w.secrets.put_secret()`~~ | ~~A~~ **ELIMINATED — replaced by `secret` resources** |
| `src/notebooks/setup_genie_automation.py` | Create/update the feedback loop Genie Code automation | `w.api_client.do("POST", "/api/2.0/alerts-internal/scheduled-insights", ...)` | A |
| `src/notebooks/setup_job_params.py` | Patch feedback_pipeline with `configuration_id` from Task 1 | `w.jobs.update()` or `w.api_client.do("POST", "/api/2.1/jobs/reset", ...)` | A |
| `src/notebooks/setup_gateway_connection.py` | Create/update Unity Gateway HTTP connection + grant | `w.connections.create()`, `w.connections.update()`, `w.grants.update()` | B |
| `src/notebooks/setup_cdf_config.py` | Configure Lakebase Lakehouse Sync | `w.postgres.create_cdf_config()` | B |
| `src/notebooks/setup_app_role_sp.py` | Update app_role identity to SERVICE_PRINCIPAL | `w.postgres.update_role()` with `update_mask="spec.identity_type"` | B |

---

## Phase 0: Declarative Resources (deploy-time)

These resources are created/updated automatically by `bundle deploy` — no notebook, no API call.

### UC Secrets (3 resources)

**Files:** `resources/secrets/slack_webhook.secret.yml`, `teams_webhook.secret.yml`, `git_token.secret.yml`

Each follows this pattern:

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
```

**Bundle variables required (in `databricks.yml`):**
```yaml
variables:
  slack_webhook_url:
    description: "Slack incoming webhook URL for failure notifications"
  teams_webhook_url:
    description: "Teams incoming webhook URL for failure notifications"
  git_token:
    description: "GitHub PAT for feedback pipeline branch creation"
```

**Value injection at deploy time (choose one):**
- CLI: `databricks bundle deploy --var slack_webhook_url=https://hooks.slack.com/...`
- Env: `export BUNDLE_VAR_slack_webhook_url=https://hooks.slack.com/...`
- File: `.databricks/.bundle/<target>/variable-overrides.json` (gitignored)

**Consumer migration:**
- Before: `dbutils.secrets.get(scope="ground-truth-infra", key="slack_webhook_url")`
- After: `dbutils.secrets.get(scope=None, key="${var.catalog}.${schema}.slack_webhook_url")`
- Or SQL: `SELECT secret('catalog.schema.slack_webhook_url')`
- Requires serverless env v4+ or DBR 17.3+ (our compute is serverless — compatible)

> **Replaces:** `setup_secrets.py` notebook (Task 1 in prior plan). Workspace-level scope no longer needed.

### MCP Service (1 resource)

**File:** `resources/mcp/ground_truth_mcp.mcp_service.yml`

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

**Dependency:** The `source_connection` must exist first. It references the UC HTTP connection created by `setup_gateway_connection.py` (Group B Task 4). On first deploy (pre-Bundle 2), this resource will fail if the connection doesn't exist. Options:
- (a) Use `lifecycle.prevent_destroy: true` and accept the deploy warning until Bundle 2
- (b) Create a placeholder connection first
- (c) Move the `mcp_service` resource to a separate include file, only included after Bundle 2

> **Replaces:** Manual Unity Gateway UI MCP Service registration step.

### Job Run (deploy hook)

**File:** `resources/jobs/run_post_deploy.job_run.yml`

```yaml
resources:
  job_runs:
    run_post_deploy:
      job_id: ${resources.jobs.post_deploy_setup.id}
      job_parameters:
        app_url: ""
        app_sp_client_id: ""
      only:
        - setup_genie_automation
        - +setup_job_params
      lifecycle:
        triggers:
          - always
```

**Behavior:** Fires on every `bundle deploy`. The `only` field cherry-picks Group A tasks by default. To run Group B, pass `app_url` at deploy time or run the full job manually.

> **Replaces:** Manual `databricks bundle run post_deploy_setup --target dev` step.

---

## Phase 1: Group A Notebooks (Auto-triggered)

### Task 1: `setup_genie_automation`

**Widgets:** `catalog`, `schema`, `git_folder_id`, `prompt_path` (default: `fixtures/prompts/feedback_loop_prompt.md`)

**Logic:**
1. Read the prompt file from the workspace (relative to bundle root)
2. Build the `user_prompt` with `{{catalog}}` and `{{schema}}` placeholders for runtime substitution
3. List existing automations; find by `display_name == "Ground Truth Feedback Loop"`
4. If exists: PATCH with updated prompt (requires `etag`)
5. If not: POST to create new automation (no `schedule`, no `trigger`)
6. `dbutils.jobs.taskValues.set(key="configuration_id", value=configuration_id)`

**Validation:** GET the automation back; confirm `insight_type == "GENIE_CODE"` and prompt matches

**Reference:** `docs/research/03_genie_code_workflow_tasks.md` §2–3

---

### Task 2: `setup_job_params`

**Widgets:** `feedback_job_id` (default: `${resources.jobs.feedback_pipeline.id}`), `catalog`, `schema`

**Depends on:** Task 1 (reads `configuration_id` from taskValues)

**Logic:**
1. Read `configuration_id` from Task 1 via `dbutils.jobs.taskValues.get(taskKey="setup_genie_automation", key="configuration_id")`
2. GET the current feedback_pipeline job definition
3. Replace the `create_feature_branch` task with a `genie_task` block (see `feedback_pipeline_rework_plan.md`)
4. POST `/api/2.1/jobs/reset` with the updated tasks array

**Validation:** GET the job back; confirm task 2 has `genie_task.configuration_id` set

**Note:** This task is only needed on first deploy or when the automation changes. Subsequent `bundle deploy` runs will preserve the `genie_task` in the DAB YAML once the `configuration_id` is known and hardcoded.

---

## Phase 2: Group B Notebooks (Post-Bundle 2)

### Task 3 (Gate): `check_bundle2_ready`

**Type:** `condition_task`

**Logic:** Check if the Bundle 2 app exists and has a URL:
```
left: "{{job.parameters.app_url}}"
op: NOT_EQUAL
right: ""
```

If `app_url` is empty/unset, Group B tasks are skipped. The job succeeds with Group A tasks only.

---

### Task 4: `setup_gateway_connection`

**Widgets:** `connection_name` (default: `ground-truth-mcp`), `app_url`, `base_path` (default: `/mcp`)

**Logic:**
1. Try `w.connections.get(connection_name)` — if exists, update with `w.connections.update()` to set the real `app_url`
2. If not: `w.connections.create(name, ConnectionType.HTTP, options={"host": app_url, "port": "443", "base_path": base_path})`
3. Grant USE CONNECTION: `w.grants.update("connection", connection_name, changes=[PermissionsChange(add=[Privilege.USE_CONNECTION], principal="users")])`
4. `dbutils.jobs.taskValues.set(key="connection_name", value=connection_name)`

**Validation:** `w.connections.get(connection_name)` returns the connection with correct host

**Note:** MCP Service registration is now handled declaratively by the `mcp_service` resource (see Phase 0). This task only creates the HTTP connection — it no longer needs to handle MCP registration in the Gateway UI.

---

### Task 5: `setup_cdf_config`

**Widgets:** `catalog`, `schema`, `postgres_schema` (default: `public`), `lakebase_branch_id` (DAB substitution)

**Logic:**
1. Check if CDF config already exists: `w.postgres.list_cdf_configs(parent=branch_id)`
2. If not: `w.postgres.create_cdf_config(parent=branch_id, cdf_config=CdfConfig(catalog=catalog, schema=schema, postgres_schema=postgres_schema))`
3. Wait for operation to complete: `operation.wait()`

**Validation:** `w.postgres.get_cdf_config()` returns the config; `lb_*_history` tables appear in the UC schema

**Dependency:** Requires Bundle 2 to have created the Lakebase tables (assets, votes, etc.) via app migrations. The CDF config maps an existing Postgres schema — there must be tables to replicate.

---

### Task 6: `setup_app_role_sp`

**Widgets:** `role_resource_name` (DAB substitution from `${resources.postgres_roles.app_role.id}`), `app_sp_client_id`

**Logic:**
1. `w.postgres.update_role(name=role_resource_name, role=Role(spec=RoleRoleSpec(identity_type=RoleIdentityType.SERVICE_PRINCIPAL, postgres_role=app_sp_client_id)), update_mask=FieldMask(paths=["spec.identity_type", "spec.postgres_role"]))`
2. Wait: `operation.wait()`

**Validation:** `w.postgres.get_role(role_resource_name)` shows `identity_type: SERVICE_PRINCIPAL`

**Dependency:** Requires the Bundle 2 app's service principal client ID.

---

## Job YAML Skeleton

```yaml
# resources/jobs/post_deploy_setup.job.yml
resources:
  jobs:
    post_deploy_setup:
      name: "Semantic Ground Truth — Post-Deploy Setup"
      description: "Automates post-deploy steps: Genie Code automation, Gateway connection, CDF config, app role. Secrets and MCP Service are now declarative resources."

      parameters:
        - name: app_url
          default: ""
        - name: app_sp_client_id
          default: ""

      environments:
        - environment_key: serverless
          spec:
            client: "1"

      tasks:
        # --- Group A: Unblocked (auto-triggered by job_run on every deploy) ---
        - task_key: setup_genie_automation
          notebook_task:
            notebook_path: ../../src/notebooks/setup_genie_automation.py
            base_parameters:
              catalog: "${var.catalog}"
              schema: "${resources.schemas.ground_truth_schema.name}"
              git_folder_id: "4271072627166222"
          environment_key: serverless

        - task_key: setup_job_params
          depends_on:
            - task_key: setup_genie_automation
          notebook_task:
            notebook_path: ../../src/notebooks/setup_job_params.py
            base_parameters:
              feedback_job_id: "${resources.jobs.feedback_pipeline.id}"
              catalog: "${var.catalog}"
              schema: "${resources.schemas.ground_truth_schema.name}"
          environment_key: serverless

        # --- Gate: Bundle 2 ready? (Group B skipped when app_url empty) ---
        - task_key: check_bundle2_ready
          condition_task:
            left: "{{job.parameters.app_url}}"
            op: NOT_EQUAL
            right: ""

        # --- Group B: Post-Bundle 2 ---
        - task_key: setup_gateway_connection
          depends_on:
            - task_key: check_bundle2_ready
              outcome: "true"
          notebook_task:
            notebook_path: ../../src/notebooks/setup_gateway_connection.py
            base_parameters:
              connection_name: "ground-truth-mcp"
              app_url: "{{job.parameters.app_url}}"
              base_path: "/mcp"
          environment_key: serverless

        - task_key: setup_cdf_config
          depends_on:
            - task_key: check_bundle2_ready
              outcome: "true"
          notebook_task:
            notebook_path: ../../src/notebooks/setup_cdf_config.py
            base_parameters:
              catalog: "${var.catalog}"
              schema: "${resources.schemas.ground_truth_schema.name}"
              lakebase_branch_id: "${resources.postgres_branches.production.id}"
          environment_key: serverless

        - task_key: setup_app_role_sp
          depends_on:
            - task_key: check_bundle2_ready
              outcome: "true"
          notebook_task:
            notebook_path: ../../src/notebooks/setup_app_role_sp.py
            base_parameters:
              role_resource_name: "${resources.postgres_roles.app_role.id}"
              app_sp_client_id: "{{job.parameters.app_sp_client_id}}"
          environment_key: serverless

      email_notifications:
        on_failure:
          - matthew.giglia@databricks.com
```

---

## Deployment Workflow

```bash
# Standard deploy (Group A auto-triggers via job_run — no manual step)
databricks bundle deploy --target dev \
  --var slack_webhook_url="$SLACK_URL" \
  --var teams_webhook_url="$TEAMS_URL" \
  --var git_token="$GIT_TOKEN"
# → Secrets + MCP Service deployed declaratively
# → job_run auto-triggers post_deploy_setup (Group A tasks only)

# After Bundle 2 deploys (Group A + B)
# Option A: Redeploy with app params in the job_run resource
# Option B: Manual run with params:
databricks bundle run post_deploy_setup --target dev \
  --params app_url=https://<app>.databricksapps.com \
  --params app_sp_client_id=<uuid>
```

Group A tasks are idempotent — safe to re-run on every deploy. Group B tasks skip automatically when `app_url` is empty. The `job_run` resource's `only` field limits auto-triggered runs to Group A tasks.

---

## Files to Create

| File | Type | Status |
|------|------|--------|
| `resources/jobs/post_deploy_setup.job.yml` | Job YAML | New |
| `resources/jobs/run_post_deploy.job_run.yml` | Job Run YAML | New |
| `resources/secrets/slack_webhook.secret.yml` | UC Secret YAML | New |
| `resources/secrets/teams_webhook.secret.yml` | UC Secret YAML | New |
| `resources/secrets/git_token.secret.yml` | UC Secret YAML | New |
| `resources/mcp/ground_truth_mcp.mcp_service.yml` | MCP Service YAML | New |
| `src/notebooks/setup_genie_automation.py` | Notebook | New |
| `src/notebooks/setup_job_params.py` | Notebook | New |
| `src/notebooks/setup_gateway_connection.py` | Notebook | New |
| `src/notebooks/setup_cdf_config.py` | Notebook | New |
| `src/notebooks/setup_app_role_sp.py` | Notebook | New |

> **Eliminated:** `src/notebooks/setup_secrets.py` — replaced by 3 UC `secret` resources.

## Files to Update

| File | Change |
|------|--------|
| `databricks.yml` | Add `engine: direct` (done), add secret variables |
| `PROJECT_MEMORY.md` | Replace "Manual Post-Deploy Steps" with reference to declarative resources + `post_deploy_setup` job |
| `README.md` | Add `post_deploy_setup` to jobs table; update Deploy section |
| `docs/sessions/INDEX.md` | Add session entry for this work |

---

## Superseded Manual Steps

After these resources are implemented, the following manual steps in `PROJECT_MEMORY.md` are replaced:

| Original Manual Step | Replaced By | Mechanism |
|---------------------|-------------|----------|
| UC Secrets: create scope + put secrets | 3 UC `secret` resources | **Declarative** (deploy-time) |
| Genie Code skill: `POST /api/2.1/unity-catalog/skills` | Task 1: `setup_genie_automation` | Notebook (auto-triggered) |
| Job params: set `genie_space_id` + `git_folder_id` | Task 2: `setup_job_params` | Notebook (auto-triggered) |
| Unity Gateway connection | Task 4: `setup_gateway_connection` | Notebook (Group B) |
| MCP Service registration (Unity Gateway UI) | `mcp_service` resource | **Declarative** (deploy-time) |
| Lakebase Lakehouse Sync | Task 5: `setup_cdf_config` | Notebook (Group B) |
| Lakebase `app_role` identity | Task 6: `setup_app_role_sp` | Notebook (Group B) |
| Manual `bundle run post_deploy_setup` | `job_run` resource with `triggers: [always]` | **Declarative** (deploy hook) |

---

## Open Questions

1. ~~**MCP Service registration:** The Unity Gateway UI step (mapping connection → MCP Service) has no known REST API. May remain the only manual step.~~ **RESOLVED** — `mcp_service` DAB resource type (CLI 1.17.0+) handles this declaratively. See `docs/research/04_dab_secrets_jobruns_mcp.md` §4.
2. **Secret values in CI/CD:** How are secret values injected in automated deploys? Options: `BUNDLE_VAR_*` env vars, `--var` CLI flags, `.databricks/.bundle/<target>/variable-overrides.json` (gitignored), or external vault → env vars. Define the pattern for `deploy.sh`.
3. **CDF config granularity:** Does `create_cdf_config` replicate all tables in the Postgres schema, or do we need per-table configuration? Verify with a test call.
4. **`mcp_service` connection dependency:** The `mcp_service` resource references a UC connection that doesn't exist until Group B runs. Deploy may fail on first run. Options: (a) accept the warning, (b) placeholder connection, (c) conditional include. See Phase 0 notes.
5. **`job_run` ordering:** Is it guaranteed the `job` is created before the `job_run` triggers? Docs imply yes for same-bundle resources, but not explicitly stated.
6. **`job_run` + `genie_task` interaction:** If `setup_job_params` patches the `feedback_pipeline` job and the `job_run` fires on every deploy, could the deploy and the job_run race? The deploy sets the job definition; the job_run's `setup_job_params` may re-patch it. Mitigated by idempotency but worth testing.
7. **Direct engine migration:** Does enabling `engine: direct` affect existing deployed resources (jobs, schemas, Lakebase)? Docs say no, but run `databricks bundle validate` before first deploy with the new engine.
