# Session: 2026-10-08 — Infra Build Plan & Bundle Scaffold

**Date:** 2026-10-08
**Branch:** `mg-genie-bundle-scaffolds`
**Bundle:** `ground-truth-infra` (Bundle 1 of 3)

---

## Summary

Created the three-bundle DAB scaffold for the Semantic Ground Truth App and authored a comprehensive 8-phase build plan for the infra bundle.

## Problems / Questions Addressed

* No implementation existed — project was entirely in design/documentation phase
* 11 open questions from L300 specs needed resolution before building
* L300-01 proposed directory names (`bundle-*`) that didn't match bundle names
* Lakebase originally specified as manual CLI; needed to determine DAB-declarability
* Migrations originally scoped to infra; discovered lakeLoom pattern moves them to app

## Root Causes / Findings

* **Lakebase DAB support (Beta, Feb 2026):** `postgres_projects`, `postgres_branches`, `postgres_endpoints`, `postgres_databases`, `postgres_roles`, `postgres_synced_tables` are all DAB-declarable. Replaces manual CLI from L300-02. No `postgres_catalogs` (requires CREATE CATALOG on metastore) — using CDF via synced tables instead.
* **Migrations belong in app, not infra:** lakeLoom pattern — TypeScript migrations run on app server startup via AppKit Lakebase client. Infra creates the container (project, branches, endpoint); app fills it (tables, indexes, CDF setup).
* **`for_each_task` syntax:** `file_list()` doesn't exist. Must use upstream notebook + `taskValues`.
* **`genie_code_task`:** Available as Beta task type. No structured output — only a thread link.
* **Cross-bundle variables:** `deploy.sh` pattern with `bundle summary --output json` + `resolve_infra_vars()`.
* All 11 open questions resolved or closed (see build plan § Consolidated Open Questions).

## Changes Made

### Files Created (solution root)
* `PROJECT_MEMORY.md` — Solution-level project context
* `README.md` — Updated from one-liner to full architecture overview

### Files Created (ground-truth-infra/)
* `docs/plan/infra_build_plan.md` — 8-phase build plan with resource inventory, source file manifest, Lakebase DAB resources, all 11 open questions resolved, effort estimates, cross-bundle dependencies, target file tree
* `PROJECT_MEMORY.md` — Bundle-level project memory with Lakebase DAB research notes, deviations from L300 specs
* `fixtures/sessions/2026-10-08_infra-build-plan-and-scaffold.md` — This session summary
* `fixtures/sessions/INDEX.md` — Session index

### Bundles Scaffolded (via workspace GUI by user)
* `ground-truth-infra/` — Bundle 1 (Infra)
* `ground-truth-app/` — Bundle 2 (App)
* `ground-truth-agent/` — Bundle 3 (Agent)

Each with default `databricks.yml` (dev+prod targets), `README.md`, `.gitignore`.

## Decisions

1. **Directory naming:** `ground-truth-*` (matches bundle names) instead of L300-01's `bundle-*`
2. **Staging target deferred:** Only dev+prod scaffolded; add staging when needed
3. **Migrations moved to Bundle 2:** Follows lakeLoom pattern (TypeScript, app-side)
4. **No `postgres_catalogs`:** CDF via `postgres_synced_tables` only (avoids metastore-level permissions)
5. **`lakebase_project_id` replaced:** DAB substitution `${resources.postgres_projects.ground_truth_project.id}` instead of manual variable
6. **Synced table names configurable:** Not locked to `lb_<table>_history` convention

## Files Modified

* `README.md` (solution root) — expanded from one-liner
* No existing files modified in the infra bundle (all new)

## Next Steps

* Phase 1: Configure `databricks.yml` with variables, `resources/schemas.yml`
* Phase 2: Author `resources/lakebase.yml` with project, branches, endpoint, role, database, 6 synced tables
* Validate with `databricks bundle validate --strict --target dev`
