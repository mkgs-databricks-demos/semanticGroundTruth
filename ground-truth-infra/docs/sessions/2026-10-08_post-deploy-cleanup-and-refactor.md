# Session Summary: Post-Deploy Cleanup and Refactor

**Date:** 2026-10-08  
**Branch:** mg-genie-bundle-scaffolds  
**Status:** Complete ✅

This session covered quality improvements made after the initial successful deploy in Phase 8. No new resources were added — all changes were naming, permissions, folder structure, and YAML file organisation.

---

## 1. Display Name Corrections

### Problem
After first deploy, the Bundle Resources panel revealed several naming issues visible in the UI:
- Jobs used snake_case internal names (`feedback_pipeline`) with a redundant `[dev]` suffix
- SQL warehouse name `Ground Truth Infra` was generic and included `[dev]` suffix
- Lakebase project included `— Lakebase` qualifier (redundant — visible in Postgres Projects section)
- Dev branch was named `dev_branch` / `branch_id: dev` (asymmetric with `production`)

### DAB naming rule clarified
Resources that receive the DAB dev-mode auto-prefix `[dev matthew_giglia]` (jobs, SQL warehouse) **do not need** an explicit `[dev]` suffix — it’s redundant noise. Resources without auto-prefix (Lakebase project, branches, schema) **do** need explicit environment signalling.

### Changes
| File | Change |
|------|--------|
| `resources/jobs/*.job.yml` | Names: `Semantic Ground Truth — Feedback Pipeline` etc. (proper English + project prefix) |
| `resources/infra_warehouse.warehouse.yml` | `Ground Truth Infra` → `Semantic Ground Truth` |
| `resources/lakebase/ground_truth_project.postgres_project.yml` | dev: `Semantic Ground Truth [dev]`; prod: `Semantic Ground Truth` |
| `resources/lakebase/development.postgres_branch.yml` | Resource key `dev_branch` → `development`; `branch_id: dev` → `branch_id: development` |
| `databricks.yml` | Dev schema `dev_matthew_giglia_ground_truth` → `ground_truth` (DAB prefix handles the rest); prod schema `app` → `semantic_ground_truth` |

---

## 2. Warehouse Permissions Block

Added `permissions:` block to `resources/infra_warehouse.warehouse.yml`:
- `CAN_MANAGE`: matthew.giglia@databricks.com
- `CAN_USE`: `users` group
- App SPN `CAN_USE` intentionally omitted — SP name unknown until Bundle 2 deploys

---

## 3. Folder Structure Refactor

### Problem
- `docs/plan/` had one file and was unnecessary nesting
- `docs/unity-gateway-setup.md` was a runbook sitting loose at the `docs/` root
- `fixtures/` mixed session summaries (dev artifacts) with metric view YAMLs (operational config)
- `src/prompts/` treated a deployable config file like source code

### Changes (all via `git mv` — history preserved)

```
docs/plan/infra_build_plan.md    →  docs/infra_build_plan.md          (flatten)
docs/unity-gateway-setup.md      →  docs/runbooks/unity-gateway-setup.md
fixtures/mv_*.yaml               →  fixtures/metric_views/mv_*.yaml   (4 files)
src/prompts/feedback_loop_prompt.md →  fixtures/prompts/feedback_loop_prompt.md
```

`src/notebooks/list_fixtures.py` default path updated from `fixtures/` → `fixtures/metric_views/`.

---

## 4. Resource YAML Split: One File per Resource

### Problem
Four type-per-file YAMLs mixed multiple resources of the same type in one file, making navigation and ownership harder to reason about.

### Change
Deleted the 4 old files; created 11 per-resource files:

```
resources/
├── jobs/
│   ├── feedback_pipeline.job.yml
│   ├── freshness_resurfacing.job.yml
│   ├── metric_view_deploy.job.yml
│   └── post_deploy_validation.job.yml
├── lakebase/
│   ├── ground_truth_project.postgres_project.yml  ← contains targets: block
│   ├── production.postgres_branch.yml
│   ├── development.postgres_branch.yml
│   ├── app_role.postgres_role.yml
│   └── app_db.postgres_database.yml
├── ground_truth_schema.schema.yml
└── infra_warehouse.warehouse.yml
```

Notebook paths updated: `../src/notebooks/` → `../../src/notebooks/` (one level deeper).

`databricks.yml` `include` was already `resources/*.yml` + `resources/*/*.yml` — no change needed.

---

## Deploy Outcomes

All changes validated and deployed to dev throughout the session:
- `bundle validate --strict --target dev` passed after every change
- `bundle deploy --target dev --auto-approve` confirmed resource updates each round
- Final resource panel shows clean naming across all resource types

---

## Files Modified

| File | Action |
|------|--------|
| `databricks.yml` | Dev schema `ground_truth`; prod schema `semantic_ground_truth` |
| `resources/jobs/*.job.yml` (4) | Created (split from jobs.yml) |
| `resources/lakebase/*.yml` (5) | Created (split from lakebase.yml) |
| `resources/ground_truth_schema.schema.yml` | Created (renamed from schemas.yml) |
| `resources/infra_warehouse.warehouse.yml` | Created (renamed from warehouses.yml) with permissions block |
| `resources/jobs.yml` | Deleted |
| `resources/lakebase.yml` | Deleted |
| `resources/schemas.yml` | Deleted |
| `resources/warehouses.yml` | Deleted |
| `docs/infra_build_plan.md` | Moved from `docs/plan/` |
| `docs/runbooks/unity-gateway-setup.md` | Moved from `docs/` |
| `fixtures/metric_views/mv_*.yaml` (4) | Moved from `fixtures/` |
| `fixtures/prompts/feedback_loop_prompt.md` | Moved from `src/prompts/` |
| `src/notebooks/list_fixtures.py` | Default fixtures path updated |
