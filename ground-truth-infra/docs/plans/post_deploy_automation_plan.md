# Post-Deploy Automation Plan

## Purpose

Replace the 6 manual post-deploy steps documented in `PROJECT_MEMORY.md` with SDK-driven notebook tasks in a new `post_deploy_setup` Lakeflow Job. Every step has Python SDK coverage (verified Oct 2026) and can be made idempotent.

**Design sources:** Original manual steps from L300-03, L300-06, L300-07, L300-08; SDK research from session 2026-10-09.

**Prerequisite:** `bundle deploy --target dev` succeeded (Phase 1–8 of `infra_build_plan.md`).

---

## Scope

The 6 manual steps split into two groups by dependency:

| Group | Steps | Trigger |
|-------|-------|---------|
| **A — Unblocked now** | UC Secrets, Genie Code automation, feedback_pipeline job params | Run immediately after `bundle deploy` |
| **B — Post-Bundle 2** | Unity Gateway connection, Lakebase CDF config, app_role SP update | Run after Bundle 2 deploys and the app SP + URL are known |

Both groups are tasks in the same job. Group B tasks have `run_if: AT_LEAST_ONE_SUCCESS` on a gate task that checks whether Bundle 2 outputs are available, so the job can be run at either stage.

---

## New Resources

### Job: `post_deploy_setup`

**File:** `resources/jobs/post_deploy_setup.job.yml`
**Schedule:** On-demand (triggered manually or by `deploy.sh`)

```
post_deploy_setup job
  ├── Task 1: setup_secrets           (Group A — unblocked)
  ├── Task 2: setup_genie_automation  (Group A — unblocked)
  ├── Task 3: setup_job_params        (Group A — depends on Task 2)
  ├── Task 4: check_bundle2_ready     (condition_task — gate)
  ├── Task 5: setup_gateway_connection (Group B — depends on Task 4)
  ├── Task 6: setup_cdf_config        (Group B — depends on Task 4)
  └── Task 7: setup_app_role_sp       (Group B — depends on Task 4)
```

### Notebooks

| File | Purpose | SDK Methods | Group |
|------|---------|-------------|-------|
| `src/notebooks/setup_secrets.py` | Create scope + put secrets | `w.secrets.create_scope()`, `w.secrets.put_secret()` | A |
| `src/notebooks/setup_genie_automation.py` | Create/update the feedback loop Genie Code automation | `w.api_client.do("POST", "/api/2.0/alerts-internal/scheduled-insights", ...)` | A |
| `src/notebooks/setup_job_params.py` | Patch feedback_pipeline with `configuration_id` from Task 2 | `w.jobs.update()` or `w.api_client.do("POST", "/api/2.1/jobs/reset", ...)` | A |
| `src/notebooks/setup_gateway_connection.py` | Create/update Unity Gateway HTTP connection + grant | `w.connections.create()`, `w.connections.update()`, `w.grants.update()` | B |
| `src/notebooks/setup_cdf_config.py` | Configure Lakebase Lakehouse Sync | `w.postgres.create_cdf_config()` | B |
| `src/notebooks/setup_app_role_sp.py` | Update app_role identity to SERVICE_PRINCIPAL | `w.postgres.update_role()` with `update_mask="spec.identity_type"` | B |

---

## Phase 1: Group A Notebooks (Unblocked)

### Task 1: `setup_secrets`

**Widgets:** `scope_name` (default: `ground-truth-infra`), `slack_webhook_url`, `teams_webhook_url`, `git_token`

**Logic:**
1. `w.secrets.create_scope(scope)` — wrap in try/except for "scope already exists"
2. `w.secrets.put_secret(scope, key, string_value=val)` for each of the 3 secrets
3. Idempotent: `put_secret` overwrites if key exists

**Validation:** `w.secrets.list_secrets(scope)` returns 3 keys

**Note:** Secret VALUES must be passed as widget params at run time — never hardcoded. For CI/CD, inject from environment variables or a vault.

---

### Task 2: `setup_genie_automation`

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

### Task 3: `setup_job_params`

**Widgets:** `feedback_job_id` (default: `${resources.jobs.feedback_pipeline.id}`), `catalog`, `schema`

**Depends on:** Task 2 (reads `configuration_id` from taskValues)

**Logic:**
1. Read `configuration_id` from Task 2 via `dbutils.jobs.taskValues.get(taskKey="setup_genie_automation", key="configuration_id")`
2. GET the current feedback_pipeline job definition
3. Replace the `create_feature_branch` task with a `genie_task` block (see `feedback_pipeline_rework_plan.md`)
4. POST `/api/2.1/jobs/reset` with the updated tasks array

**Validation:** GET the job back; confirm task 2 has `genie_task.configuration_id` set

**Note:** This task is only needed on first deploy or when the automation changes. Subsequent `bundle deploy` runs will preserve the `genie_task` in the DAB YAML once the `configuration_id` is known and hardcoded.

---

## Phase 2: Group B Notebooks (Post-Bundle 2)

### Gate Task: `check_bundle2_ready`

**Type:** `condition_task`

**Logic:** Check if the Bundle 2 app exists and has a URL:
```
left: "{{job.parameters.app_url}}"
op: NOT_EQUAL
right: ""
```

If `app_url` is empty/unset, Group B tasks are skipped. The job succeeds with Group A tasks only.

---

### Task 5: `setup_gateway_connection`

**Widgets:** `connection_name` (default: `ground-truth-mcp`), `app_url`, `base_path` (default: `/mcp`)

**Logic:**
1. Try `w.connections.get(connection_name)` — if exists, update with `w.connections.update()` to set the real `app_url`
2. If not: `w.connections.create(name, ConnectionType.HTTP, options={"host": app_url, "port": "443", "base_path": base_path})`
3. Grant USE CONNECTION: `w.grants.update("connection", connection_name, changes=[PermissionsChange(add=[Privilege.USE_CONNECTION], principal="users")])`
4. `dbutils.jobs.taskValues.set(key="connection_name", value=connection_name)`

**Validation:** `w.connections.get(connection_name)` returns the connection with correct host

**Caveat:** The MCP Service registration in Unity Gateway UI (mapping the connection to an MCP endpoint) does not have a known REST API. This sub-step may remain manual. Document in the session summary if confirmed.

---

### Task 6: `setup_cdf_config`

**Widgets:** `catalog`, `schema`, `postgres_schema` (default: `public`), `lakebase_branch_id` (DAB substitution)

**Logic:**
1. Check if CDF config already exists: `w.postgres.list_cdf_configs(parent=branch_id)`
2. If not: `w.postgres.create_cdf_config(parent=branch_id, cdf_config=CdfConfig(catalog=catalog, schema=schema, postgres_schema=postgres_schema))`
3. Wait for operation to complete: `operation.wait()`

**Validation:** `w.postgres.get_cdf_config()` returns the config; `lb_*_history` tables appear in the UC schema

**Dependency:** Requires Bundle 2 to have created the Lakebase tables (assets, votes, etc.) via app migrations. The CDF config maps an existing Postgres schema — there must be tables to replicate.

---

### Task 7: `setup_app_role_sp`

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
      description: "Automates manual post-deploy steps: secrets, Genie Code automation, Gateway connection, CDF config, app role."

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
        # --- Group A: Unblocked ---
        - task_key: setup_secrets
          notebook_task:
            notebook_path: ../../src/notebooks/setup_secrets.py
            base_parameters:
              scope_name: "ground-truth-infra"
          environment_key: serverless

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

        # --- Gate: Bundle 2 ready? ---
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
# After bundle deploy (Group A only — no app_url yet)
databricks bundle run post_deploy_setup --target dev

# After Bundle 2 deploys (Group A + B)
databricks bundle run post_deploy_setup --target dev \
  --params app_url=https://<app>.databricksapps.com \
  --params app_sp_client_id=<uuid>
```

Group A tasks are idempotent — safe to re-run. Group B tasks skip automatically when `app_url` is empty.

---

## Files to Create

| File | Type | Status |
|------|------|--------|
| `resources/jobs/post_deploy_setup.job.yml` | Job YAML | New |
| `src/notebooks/setup_secrets.py` | Notebook | New |
| `src/notebooks/setup_genie_automation.py` | Notebook | New |
| `src/notebooks/setup_job_params.py` | Notebook | New |
| `src/notebooks/setup_gateway_connection.py` | Notebook | New |
| `src/notebooks/setup_cdf_config.py` | Notebook | New |
| `src/notebooks/setup_app_role_sp.py` | Notebook | New |

## Files to Update

| File | Change |
|------|--------|
| `PROJECT_MEMORY.md` | Replace "Manual Post-Deploy Steps" with reference to `post_deploy_setup` job |
| `README.md` | Add `post_deploy_setup` to jobs table; update Deploy section |
| `docs/sessions/INDEX.md` | Add session entry for this work |

---

## Superseded Manual Steps

After this job is implemented, the following manual steps in `PROJECT_MEMORY.md` are replaced:

| Original Manual Step | Replaced By |
|---------------------|-------------|
| UC Secrets: create scope + put secrets | Task 1: `setup_secrets` |
| Genie Code skill: `POST /api/2.1/unity-catalog/skills` | Task 2: `setup_genie_automation` (creates automation, not UC skill) |
| Job params: set `genie_space_id` + `git_folder_id` | Task 3: `setup_job_params` (sets `configuration_id` instead) |
| Unity Gateway connection | Task 5: `setup_gateway_connection` |
| Lakebase Lakehouse Sync | Task 6: `setup_cdf_config` |
| Lakebase `app_role` identity | Task 7: `setup_app_role_sp` |

---

## Open Questions

1. **MCP Service registration:** The Unity Gateway UI step (mapping connection → MCP Service) has no known REST API. May remain the only manual step. Investigate further.
2. **Secret values in CI/CD:** How are secret values injected in automated deploys? Environment variables? External vault? Define the pattern for `deploy.sh`.
3. **CDF config granularity:** Does `create_cdf_config` replicate all tables in the Postgres schema, or do we need per-table configuration? Verify with a test call.
