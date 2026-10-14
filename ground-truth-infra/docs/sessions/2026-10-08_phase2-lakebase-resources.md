# Session Summary: Phase 2 — Lakebase Project + Schema

**Date:** 2026-10-08 20:27  
**Branch:** mg-genie-bundle-scaffolds  
**Phase:** 2 of 8  
**Status:** Complete ✅

---

## What Was Done

### Files Created
- **`resources/lakebase.yml`** — Lakebase Autoscaling project, branches, role, and database as DAB resources.

---

## Changes Detail

### Resources Declared

| Resource | Type | Key | Notes |
|----------|------|-----|-------|
| `ground_truth_project` | `postgres_projects` | Per-target `project_id` | 17, 7-day retention, prevent_destroy |
| `production` | `postgres_branches` | `branch_id: production` | `replace_existing: true` adopts auto-created branch |
| `dev_branch` | `postgres_branches` | `branch_id: dev` | Copy-on-write from production, no_expiry |
| `app_role` | `postgres_roles` | `role_id: app-role` | Plain Postgres role (no identity_type) |
| `app_db` | `postgres_databases` | `database_id: ground-truth-app` | Owned by app_role |

### Per-Target Project IDs

| Target | `project_id` | `max_cu` |
|--------|-------------|----------|
| `dev` | `dev-matthew-giglia-ground-truth` | 2 |
| `prod` | `ground-truth` | 4 |

---

## Key Findings

### 1. Exact Field Names from Bundle Schema

- `postgres_branches` parent field is `parent` (format: `projects/{project_id}`), NOT `project_id`
- `postgres_databases` parent: `parent` (format: `projects/{project_id}/branches/{branch_id}`)
- `postgres_roles` parent: `parent` (same format as database)
- `postgres_roles` requires `role_id` (resource identifier) AND `postgres_role` (Postgres role name)
- `replace_existing: true` on a branch adopts the auto-created production branch without recreating it
- Substitution `.name` gives the full resource path; `.id` gives just the ID component

### 2. CDF Direction Correction

**Plan error identified:** The plan listed `postgres_synced_tables` for Lakebase → Delta CDF tables.

**Finding:** `postgres_synced_tables` in DABs is Reverse ETL (Delta → Lakebase), NOT the CDF direction.

**Impact:** The 6 CDF Delta tables (`lb_assets_history`, `lb_votes_history`, etc.) needed by metric views
cannot be created via `postgres_synced_tables`. Options:
1. **`postgres_catalogs`** (UC catalog binding) — avoided; requires CREATE CATALOG permission on metastore
2. **Manual Lakebase App UI** — Enable Lakehouse Sync for each source table after app deploys (**this is the approach, matching lakeLoom pattern**)

**Action item:** After Bundle 2 first deploy, enable Lakehouse Sync in Lakebase App UI for:
`assets`, `votes`, `user_activity`, `confidence_scores`, `campaigns`, `feedback_batches`.
This creates `lb_*_history` Delta tables in `${var.catalog}.${var.schema}` for metric views.

---

## Validation

```
databricks bundle validate --strict --target dev
→ Validation OK!
```

First attempt failed: `required field "role_id" is not set` on `postgres_roles.app_role`.
Fix: Added `role_id: app-role` to the role definition. Schema confirmed `role_id` is required.

---

## Files Modified

| File | Action |
|------|--------|
| `resources/lakebase.yml` | Created — Lakebase project, branches, role, database |
| `fixtures/sessions/2026-10-08_phase2-lakebase-resources.md` | Created — this file |
