# Session 24 — Project memory, READMEs, gap status, theming runbook

**Wave 6 · edit · run 745271774924215 · 2026-10-24 · branch `mg-genie-ui-brand-and-gaps`**

## Scope

Update root and bundle PROJECT_MEMORY/README files, mark gap statuses in `gap_analysis_2026-10.md`, add `docs/runbooks/ui_theming.md` (token table, how to add a component, contrast test). Docs only. No code or YAML.

## Sources used

Summaries for sessions 16, 17, 18, 19, 20, 21, 22a, 22b, 22c and 23; `.build-status/745271774924215/wave_2_gate.json` and `wave_5_gate.json`; `git show fa6d9d2 9921f96`; `ui_brand_plan.md`; live reads of `tokens.ts`, `index.css`, `contrast.test.ts`, `a11y-static.test.ts`, `vitest.config.ts`, `package.json`, `deploy.sh`, `resources/app.app.yml`, `cdf_bronze_refresh.job.yml`, both `databricks.yml` files, `DashboardLink.tsx`, `EmptyState.tsx`, `client/public/brand/*` and migration `001_core_schema.ts`.

## Changes

| File | Change |
| --- | --- |
| `docs/plans/gap_analysis_2026-10.md` | Update note at the top. New §5 "Status after build (run 745271774924215)": G1, G2, G3, G8, G9 (code), G17 **Done**; G6, G7 **Partial**, each with evidence (job/run/deployment ids, gate files) and what remains. New follow-ups: `skip` not allowed by the `votes.vote_type` CHECK, `Asset.synonyms` has no column. §2 baseline left as it was. |
| `docs/runbooks/ui_theming.md` | **New.** Where the tokens live, semantic token table, decision D1, how to add a component or token, the three tests and where they run, brand asset sources and what is still a placeholder, manual post-deploy checks. |
| `PROJECT_MEMORY.md` | Status log entry dated 2026-10-24 for this build. |
| `README.md` | deploy.sh `--agent --verify` (no longer a stub), new "What deploy.sh wires between bundles" (app SPN → scope ACL, dashboard URL → app, bronze refresh), UI theme pointer, runbook/plan links, build manifest description, current status per bundle, follow-ups. |
| `ground-truth-infra/PROJECT_MEMORY.md` | `cdf_bronze_refresh` job, secret scope (authoritative `permissions` + app SPN READ), executive dashboard, `app_service_principal_id` variable, status log entry. |
| `ground-truth-infra/README.md` | Resource table (refresh job, dashboard, secret scope), scope ACL note, bronze refresh and dashboard sections, build-plan pointers, project structure. |
| `ground-truth-app/README.md` | `GET /api/config` route, `GT_EXEC_DASHBOARD_URL` replaces `VITE_EXEC_DASHBOARD_URL`, `exec_dashboard_url` variable, scope READ note, updated job descriptions, dashboard-link deploy note, vitest in the Apps build, new "UI Theme and Accessibility" section. |
| `ground-truth-app/PROJECT_MEMORY.md` | `exec_dashboard_url` variable row, status log entry, deploy findings 9–11 (`app.yaml` has no `${var.*}`, vitest `.venv` exclude, infra owns scope READ). |

## Decisions

* **G7 is Partial, not Done.** The toggle bug, tokens, fonts and title are fixed. But `client/public/brand/databricks-symbol-*.svg` are placeholders, the favicons are still the AppKit template, and `EmptyState.tsx` still uses a lucide icon instead of the Databricks primary icons. I checked the files directly.
* **G3 is Done, with a caveat.** The dashboard and `/api/config` were verified live (22b, 23). The probe passed while the URL was hard-coded in `app.yaml`. `fa6d9d2` moved it to `config.env` after the stable deployment, so the docs ask for a re-check on the next `deploy.sh --app`.
* **G9 is Done for the code.** The Genie One rendering check stays deferred (MCP Apps preview).
* **Manifest vs. runner guardrail.** The runner's read-only list includes `PROJECT_MEMORY.md` and `docs/plans/**`. This session's manifest `owned_paths` and `scope` name `PROJECT_MEMORY.md` and `docs/plans/gap_analysis_2026-10.md` explicitly. I followed the manifest (scope wins) and edited only those plan-dir and memory files, nothing else under `docs/plans/`.

## Checks

| Check | Result |
| --- | --- |
| Gate: `gap_analysis_2026-10.md` marks G1, G2, G3, G6, G7, G8, G9, G17 with new status | pass (§5 table, awk/grep listed all 8 with status) |
| Gate: `PROJECT_MEMORY.md` has a status log entry dated in this build | pass (`2026-10-24` row) |
| `git status`: only files under `owned_paths` changed | pass (7 modified + 1 new, all owned) |
| Markdown tables have consistent column counts (8 files) | pass (script) |
| Relative `.md` links resolve (8 files) | pass (script) |
| Facts cross-checked against source (deploy.sh dashboard/SPN logic, `config.env`, refresh cron, CHECK constraint, DashboardLink text, placeholder SVGs) | pass |
| `bundle validate --strict` | skipped (no YAML changed) |

## Requests

None for other sessions. Owner follow-ups are in the docs: replace placeholder brand SVGs and favicons, re-check `/api/config` after the next app deploy, manual Lighthouse/keyboard/toggle checks, a `skip` vote migration if needed.
