# Session 20: Deploy verification job — converge until all checks pass (Wave 8)

## Scope
Write a verification notebook and job resource that programmatically checks the running app’s endpoints, then deploy and run it until it passes. This automates the steps from `docs/runbooks/first-deploy-verification.md` that the runtime gate cannot check (MCP tool count, UI route responses, MCP service reachability).

## Context
* **App URL:** `https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com`
* **Auth pattern:** Databricks Apps auth sidecar rejects plain Bearer tokens and curl. All HTTP checks must use `WorkspaceClient().config.authenticate()` to build authenticated `requests.Session` headers.
* **MCP service:** `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp`, HTTP connection using OAUTH_M2M via SPN `semantic-ground-truth-m2m-dev`.
* **Expected checks:**
  1. `GET /health` returns 200.
  2. `GET /api/executive/summary` returns 200 (confirms API routes work).
  3. `POST /mcp` with `ListTools` request returns exactly 12 tools, all matching `review_*`, `campaign_*`, or `metric_view_*`.
  4. UI routes return 200: `/`, `/leaderboard`, `/steward`, `/admin`, `/executive`, `/assistant`.
  5. Lakebase tables exist: query `SELECT COUNT(*) FROM app.assets` via the app’s `/api/executive/summary` response (non-zero `totalAssets` after seed, or zero if seed hasn’t run).
  6. MCP service reachable: call the UC function `DESCRIBE FUNCTION hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp` or query the Unity Gateway endpoint.
* **Job naming:** `${var.app_display_name}-deploy-verification` (matches other jobs).

## Tasks
1. Create `src/notebooks/deploy_verification.ipynb`:
   * Cell 1: Install latest `databricks-sdk` + `requests`, restart Python.
   * Cell 2: Define widgets: `app_url` (string, default empty), `catalog` (string), `schema_name` (string), `mcp_service_name` (string).
   * Cell 3: Build authenticated `requests.Session` using `WorkspaceClient().config.authenticate()`.
   * Cell 4: Run all checks, collecting pass/fail for each. Assert all pass at the end.
   * Output a summary table of check results.
2. Create `resources/jobs/deploy_verification.job.yml`:
   * Resource key: `deploy_verification`.
   * Name: `${var.app_display_name}-deploy-verification`.
   * Parameters: `app_url`, `catalog`, `schema_name`, `mcp_service_name`.
   * Single task running the notebook.
3. Deploy: `bundle deploy --target dev`, then `bundle run deploy_verification --target dev`.
4. Read job run output. If checks fail, diagnose and fix the notebook or the app config.
5. Repeat until the verification job succeeds and the app remains stable.

## Acceptance Criteria
- [ ] `src/notebooks/deploy_verification.ipynb` exists and runs all 6 checks.
- [ ] `resources/jobs/deploy_verification.job.yml` exists with correct name pattern.
- [ ] Verification job has a successful run.
- [ ] App remains RUNNING after verification.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `src/notebooks/deploy_verification.ipynb`
- `resources/jobs/deploy_verification.job.yml`

## Dependencies
- Session 19 (app is stable and running, post-deploy job succeeded).
