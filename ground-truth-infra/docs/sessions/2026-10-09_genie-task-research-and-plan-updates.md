# Session: Genie Code Task Research + DAB Resource Discovery + Plan Updates

**Date:** 2026-10-09  
**Branch:** `mg-genie-bundle-scaffolds`  
**Duration:** ~3 hours (continued from prior Genie Code research session)

---

## Summary

Researched `genie_task` as a Lakeflow Job task type, discovered it IS valid DAB YAML (contradicting initial findings), then researched four new DAB resource types (`secret`, `secret_scope`, `job_run`, `mcp_service`) that dramatically simplify the post-deploy story. Created two plan files, updated all cross-references, and revised the infra build plan and Unity Gateway runbook.

---

## Problems & Root Causes

1. **`genie_task` DAB YAML support was initially documented as unsupported.** The Jobs UI generates valid `genie_task` YAML when you add a Genie Code task — proving native DAB support exists. The backing automation (scheduled insight) still requires API creation.

2. **6 manual post-deploy steps were all SDK-notebook-based.** Research found that UC Secrets, MCP Services, and deploy-time job triggering are now DAB-declarable — reducing notebook count from 7 to 5 and eliminating all manual `bundle run` steps.

3. **Unity Gateway runbook was entirely manual.** MCP Service registration is now declarative; HTTP connection creation is automated via SDK notebook. Only the connection itself remains non-DAB-declarable.

---

## Research Documents Created

| File | Content |
|------|---------|
| `docs/research/03_genie_code_workflow_tasks.md` | `genie_task` API surface, automation CRUD, DAB YAML confirmation, execution model, deploy pattern, feedback pipeline implications. 12 sections, 452 lines. |
| `docs/research/04_dab_secrets_jobruns_mcp.md` | UC `secret` (CLI 1.12.0+), `secret_scope` (CLI 0.252.0+), `job_run` deploy hooks (CLI 1.7.0+), `mcp_service` (CLI 1.17.0+). Revised post-deploy architecture, full YAML examples, complete DAB resource type list. 10 sections. |

---

## Plan Files Created

| File | Content |
|------|---------|
| `docs/plans/post_deploy_automation_plan.md` | New `post_deploy_setup` job with Phase 0 (declarative: 3 UC secrets + MCP service + job_run deploy hook) + 6 notebook tasks in two groups (A: unblocked, B: post-Bundle 2). Full job YAML skeleton, deployment workflow, file manifests. |
| `docs/plans/feedback_pipeline_rework_plan.md` | Replace Task 2 (`create_feature_branch.py` notebook calling wrong Genie Spaces API) with native `genie_task`. Before/after YAML diffs, prompt design, archive strategy, deploy sequence, risk matrix. |

---

## Files Modified

| File | Change |
|------|---------|
| `databricks.yml` (all 3 bundles) | Added `engine: direct` — required for `secret`, `job_run`, `mcp_service` resources |
| `docs/plans/infra_build_plan.md` | Added 7 new DAB-declared resources (3 secrets, 1 MCP, 1 job_run, 1 job, 1 deprecated). Updated manual table (3 items moved to DAB-declared, 1 replaced). Added 3 secret variables. Updated notebooks table (1 deprecated, 5 new). Updated prompt description. |
| `docs/plans/post_deploy_automation_plan.md` | Added Phase 0 (declarative resources). Eliminated `setup_secrets` task. Added `job_run` deploy hook. Renumbered tasks 7→6. Updated deployment workflow, file manifest, superseded table, open questions. |
| `docs/plans/feedback_pipeline_rework_plan.md` | Updated deploy sequence for `job_run` auto-trigger. Resolved open question #3 (prompt iteration). |
| `docs/runbooks/unity-gateway-setup.md` | Full rewrite: Step 1 automated (SDK notebook), Step 2 declarative (`mcp_service`), Steps 3-4 automated. Added validation commands, updated references. |
| `PROJECT_MEMORY.md` (solution root) | Added research 03 and 04 to inventory. Updated README research row. |
| `README.md` (solution root) | Updated Research row in design docs table. |

---

## Key Decisions

1. **UC Secrets over workspace secrets.** Three-level namespace (`catalog.schema.secret`) with UC governance, cross-workspace access, and HIPAA audit trails. Requires serverless env v4+ (our compute is compatible).

2. **`job_run` as deploy hook.** `lifecycle.triggers: [always]` fires the post-deploy setup on every `bundle deploy`. Eliminates manual `bundle run` step. `only:` field limits auto-trigger to Group A tasks.

3. **`mcp_service` for MCP registration.** Replaces manual Unity Gateway UI step. Depends on HTTP connection existing first — may fail on first deploy pre-Bundle 2 (acceptable, self-resolves).

4. **`genie_task` IS valid DAB YAML.** Confirmed via Jobs UI YAML export. Backing automation still needs API. Deploy pattern: `job_run` auto-triggers `setup_genie_automation.py` → creates automation → `setup_job_params.py` → patches job.

5. **`engine: direct` for all bundles.** Required for the new resource types. Applied to all 3 bundles proactively — no functional impact on existing resources.

---

## Commits

| # | Message | Files |
|---|---------|-------|
| 1 | `research: add 03_genie_code_workflow_tasks.md` | 3 (research doc + PROJECT_MEMORY + README) |
| 2 | `plans: add post-deploy automation and feedback pipeline rework plans` | 2 (plan files) |
| 3 | `research: add 04_dab_secrets_jobruns_mcp.md` | 3 (research doc + PROJECT_MEMORY + README) |
| 4 | (pending) All remaining changes: `engine: direct`, infra build plan, runbook, session summary, project memory | ~8 files |

---

## Open Items

1. **Implement declarative resources** — create the `resources/secrets/`, `resources/mcp/`, and `resources/jobs/run_post_deploy.job_run.yml` files
2. **Implement post_deploy_setup job** — `resources/jobs/post_deploy_setup.job.yml` + 5 notebooks
3. **Rework feedback_pipeline** — update job YAML, archive `create_feature_branch.py`, migrate prompt fixture
4. **Validate with `engine: direct`** — run `databricks bundle validate --strict` to confirm no regressions
5. **Clean up test resources** — test job `323387939074465` and test automation still in workspace
6. **Update `infra_build_plan.md` build phases** — add Phase 9 (post-deploy automation) and Phase 10 (feedback pipeline rework)
