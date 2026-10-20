# Session 16: App README + First-Deploy Verification Runbook (Wave 5)

## Scope
Rewrite the app `README.md` for the Ground Truth app as built, and write `docs/runbooks/first-deploy-verification.md` — the step-by-step checklist the **interactive controller session** follows after the build: regenerate the lockfile, deploy, verify each subsystem, and fix forward. Documentation only; no code changes.

## Context
* All session summaries in `docs/sessions/` for waves 0-4 (exports, assumptions, requests). `docs/plans/build_conventions.md` (decisions, risks). `PROJECT_MEMORY.md` and `../PROJECT_MEMORY.md` (deployed resources, URLs, known gotchas) — read only; do not edit.
* Deployed resources: app `dev-semantic-ground-truth`, MCP service `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic-ground-truth-mcp`, HTTP connection of the same name, M2M SPN `semantic-ground-truth-m2m-dev`, jobs `app_post_deploy_setup`, `run_app_post_deploy`, `create_mcp_connection`.
* Platform facts: authenticated app traffic must go through a notebook using `WorkspaceClient().config.authenticate()` headers (curl/plain Bearer fails); `bundle summary` does not show the app URL (`databricks apps get`).

## Tasks
1. `README.md` — overview, architecture diagram (mermaid: client -> AppKit server -> Lakebase / SQL warehouse / Unity Gateway MCP), directory map (from conventions §6), REST route table (link to plan 09), MCP tool list, roles and how to grant them (`GT_ADMIN_EMAILS` / `app_config`), env vars (`DEV_USER_EMAIL`, `SEED_SAMPLE_ASSETS`, `GT_METRIC_VIEW_CATALOG`, `GT_METRIC_VIEW_SCHEMA`, webhook URLs, `VITE_EXEC_DASHBOARD_URL`), local dev, deploy. Preserve any existing README sections about bundle variables/targets that still apply.
2. `docs/runbooks/first-deploy-verification.md` — numbered checklist with the exact command or notebook snippet and the expected result for each step:
   1. Regenerate `pnpm-lock.yaml` (options: install pnpm standalone on controller compute vs. let the Apps build resolve; record which worked).
   2. `pnpm run typecheck` / `pnpm test` if a toolchain is available; else rely on the Apps build log.
   3. `databricks bundle deploy --target dev`; read the app build logs (`databricks apps logs`) for `tsc` errors; fix-forward loop.
   4. Migrations: app logs show `001`-`006` applied; verify tables via Lakebase SQL (`\dt app.*`).
   5. `GET /health` (authenticated notebook request) -> `status: ok`, `migrations: 6`.
   6. Seed: set `SEED_SAMPLE_ASSETS=true` for the first run (or register via `POST /api/assets/register`) and confirm `/api/review/next` returns a card.
   7. Vote round-trip from the UI; confirm `app.votes`, `app.confidence_scores`, `app.user_activity` rows.
   8. MCP: `tools/list` via the Unity Gateway MCP service lists exactly the 12 tools; call `review_get_next`; check which identity the vote is attributed to (decision 4) and record the result.
   9. OBO: `metric_view_list` from the UI (works) and via MCP (expected limitation if no OBO token) — record.
   10. Agents: `/assistant` chat calls `review-worker` tools.
   11. Telemetry: rows in `semantic_ground_truth_otel_logs` / `_spans` for the session.
   12. Follow-ups list: infra metric-view column drift, `@opentelemetry/api` dependency, Slack/Teams secrets, `create_mcp_connection` deploy hook wiring, RBAC group fail-open.
3. Add a link to the runbook from `README.md`.

## Acceptance Criteria
- [ ] Both files exist; every env var and route mentioned exists in the code (verify by reading the session summaries / source).
- [ ] Runbook steps each have an expected result.
- [ ] No code files changed.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `README.md`
- `docs/runbooks/**`

## Dependencies
- Waves 0-4. Parallel with 15.
