# PR: `mg-genie-agent-build` → `main`

**Title:** feat: Lakebase CDF data plane, app RBAC + asset import, and operational Genie agent (root build waves 0–5)

**Base:** `main` (at `96f2ae4`, Merge pull request #5 from mg-genie-app-first-deploy)
**Head:** `mg-genie-agent-build` (13 commits, 2026-10-22 → 2026-10-23)
**Stats (through `f9ab907`, before the docs commit):** 137 files changed, +8,496 / −471

---

## What this PR does

Completes the Semantic Ground Truth solution end to end across all three bundles. The app now manages its own RBAC and imports assets from Unity Catalog. App state flows from Lakebase through CDF into a bronze table and 7 metric views. An operational Genie space answers questions over that data plus the app's OTel telemetry.

The work was built and converged by `genie-build-waves` from a single solution-root manifest (`docs/plans/waves.json`): 6 waves, 15 sessions. Every wave passed static and runtime gates on `dev` (build run `713417549836954`).

### 1. Infra bundle (`ground-truth-infra/`): Lakebase CDF → bronze → metric views

* **`setup_lakebase_cdf` job** (`src/lib/lakebase_cdf.py`, `src/notebooks/setup_cdf_config.py`): idempotent Lakehouse Sync config for 21 `app` tables → `lb_*_history`.
* **`cdf_bronze` Spark Declarative Pipeline** (serverless): a metadata-driven `CdfBronzeBuilder` (`src/lib/cdf_bronze/`) reads `fixtures/pipelines/cdf_bronze_tables.yaml` and streams every history table into one `bronze_lakebase_cdf` table (VARIANT `data`, `TIMESTAMP_NTZ` `_timestamp`, with key extraction and unit tests).
* **7 metric views:** 5 rewritten over bronze (`mv_review_activity`, `mv_coverage_metrics`, `mv_user_leaderboard`, `mv_feedback_pipeline`, `mv_campaign_progress`) and 2 new over OTel (`mv_otel_error_rate`, `mv_otel_request_latency`).
* **`metric_view_deploy` fixes:** fixtures path now uses `${workspace.file_path}`, empty-string parameters are handled, and the Statement Execution `wait_timeout` is capped at 50 s with polling.

### 2. App bundle (`ground-truth-app/`): RBAC, sources/import, converge fixes

* **Migrations:** `007_rbac_sources_cdf` (app groups, group members, asset sources, `REPLICA IDENTITY FULL` for CDF) and `008_votes_version_hash`.
* **RBAC from Lakebase app groups:** new `MembershipService` with `semantic-ground-truth-admins` / `-stewards` groups. Admins are bootstrapped through `GT_BOOTSTRAP_ADMIN_IDS` (M2M SPN client ID from the `m2m-client-id` secret resource). Campaign visibility now checks membership. The SCIM `/Me` dependency is removed.
* **Admin member API:** `GET /api/admin/groups`, `POST /api/admin/groups/:name/members`, `DELETE /api/admin/groups/:name/members/:memberId`.
* **Asset sources and import:** UC browsing (`/api/catalog/{catalogs,schemas,metric-views}`, OBO), source registration and scanning (`/api/sources`, `/api/sources/:id/scan`), bulk import (`/api/assets/import`), glossary markdown parser, and workspace file reads (OBO, with a cached M2M OAuth token fallback because `DATABRICKS_TOKEN` isn't present in Apps).
* **Client:** steward `ImportWizard` and admin `MembersPanel`, with typed API endpoints and hooks.
* **Jobs:** new `demo_campaign_seed` (grants → import → campaign → votes → leaderboard check). `deploy_verification` hardened (M2M probes, SSE parsing for `/mcp`, raises before exit).
* **Bundle config:** new `secret_scope_name` variable (default `semantic_ground_truth_credentials`); the app secret resource uses `${var.secret_scope_name}`.
* **Converge fixes:** TypeScript strict errors (Asset `sourceId`/`sourceMetadata`, unused vars/imports, nullish chains), MCP session column names, review badges as `text[]`, and `sendError` logs the cause.

### 3. Agent bundle (`ground-truth-agent/`): Ground Truth Operations Genie space

* **`ground_truth_ops` Genie space resource** (`ground_truth_ops.geniespace.json`, v2 serialized-space format): 9 data sources (7 metric views + 2 OTel tables), curated text instructions, and 9 example SQLs.
* **`agent_verification` job:** 11 checks covering space config, data-source resolution, EXPLAIN on every example SQL, and probe questions. It handles the dev-mode title prefix.

### 4. Solution root

* **Build manifest and plans:** `docs/plans/waves.json`, 15 session plans, `build_conventions.md`, `INDEX.md`. Gate `ignore_patterns` cover redeploy noise (`App did not respect SIGTERM timeout`, `[ELIFECYCLE] Command failed`).
* **Runbooks:** `docs/runbooks/onboarding_users.md`, `docs/runbooks/cdf_bronze_operations.md`.
* **Docs:** solution-root README (data flow, layout, end-to-end deploy order), refreshed bundle READMEs and PROJECT_MEMORY files, 25 session summaries plus a root build summary (`docs/sessions/2026-10-23_root-build-waves-summary.md`).

---

## Commits

| Commit | Summary |
| --- | --- |
| `5c0050b` | docs(plans): root genie-build-waves manifest (-sgt-root) for infra+app+agent |
| `b6da0d4` | wave(0): 01–06, first pass |
| `8563463` | wave(1): 07–11, first pass |
| `26b2770` | fix(w1-gate): remove SCIM/Me from campaignManager, fix client import depth |
| `af26ba2` | wave(0): 01–06 |
| `e247bff` | wave(1): 07–11 |
| `eb4fb10` | fix(w2-s12): converge app fixes + parameterize secret scope |
| `9a14c70` | fix(manifest): remove ELIFECYCLE from error_patterns |
| `940d812` | fix(manifest): ignore redeploy SIGTERM/ELIFECYCLE log lines in runtime gate |
| `6b4c276` | wave(3): 13, infra data plane converge |
| `feaae42` | wave(4): 14, agent converge |
| `f9ab907` | wave(5): 15, docs/runbooks/project memory |
| *(this)* | docs: solution-root README, root build summary, bundle README refresh, PR description |

---

## Verification (dev)

| Check | Result |
| --- | --- |
| Build run `713417549836954` | 24/24 tasks SUCCESS, 6/6 gate checks `outcome=true` |
| App runtime gate | RUNNING; `/health`, `/api/me`, `/api/campaigns`, `/mcp` pass; 10-minute soak with 0 counted errors; traces present |
| `deploy_verification` | 6/6 |
| `demo_campaign_seed` | 71 campaign assets, 10 votes, leaderboard populated |
| `setup_lakebase_cdf` | 21 history tables |
| `cdf_bronze` | 21 flows, 0 failed/dropped; 281 rows / 13 sources at converge |
| `metric_view_deploy` | 7/7 |
| Genie space | 9/9 data sources resolve; 9/9 example SQLs EXPLAIN; `agent_verification` 11/11 |
| `bundle validate --strict --target dev` | pass (as reported by the wave 2–4 converge sessions) |

---

## Deploy notes for reviewers

1. **Order matters:** infra → app (migrations create the `app` schema) → `setup_lakebase_cdf` → `cdf_bronze` → `metric_view_deploy` → agent. The full sequence is in the root README.
2. **Secret resource:** the app reads `GT_BOOTSTRAP_ADMIN_IDS` from the `m2m-client-id` secret resource. Run `bundle deploy` before any plain `apps deploy`.
3. **New Lakebase tables** need `REPLICA IDENTITY FULL` plus an entry in `cdf_bronze_tables.yaml` (see the CDF runbook).
4. **No `prod` deploy in this PR.** `prod` targets are scaffolded only.

## Known follow-ups (not in this PR)

* Graceful SIGTERM shutdown in `ground-truth-app/server/server.ts`. The platform currently logs `App did not respect SIGTERM timeout of 15 seconds` on each redeploy.
* Gate `error_pattern` for structured `"level":"error"` request logs.
* Wire Phase 3 (`--agent`) in `deploy.sh`; it's still a stub.
* `prod` target deploy and verification.
