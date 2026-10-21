# First Deploy Verification Runbook

Step-by-step checklist for the **interactive controller session** after the Genie Build Waves code build completes. Run these from a Genie Code session or notebook with access to the Databricks CLI and workspace.

> **Prerequisite:** [ground-truth-infra](../../ground-truth-infra/) is deployed to the target. The infra bundle provides the Lakebase project, UC schema, SQL warehouse, secret scope, and jobs.

---

## 1. Regenerate the lockfile

Session 02 added `@modelcontextprotocol/sdk`, `@tanstack/react-query`, and `framer-motion` to `package.json` but could not regenerate `pnpm-lock.yaml` (no Node toolchain in build sessions).

**Option A** — Standalone pnpm on controller compute (preferred):

```bash
# From the ground-truth-app directory
npx pnpm@11 install --no-frozen-lockfile
```

**Option B** — Let the Databricks Apps build resolve it:

Skip this step and proceed to step 3. The Apps build container runs `pnpm install` automatically. If a lockfile mismatch causes a build error, return here and use Option A.

**Expected result:** `pnpm-lock.yaml` is regenerated without errors. New dependencies are resolved and locked.

---

## 2. Typecheck and test (if toolchain available)

```bash
pnpm run typecheck   # tsc -b (strict mode, all three tsconfig projects)
pnpm test            # vitest (7 test files from session 15)
```

If no Node toolchain is available, skip this step and rely on the Apps build log in step 3 for TypeScript errors. Record this step as skipped.

**Expected result:** Zero type errors from `tsc -b`. All 7 vitest test suites pass (contracts, errors, versionHash, parseMetricViewYaml, roles, migrations, toolNames).

---

## 3. Deploy and fix forward

```bash
# From the monorepo root:
./deploy.sh --target dev --app

# Or directly from ground-truth-app:
databricks bundle deploy --target dev
databricks bundle run app --target dev
```

Monitor the build log for TypeScript errors:

```bash
databricks apps logs dev-semantic-ground-truth --follow
```

Look for `error TS\d+` lines. The Apps build runs `pnpm run build` which invokes `tsc -b` and `tsdown`. Fix any type errors in the source, commit, and redeploy. Repeat until the build succeeds.

**Expected result:** App deployment reaches `RUNNING` state. `databricks apps get dev-semantic-ground-truth` shows `app_status: RUNNING`, `active_deployment.status: SUCCEEDED`.

---

## 4. Verify migrations

Check the app startup logs for migration output:

```bash
databricks apps logs dev-semantic-ground-truth | grep -i migration
```

The custom migration runner applies migrations 001–006 idempotently on each startup. Confirm all six are reported.

Verify the Lakebase tables exist (from a notebook or SQL console connected to the Lakebase endpoint):

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'app'
ORDER BY table_name;
```

**Expected result:** Logs show 6 migrations applied (001–006). The `app` schema contains at minimum: `_migrations`, `app_config`, `assets`, `asset_versions`, `campaign_assets`, `campaigns`, `confidence_scores`, `example_questions`, `mcp_sessions`, `notification_preferences`, `notifications`, `synonyms`, `user_activity`, `votes`.

---

## 5. Health check

Authenticated request from a Databricks notebook (plain curl/Bearer fails due to the Apps auth sidecar):

```python
from databricks.sdk import WorkspaceClient
import requests

w = WorkspaceClient()
app = w.apps.get('dev-semantic-ground-truth')
base_url = app.url.rstrip('/')

headers = {}
w.config.authenticate(headers)
resp = requests.get(f'{base_url}/health', headers=headers)
print(resp.status_code, resp.json())
```

**Expected result:** HTTP 200. Response body: `{ "status": "ok", "migrations": 6 }` (or the current migration count).

---

## 6. Seed sample assets

For the first run, set the `SEED_SAMPLE_ASSETS` environment variable to trigger the dev seed:

1. In `app.yaml`, temporarily add `- name: SEED_SAMPLE_ASSETS` / `value: "true"`, redeploy, then remove it. Or:
2. Register assets manually via the API:

```python
resp = requests.post(
    f'{base_url}/api/assets/register',
    headers=headers,
    json={'name': 'test_metric', 'asset_type': 'metric_view', 'definition': 'Test metric definition', 'logic': 'SELECT 1'}
)
print(resp.status_code, resp.json())
```

Confirm the review endpoint returns a card:

```python
resp = requests.get(f'{base_url}/api/review/next', headers=headers)
print(resp.status_code, resp.json())
```

**Expected result:** `POST /api/assets/register` returns 200/201 with the asset. `GET /api/review/next` returns a `ReviewCard` object (not null).

---

## 7. Vote round-trip

Open the app in a browser and complete a vote from the card UI (approve, reject, or edit). Then verify the data was written:

```sql
-- In Lakebase (app schema)
SELECT * FROM app.votes ORDER BY created_at DESC LIMIT 5;
SELECT * FROM app.confidence_scores ORDER BY updated_at DESC LIMIT 5;
SELECT * FROM app.user_activity ORDER BY created_at DESC LIMIT 5;
```

**Expected result:** A row appears in `app.votes` with the correct `vote_type`, `reviewer_id`, and `source = 'web'`. A corresponding `confidence_scores` row is updated. A `user_activity` row records the action.

---

## 8. MCP verification

List the available MCP tools through the Unity Gateway MCP service:

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
result = w.serving_endpoints.query(
    name='system.ai_gateway.mcp',
    input={'action': 'tools/list'},
    extra_params={'mcp_service': 'hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp'}
)
print(result)
```

Call one tool:

```python
result = w.serving_endpoints.query(
    name='system.ai_gateway.mcp',
    input={'action': 'tools/call', 'tool': 'review_get_next', 'tool_input': {}},
    extra_params={'mcp_service': 'hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp'}
)
print(result)
```

Check which identity the MCP vote is attributed to (M2M SPN vs. forwarded user). Record the result — this validates design decision 4 from `build_conventions.md` §4.

**Expected result:** `tools/list` returns exactly 12 tools: 6 `review_*`, 3 `campaign_*`, 3 `metric_view_*`. `review_get_next` returns a review card (or empty if no assets are seeded). Identity attribution is recorded for post-deploy decision tracking.

---

## 9. OBO metric view access

Test metric view reads from both surfaces:

**From the UI (OBO token available):**
Navigate to the Steward page > Metric Views tab. The list should load metric views from the configured catalog/schema.

**Via MCP (expected limitation):**

```python
result = w.serving_endpoints.query(
    name='system.ai_gateway.mcp',
    input={'action': 'tools/call', 'tool': 'metric_view_list', 'tool_input': {}},
    extra_params={'mcp_service': 'hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp'}
)
print(result)
```

**Expected result:** UI metric view list loads successfully (OBO token forwarded by the Apps proxy). MCP `metric_view_list` may return a `FORBIDDEN` tool error if the M2M gateway does not forward an OBO token — this is the expected limitation. Record which behavior is observed.

---

## 10. Agent verification

Navigate to `/assistant` in the app. Send a message like:

> "What assets have the lowest confidence scores?"

The `review-assistant` (default markdown agent) should delegate the lookup to `review-worker`, which calls `get_coverage_summary` or `search_assets`.

**Expected result:** The agent responds with data from the review system. The MLflow experiment (`app_agents_experiment`) shows a new trace for the conversation.

---

## 11. Telemetry verification

Query the OpenTelemetry tables for signals from this session:

```sql
-- Logs
SELECT timestamp, severity_text, body
FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_logs
WHERE timestamp > current_timestamp() - INTERVAL 1 HOUR
ORDER BY timestamp DESC
LIMIT 20;

-- Spans
SELECT start_time, name, status_code, attributes
FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_spans
WHERE start_time > current_timestamp() - INTERVAL 1 HOUR
ORDER BY start_time DESC
LIMIT 20;
```

**Expected result:** Both tables contain rows from the current deployment. Logs include startup, migration, and request entries. Spans include HTTP request traces. `OTEL_TRACES_SAMPLER=always_on` ensures no spans are dropped.

---

## 12. Follow-ups

These items are known limitations from the build and should be tracked for post-deploy work:

1. **Infra metric-view column drift** — The infra bundle's metric views reference column names (`reviewer_id`, `comment`, `asset_count`, `processing_time_seconds`, `SUCCESS`) that may not match the app's Lakebase schema. Align in a follow-up infra PR.
2. **`@opentelemetry/api` dependency** — Session 04 (middleware) sets OTel span attributes via `trace.getActiveSpan()`. If `@opentelemetry/api` is not installed as a direct dependency, these calls are no-ops. Add the dependency if OTel attributes are missing from spans.
3. **Slack/Teams notification secrets** — `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, and `GENERIC_WEBHOOK_URL` are not configured by default. Add them to UC Secrets and `app.yaml` when notification destinations are needed.
4. **`create_mcp_connection` deploy hook wiring** — The `create_mcp_connection` job creates/patches the HTTP connection for the MCP service. Verify it runs automatically on deploy; if not, trigger it manually after the first deploy.
5. **RBAC group fail-open** — Campaign RBAC uses a fail-open pattern (campaigns with no `rbac_groups` are visible to all). Review whether this is acceptable for production or if a fail-closed default is needed.
6. **Agent tool caller identity** — AppKit V1 agent tools do not receive caller identity. The `review-worker` agent's `get_campaigns` tool bypasses `CampaignManager.list()` and queries directly with a public-only filter. Revisit when AppKit V2 provides user context to tools.
7. **`pnpm-lock.yaml` maintenance** — After the initial lockfile regeneration, commit `pnpm-lock.yaml` and keep it in sync with `package.json` changes.
8. **zod v4 / `@modelcontextprotocol/sdk` peer compatibility** — The MCP SDK may expect zod v3. If the build fails on zod type mismatches, add a `pnpm.overrides` entry or downgrade to the compatible version.

**Expected result:** All 8 items are captured in a tracking system (issues, project board, or follow-up session plan). No item blocks the app from running — they are enhancements and hardening for production readiness.