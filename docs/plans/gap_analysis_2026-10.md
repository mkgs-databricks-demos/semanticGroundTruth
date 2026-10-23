# Gap Analysis — Semantic Ground Truth (2026-10)

**Date:** 2026-10-23 · **Branch:** `mg-genie-ui-brand-and-gaps` (from `main` @ `fbc552b`) · **Target:** `dev`
**Baseline:** root build waves 0–5 merged (PR #6). Design sources: `docs/design/L100_*`, `L200-C1..C9`, `L300-01..16`, `docs/pitch/feature_readiness_compliance_matrix.md`.

Evidence was gathered live on 2026-10-23 (CLI, OTel tables, bronze CDF table, source greps). Each gap names the file(s) to change so the next build manifest (`docs/plans/waves.json`, sessions 16–24) can be scoped directly from this table.

## Status legend

* **Done** — implemented, deployed, verified on dev
* **Partial** — implemented but missing a designed capability, or not verified end-to-end
* **Gap** — designed, not implemented
* **Defer** — intentionally out of the next build (dependency on preview feature or customer input)

## 1. Live state verified this session

| Check | Result | Evidence |
| --- | --- | --- |
| App deploy (`bundle run app`, 2 deployments) | RUNNING, `listening on port 8000` | OTel logs 12:56:55Z and 13:00:41Z |
| Graceful shutdown (outgoing deployment ran new code) | `Shutdown complete` in 5 ms; no `App did not respect SIGTERM timeout`, no `[ELIFECYCLE]` | OTel logs 12:59:38Z |
| `deploy_verification` | 6/6 PASS (health, /api/me + admin role, campaigns, MCP initialize, server info) | job `359858966042356` run `92578084705794` |
| `agent_verification` | TERMINATED SUCCESS (notebook raises `AssertionError` on any failed check) | job `930756362224750` run `216767409892268` |
| Agent bundle deploy with infra-resolved vars | 3 resources unchanged | `bundle deploy --var catalog=… --var schema_name=… --var warehouse_id=…` |
| App error lines after start | 0 (`ERROR`/`FATAL` severity or `"level":"error"` body) | OTel logs ≥ 13:00:41Z |
| Bronze CDF coverage | 13 source tables; 71 assets, 85 campaign_assets, 11 votes, 2 campaigns | `bronze_lakebase_cdf`, last change 06:23 UTC |

## 2. Gap table

| # | Area (design ref) | Status | Finding | Evidence | Proposed fix | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | Secrets (L300-03) | **Gap (bug)** | App SPN has no READ on `semantic_ground_truth_credentials`. Every app start logs `[ERROR] error resolving resource m2m-client-id for env GT_BOOTSTRAP_ADMIN_IDS`. Root cause: `ground-truth-infra/resources/secrets/ground_truth_scope.secret_scope.yml` declares `permissions` (MANAGE for the owner only), which is authoritative, so every infra deploy deletes the READ ACL that `ground-truth-app/resources/app.app.yml` (`m2m-client-id` secret resource) granted. The app bundle reports "unchanged" because its state still thinks the grant exists. | `secrets list-acls` shows only `matthew.giglia@… MANAGE`; ERROR at 00:xx, 12:19, 12:56, 13:00 UTC | Add the app SPN READ to the infra scope permissions (resolved from the app name via a variable), or re-grant in `app_post_deploy_setup` after every deploy. Add a `deploy_verification` check that the scope ACL lists the app SPN. Will trip the new runtime gate (ERROR severity) until fixed. | P0 |
| G2 | Data plane freshness (L300-05) | **Gap** | `cdf_bronze` pipeline is `continuous: false` and no job triggers it, so metric views and the Genie agent only see data as of the last manual run. | `ground-truth-infra/resources/pipelines/cdf_bronze.pipeline.yml` L12; no `pipeline_task` under `ground-truth-infra/resources/jobs/`; bronze last change 06:23 UTC | Add a scheduled refresh job (hourly `pipeline_task`; metric views are views over bronze, so they need no redeploy) or switch to continuous in prod only. | P1 |
| G3 | C8 Executive Dashboard (L200-C8 resolved Q1) | **Gap** | Design resolved "AI/BI dashboard primary, React summary in app". No `dashboards:` resource in any bundle; `VITE_EXEC_DASHBOARD_URL` unset, so the Executive page shows "not configured". | `ground-truth-app/client/src/components/executive/DashboardLink.tsx`; no `*.dashboard.yml` | Add `ground-truth-infra/resources/dashboards/executive.dashboard.yml` + `.lvdash.json` over the 7 metric views; pass the dashboard URL to the app as a runtime config value (`/api/config`) instead of a Vite build-time variable. | P1 |
| G4 | C6 Feedback Pipeline (L200-C6, L300-06) | **Partial** | `create_feature_branch.py` starts a Genie conversation but never parses the reply (`proposed_yamls_by_asset = {}` placeholder) and never writes/commits YAML (`TODO` L142). Job uses notebook tasks, not the Genie Code task the design specifies. Schedule PAUSED in dev (expected for development mode). | `ground-truth-infra/src/notebooks/create_feature_branch.py` L100–145; job `811289891166091` | Replace task 2 with a `genie_task` (same pattern as the build-waves job) driven by a versioned skill; write proposed fixture YAML on a `feedback/<date>` branch and notify stewards. | P1 |
| G5 | C7 Notifications (L200-C7) | **Partial** | In-app notifications work (4 rows). Slack/Teams/webhook destinations exist in code but no webhook keys are provisioned, so external delivery is untested. | `ground-truth-app/server/services/notification/destinations/*`; scope keys = `m2m_client_id_dev`, `m2m_client_secret_dev`, `workspace_url` | Prefer Databricks notification destinations (by ID) over raw webhook secrets; add a smoke test that sends to a test destination. Needs admin to create the destination. | P2 |
| G6 | C3 Card UI (L200-C3) | **Partial** | Card stack, swipe, synonym chips, example questions, query preview, reject/edit sheets exist. Missing: side-by-side Logic View (plain English + SQL/YAML), steward `FeedbackQueue` / `ConflictResolver` / `BranchReview`. | `ground-truth-app/client/src/components/review/*`, `components/steward/*` | Add `LogicView` to `ReviewCard`; add steward triage tab (votes grouped by asset with conflicting edits). BranchReview depends on G4. | P2 |
| G7 | UI theme / brand | **Gap (bug)** | Light/dark toggle is a no-op: `AppLayout.tsx` calls `next-themes` `useTheme()` but no `ThemeProvider` wraps the app (`main.tsx`, `App.tsx`). `index.css` brand tokens are all commented out (stock AppKit palette), page title is `ground-truth-app`, AppKit default favicon, no DM Sans/DM Mono. | `client/src/main.tsx`, `client/src/index.css`, `client/index.html`, `client/public/*` | See `docs/plans/ui_brand_plan.md`. | P1 |
| G8 | Accessibility (L200-C3 NFR WCAG 2.1 AA) | **Partial** | 12 hard-coded Tailwind palette classes in `SwipeActions.tsx` (+4 elsewhere) bypass tokens; no automated contrast/axe check; reduced motion honoured only in `CardStack.tsx`. | grep of `client/src/components` | Token migration + contrast unit test + global reduced-motion rule (ui_brand_plan §7). | P1 |
| G9 | MCP Apps card (C4, matrix #18) | **Partial** | `server/mcp/views/cardHtml.ts` renders a branded card (Lava/Navy hex inline). Genie One rendering not verified (MCP Apps is pre-private preview, not in HIPAA table). | `server/mcp/views/cardHtml.ts` | Align card HTML with brand tokens (light + dark); manual Genie One check when the preview is enabled. | P2 / Defer |
| G10 | Infra scaffolds (L300-07) | **Partial (cleanup)** | `setup_gateway_connection.py` and `setup_app_role_sp.py` still `raise NotImplementedError` but remain wired into `post_deploy_setup` behind condition tasks. Both are superseded (MCP connection = app `create_mcp_connection` job; Lakebase role = AppKit `CAN_CONNECT_AND_CREATE`). Superseded empty secret YAMLs also remain. | `ground-truth-infra/resources/jobs/post_deploy_setup.job.yml` L157–200; `resources/secrets/{git_token,slack_webhook,teams_webhook}.secret.yml` | Remove the two tasks and the three empty YAMLs (needs approval — deletes). | P2 |
| G11 | Lakehouse Monitoring (matrix #32) | **Gap** | No quality monitor on CDF/bronze tables (vote-gaming anomaly detection). | no `quality_monitors:` resource | Add a data-quality monitor on `bronze_lakebase_cdf` (prod only) once vote volume justifies it. | P3 / Defer |
| G12 | UC Pages / Domains import (C1) | **Partial** | `ASSET_TYPES` include `page`/`domain`/`subdomain`, but import only reads Git folder metric-view YAML + glossary markdown (`SOURCE_TYPES = ['git_folder']`). No import from UC Discover pages/domains. | `shared/contracts/values.ts` L4, L70; `server/services/sources/sourceService.ts` | Add a `uc_discover` source type when a public API is available; until then glossary markdown is the path. | P3 / Defer |
| G13 | Build tooling | **Partial** | Build job `1079028753739581` defaults `branch` to deleted `mg-genie-agent-build`. A second job set (`551874922778444` build, `818046072228128`/`468323402073052` setup, two smoke tests) also exists. | `jobs get 1079028753739581`; `jobs list` | Point the default at `mg-genie-ui-brand-and-gaps` (Jobs page). Confirm which job set is canonical before removing the other. | P1 |
| G14 | Runtime gate coverage | **Done this session** | Structured `"level":"error"` lines were not counted by the gate (severity UNKNOWN). | `docs/plans/waves.json` app telemetry | Added pattern; 5xx request logs now log at `error`. | — |
| G15 | SIGTERM handling | **Done this session** | AppKit lifecycle started but the process outlived the 15 s budget behind the `pnpm` wrapper. | OTel 12:55:55Z vs 12:59:38Z | `server/lib/shutdown.ts`, `app.yaml` runs `node` directly. | — |
| G16 | `deploy.sh --agent` | **Done this session** | Phase 3 was a stub. | `deploy.sh` Phase 3 | Deploys `ground-truth-agent` with infra-resolved vars; `--verify` runs verification jobs. | — |
| G17 | Tests | **Partial** | 17 vitest files are written but have never run in CI (no Node toolchain on the build compute; `npm` unavailable on serverless). The Apps build does run `tsc -b`, so type errors are caught. | `ground-truth-app/**/*.test.ts` | Add a `vitest` task to `deploy_verification` or run tests in the Apps build (`prebuild`). | P2 |

## 3. Not gaps (confirmed working, out of scope)

* RBAC from Lakebase app groups (3 groups, 2 members), bootstrap admin, `/api/me` roles — verified by `deploy_verification`.
* Lakebase CDF → variant bronze (SDP) → 7 metric views → Genie space `Ground Truth Operations` — verified by `agent_verification`.
* MCP Streamable HTTP endpoint + Unity Gateway MCP service + M2M probe — verified by `deploy_verification`.
* OTel logs/metrics/spans to UC — queried directly this session.

## 4. Recommended next-build scope

Wave 0 (edit, parallel): brand foundation (16; G7/G8), infra secret ACL + bronze refresh job (18; G1/G2), MCP card brand (19; G9), runtime config + ACL safety net + verification + vitest in build (20; G1/G3/G17), executive dashboard (21; G3).
Wave 1 (edit): component token migration, a11y, Logic View, dashboard link (17; G6/G7/G8).
Wave 2 (converge): infra first, so the app SPN regains scope READ before the app gate runs (22), plus an `agent_verification` regression run.
Wave 3 (converge): app with the new error gate (23).
Wave 4: docs, project memory, gap status (24).
Outside the manifest: G13 job default (Jobs page handoff).
Deferred: G4 Genie Code task (needs skill design review), G5 destinations (admin action), G10 deletions (approval), G11, G12.

See `docs/plans/waves.json` (next build draft) and `docs/plans/16_*.md` … `24_*.md`.
