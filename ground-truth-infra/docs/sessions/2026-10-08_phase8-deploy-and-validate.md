# Session Summary: Phase 8 — Deploy + Validate

**Date:** 2026-10-08  
**Branch:** mg-genie-bundle-scaffolds  
**Phase:** 8 of 8  
**Status:** Complete ✅

---

## Deploy Result

```
databricks bundle deploy --target dev --auto-approve
→ Recreated schemas.ground_truth_schema
→ Updated jobs.post_deploy_validation
→ Updated jobs.metric_view_deploy
→ Updated jobs.freshness_resurfacing
→ Updated jobs.feedback_pipeline
→ Created postgres_databases.app_db
→ Resources: 2 created, 4 changed, 1 deleted, 5 unchanged
```

---

## Deploy Issues Encountered and Fixed

### Issue 1: Catalog `dev_ground_truth` does not exist

**Error:** `Catalog 'dev_ground_truth' does not exist (404 CATALOG_DOES_NOT_EXIST)`

**Root cause:** This workspace uses `hls_fde_dev` for all dev catalogs (consistent with lakeLoom, scAuditor). `dev_ground_truth` was never created.

**Fix:** Changed `databricks.yml` dev target catalog variable from `dev_ground_truth` to `hls_fde_dev`.

---

### Issue 2: Lakebase branch parent had double `projects/` prefix in API URL

**Error:** `No API found for 'POST /postgres/projects/projects/dev-matthew-giglia-ground-truth/branches'`

**Root cause:** The branch `parent` field was set to `"projects/${resources.postgres_projects.ground_truth_project.id}"`. Since Lakebase `.id` returns the full resource path (`projects/dev-matthew-giglia-ground-truth`), the constructed parent was `projects/projects/dev-matthew-giglia-ground-truth`. The Lakebase CLI builds the URL as `/postgres/{parent}/branches`, resulting in the doubled path.

**Fix:** Changed branch parents to `"${resources.postgres_projects.ground_truth_project.id}"` (no manual `projects/` prefix). The `.id` field already contains the full path.

**Key finding:** Lakebase DAB resource `.id` = full resource path (e.g. `projects/{project_id}`, `projects/{p}/branches/{b}`, `projects/{p}/branches/{b}/roles/{r}`). Always use `.id` directly; never prepend a path prefix.

---

### Issue 3: Job `environments` block missing

**Error:** `Job environment 'serverless' used by task X is not defined in field 'environments'`

**Root cause:** Tasks referenced `environment_key: serverless` but no `environments:` block was defined at the job level.

**Fix:** Added to each job:
```yaml
environments:
  - environment_key: serverless
    spec:
      client: "1"
```

---

### Issue 4: `app_db.role` path double-prefix

**Error:** `Field 'spec.role' expects 'projects/{project_id}/branches/{branch_id}/roles/{role_id}' format`

**Root cause:** `role` was set to `"projects/${resources.postgres_projects.ground_truth_project.id}/branches/production/roles/app-role"`. Since `.id` = `projects/dev-matthew-giglia-ground-truth`, this expanded to `projects/projects/dev-matthew-giglia-ground-truth/branches/production/roles/app-role`.

**Fix:** Changed to `"${resources.postgres_roles.app_role.id}"` which already equals `projects/{project_id}/branches/{branch_id}/roles/{role_id}`.

---

### Issue 5: Schema double-prefix in dev mode

**Observation (from `bundle summary`):** Schema name resolved to `dev_matthew_giglia_dev_matthew_giglia_ground_truth` instead of `dev_matthew_giglia_ground_truth`.

**Root cause:** DABs development mode auto-prepends `dev_<user>_` to schema names. The schema variable was `dev_matthew_giglia_ground_truth`, so DABs produced `dev_matthew_giglia_dev_matthew_giglia_ground_truth`.

**Fix:** Changed dev schema variable from `dev_matthew_giglia_ground_truth` to `ground_truth`. DABs prefix then produces `dev_matthew_giglia_ground_truth` ✓.

**Key finding (workspace convention for ALL projects):** In dev mode, set `var.schema` to the unprefixed name. DABs adds `dev_<user>_` automatically.

---

## Final Deployed Resources

| Resource | Type | ID / UC Name |
|----------|------|-------------|
| `ground_truth_schema` | UC Schema | `hls_fde_dev.dev_matthew_giglia_ground_truth` |
| `infra_warehouse` | SQL Warehouse | `0ea84986a23a47c3` |
| `ground_truth_project` | Lakebase Project | `projects/dev-matthew-giglia-ground-truth` |
| `production` | Lakebase Branch | `projects/dev-matthew-giglia-ground-truth/branches/production` |
| `dev_branch` | Lakebase Branch | `projects/dev-matthew-giglia-ground-truth/branches/dev` |
| `app_role` | Lakebase Role | `projects/dev-matthew-giglia-ground-truth/branches/production/roles/app-role` |
| `app_db` | Lakebase Database | `ground-truth-app` on production branch |
| `feedback_pipeline` | Lakeflow Job | `811289891166091` |
| `freshness_resurfacing` | Lakeflow Job | `1103481179431341` |
| `metric_view_deploy` | Lakeflow Job | `423348439302077` |
| `post_deploy_validation` | Lakeflow Job | `123170360460207` |

---

## Post-Deploy Manual Steps

These cannot be done via DABs and must be done after deploy:

1. **UC Secrets** (L300-03 §Step 1) — create secret scope and keys:
   - `ground-truth-infra` scope
   - `slack_webhook_url`, `teams_webhook_url`, `git_token`

2. **Lakebase Lakehouse Sync** (L300-02 §Post-deploy) — after Bundle 2 first deploy:
   - Enable Lakehouse Sync in Lakebase App UI for 6 tables
   - Creates `lb_*_history` Delta tables in `hls_fde_dev.dev_matthew_giglia_ground_truth`

3. **Unity Gateway connection** `ground-truth-mcp` (see `docs/unity-gateway-setup.md`)
   - Run after Bundle 2 provides the app URL

4. **Genie Code skill registration** (see `src/prompts/feedback_loop_prompt.md`)
   - `POST /api/2.1/unity-catalog/skills` with skill prompt
   - Copy returned `skill_id` to `resources/jobs.yml` `genie_space_id` param

5. **Lakebase `app_role` identity update** (L300-02 §Step 3)
   - After Bundle 2 deploys, update `app_role` to `identity_type: SERVICE_PRINCIPAL` with Bundle 2 app SP `app_id`

6. **Job params update** (L300-04)
   - Set `genie_space_id` and `git_folder_id` in `feedback_pipeline` after Phase 7 completes

---

## Files Modified This Phase

| File | Change |
|------|--------|
| `databricks.yml` | `catalog: hls_fde_dev` (was `dev_ground_truth`); `schema: ground_truth` (was `dev_matthew_giglia_ground_truth`); added DAB prefix comment |
| `resources/lakebase.yml` | Branch parents use `.id` directly (no manual `projects/` prefix); `app_db.role` uses `${resources.postgres_roles.app_role.id}` |
| `resources/jobs.yml` | Added `environments:` block to all 4 jobs; removed stray `existing_cluster_id: ""` |
| `fixtures/sessions/2026-10-08_phase8-deploy-and-validate.md` | Created — this file |
