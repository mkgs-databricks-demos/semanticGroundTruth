# Plan: Infra Bundle Changes for App Bundle Support

**Branch:** `mg-genie-app-scaffold`
**Date:** 2026-10-14
**Prerequisite:** App bundle scaffolded via `databricks apps init --skip-install` (AppKit v0.84.0)
**Context:** MCP service already moved from infra to app `databricks.yml` on this branch.

---

## Summary

Three categories of work remain in the infra bundle to fully support the app:

1. **New resources** — the app scaffold declared resource bindings (MLflow experiment, skills volume, job) that currently reference foreign projects; infra must declare project-owned replacements.
2. **deploy.sh Phase 2** — the app deploy step is a TODO placeholder; implement it with variable passing and MCP connection update.
3. **Cleanup** — remove the deprecated MCP service file and update related comments.

---

## 1. New Infra Resources

### 1a. MLflow Experiment (for app agent tracing)

**Why:** The AppKit agents plugin traces agent turns and tool calls to an MLflow experiment via OpenTelemetry. The app's `databricks.yml` binds the `agents-mlflow-experiment` resource to `${var.agents_mlflow_experiment_experimentId}`. Currently set to foreign experiment `4038008988926083`.

**Action:** Declare a new MLflow experiment in infra resources.

```yaml
# resources/app_agents_experiment.experiment.yml
resources:
  experiments:
    app_agents_experiment:
      name: /Users/matthew.giglia@databricks.com/ground-truth-app-agents
      # Experiment name is the workspace path; no catalog/schema needed.
      # The ID is resolved via ${resources.experiments.app_agents_experiment.id}
```

**deploy.sh:** Add `MLFLOW_EXPERIMENT_ID` to `resolve_infra_vars()` output, extracted from `resources.experiments.app_agents_experiment.id`.

**App bundle:** Replace placeholder `4038008988926083` with value passed from deploy.sh.

**Decision needed:** Confirm experiment path. Convention from other projects: `/Users/<email>/<app-name>-agents`.

### 1b. UC Volume for Agent Skills

**Why:** The AppKit agents plugin can read skills from a UC volume (`agents-skills` resource, env `DATABRICKS_VOLUME_AGENT_SKILLS`). Currently set to BCDA project volume `/Volumes/hls_fde_dev/dev_matthew_giglia_bcda/landing`.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **(A) New UC volume in infra schema** | Clean ownership; future-proof for UC-sourced skills | Another resource to manage; local skills work fine today |
| **(B) Remove — use local skills only** | Simpler; skills already in `server/agents/skills/` | Loses ability to update skills without redeploying app |
| **(C) Defer — keep placeholder, mark optional** | Unblocks deploy now | Borrowed resource stays in config |

**Recommendation:** Option **(C)** for now. The agents plugin marks this resource as `optional` in `appkit.plugins.json`. Comment out the `agents-skills` resource block in the app `databricks.yml` and remove the variable + target value. Revisit when UC-sourced skills are needed.

If Option A is chosen later:

```yaml
# resources/agent_skills_volume.volume.yml
resources:
  volumes:
    agent_skills:
      catalog_name: ${var.catalog}
      schema_name: ${resources.schemas.ground_truth_schema.name}
      name: agent_skills
      volume_type: MANAGED
```

### 1c. Job Resource Decision

**Why:** The AppKit `jobs` plugin lets the app trigger job runs from the UI. The app binds a `job` resource to `${var.job_id}`. Currently set to infra's `freshness_resurfacing` job (`1103481179431341`).

**Options:**

| Option | When to use |
|--------|-------------|
| **(A) Keep `freshness_resurfacing`** | If the app UI should trigger freshness re-checks (likely — the review engine resurfaces stale assets) |
| **(B) New app-specific job** | If the app needs a distinct job (e.g., batch vote export, campaign close) |
| **(C) Remove — app doesn't need to trigger jobs** | If the jobs plugin was selected by default and isn't needed |

**Recommendation:** Option **(A)**. The `freshness_resurfacing` job is semantically correct — it resurfaces assets whose confidence scores have decayed, which is exactly what the review UI would trigger. Pass its ID via deploy.sh.

**deploy.sh:** Add `FRESHNESS_JOB_ID` to `resolve_infra_vars()`, extracted from `resources.jobs.freshness_resurfacing.id`.

---

## 2. deploy.sh — Implement Phase 2 (App Bundle)

### Current State

Phase 2 (lines 401–410) is a TODO placeholder:
```bash
warn "Bundle 2 (${APP_BUNDLE}) not yet implemented — skipping."
```

`resolve_infra_vars()` already extracts: `CATALOG`, `SCHEMA`, `SCOPE_NAME`, `WORKSPACE_HOST`, `SQL_WAREHOUSE_ID`, `LAKEBASE_PROJECT_ID`.

### Required Changes

#### 2a. Extend `resolve_infra_vars()` — new outputs

Add to the Python parser block:

| Variable | Source in bundle summary | Used by |
|----------|------------------------|---------|
| `MLFLOW_EXPERIMENT_ID` | `resources.experiments.app_agents_experiment.id` | App agents tracing |
| `FRESHNESS_JOB_ID` | `resources.jobs.freshness_resurfacing.id` | App jobs plugin |
| `LAKEBASE_BRANCH` | `resources.postgres_branches.development.name` | App Lakebase connection |
| `LAKEBASE_DATABASE` | `resources.postgres_databases.app_db.name` | App Lakebase connection |

Print lines:
```python
print(f'MLFLOW_EXPERIMENT_ID="{safe(experiment_id)}"')
print(f'FRESHNESS_JOB_ID="{safe(freshness_job_id)}"')
print(f'LAKEBASE_BRANCH="{safe(lakebase_branch)}"')
print(f'LAKEBASE_DATABASE="{safe(lakebase_database)}"')
```

#### 2b. Implement Phase 2 deploy

Replace the TODO block with:

```bash
# Phase 2: App bundle
if [[ "${DEPLOY_APP}" == true ]]; then
  # Ensure we have infra vars (might be --app only run)
  if [[ -z "${CATALOG}" ]]; then
    resolve_infra_vars
  fi

  # Step 2a: Deploy app bundle with resolved variables
  log "Deploying app bundle with infra-resolved variables"
  deploy_bundle "${APP_BUNDLE}" \
    --var "catalog=${CATALOG}" \
    --var "schema_name=${SCHEMA}" \
    --var "sql_warehouse_id=${SQL_WAREHOUSE_ID}" \
    --var "agents_mlflow_experiment_experimentId=${MLFLOW_EXPERIMENT_ID}" \
    --var "job_id=${FRESHNESS_JOB_ID}" \
    --var "postgres_branch=${LAKEBASE_BRANCH}" \
    --var "postgres_database=${LAKEBASE_DATABASE}"

  # Step 2b: Resolve the deployed app URL
  log "Resolving app URL from app bundle summary"
  APP_URL=$(cd_bundle "${SCRIPT_DIR}/${APP_BUNDLE}" && \
    databricks bundle summary --target "${TARGET}" --output json 2>/dev/null | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('resources', {}).get('apps', {})
for app in apps.values():
    url = app.get('url', '')
    if url:
        print(url)
        break
" 2>/dev/null) || true

  # Step 2c: Update MCP HTTP connection with real app URL
  if [[ -n "${APP_URL}" ]]; then
    ok "App URL: ${APP_URL}"
    ensure_http_connection "${APP_URL}"
  else
    warn "Could not resolve app URL — MCP connection not updated."
    warn "Run: ./deploy.sh --target ${TARGET} --infra  (after app starts)"
  fi
fi
```

#### 2c. Handle `agents_serving_endpoint_name`

This variable (`databricks-claude-opus-4-8`) is NOT infra-managed — it's a workspace-level serving endpoint chosen at scaffold time. Two options:

| Option | Approach |
|--------|----------|
| **(A) Hardcode in app target** | Keep current value in app `databricks.yml` target. Simplest. |
| **(B) Pass via deploy.sh** | Add `--var agents_serving_endpoint_name=...` to deploy. Flexible but over-engineered for now. |

**Recommendation:** Option **(A)**. The serving endpoint is a workspace concern, not bundle-managed. The value stays in the app's target block.

---

## 3. Cleanup

### 3a. Delete deprecated MCP service file

**File:** `resources/mcp/ground_truth_mcp.mcp_service.yml`
**Status:** Fully commented out with deprecation header (this branch)
**Action:** Delete the file and the empty `resources/mcp/` directory.
**When:** After first successful app bundle deploy with the MCP service resource.

### 3b. Update deploy.sh header comment

Line 5 of the solution-root `deploy.sh` still lists "MCP service" under infra's responsibilities. Update to reflect the move:

```
#   1. ground-truth-infra    (UC schema, warehouse, Lakebase, secret scope, jobs, MLflow experiment)
```

### 3c. App role identity update (post-deploy)

**File:** `resources/lakebase/app_role.postgres_role.yml`
**Current:** Plain Postgres role (no `identity_type`)
**After Bundle 2 deploys:** The app gets an auto-provisioned SPN. Update the role:

```yaml
resources:
  postgres_roles:
    app_role:
      parent: "${resources.postgres_branches.production.name}"
      role_id: app-role
      postgres_role: ground_truth_app_role
      identity_type: SERVICE_PRINCIPAL
      identity: <app-auto-provisioned-sp-app-id>  # from: databricks apps get ground-truth-app
```

**When:** After first successful `databricks apps start ground-truth-app`. Get the SPN app ID from `databricks apps get ground-truth-app` → `active_deployment.deployment_artifacts.service_principal.id`.

---

## 4. App Bundle Remaining Changes (not infra, but tracked here)

These are app-side changes that depend on infra decisions above:

| Item | File | Change |
|------|------|--------|
| Add `dev`/`prod` targets | `ground-truth-app/databricks.yml` | Replace `default` (localhost) target with `dev` + `prod` matching infra pattern |
| Enable `user_api_scopes` | `ground-truth-app/databricks.yml` | Uncomment and set: `sql`, `genie`, `files`, `model-serving` |
| Remove/comment `agents-skills` | `ground-truth-app/databricks.yml` | Optional resource — comment out until UC volume decided |
| Remove `agents_skills_path` var | `ground-truth-app/databricks.yml` | Goes with agents-skills removal |
| Remove placeholder values | `ground-truth-app/databricks.yml` | Target variable values replaced by deploy.sh `--var` passing |

---

## Execution Order

```
1. Declare MLflow experiment resource in infra           (new file)
2. Extend resolve_infra_vars() with new outputs          (edit deploy.sh)
3. Implement Phase 2 in deploy.sh                        (edit deploy.sh)
4. Update app databricks.yml targets + scopes            (edit app databricks.yml)
5. Deploy infra:  ./deploy.sh --target dev --infra
6. Install deps:  cd ground-truth-app && pnpm install
7. Deploy app:    ./deploy.sh --target dev --app
8. Verify MCP service creation in Unity Gateway
9. Delete deprecated infra MCP file
10. Update app_role identity with auto-provisioned SPN
```

---

## Decisions Summary

| # | Question | Recommendation | Impact if deferred |
|---|----------|----------------|--------------------|
| 1 | Agent skills volume | **(C) Defer** — comment out optional resource | None; local skills work |
| 2 | Job for app plugin | **(A) `freshness_resurfacing`** — pass via deploy.sh | N/A |
| 3 | Serving endpoint var | **(A) Hardcode in app target** | N/A |
| 4 | MLflow experiment path | `/Users/matthew.giglia@databricks.com/ground-truth-app-agents` | N/A |
