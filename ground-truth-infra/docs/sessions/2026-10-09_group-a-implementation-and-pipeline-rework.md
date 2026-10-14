# Session: Group A Implementation + Feedback Pipeline Rework

**Date:** 2026-10-09  
**Branch:** `mg-genie-bundle-scaffolds`  
**Commit:** `feat(infra): implement Group A notebooks + feedback pipeline genie_task rework` (21 files)

---

## Summary

Implemented the two Group A post-deploy notebooks (`setup_genie_automation.py`, `setup_job_params.py`), reworked the feedback pipeline to use a native `genie_task` instead of the broken Genie Spaces notebook, updated the prompt fixture, and deprecated the old `create_feature_branch.py`. All changes committed and pushed.

---

## Problems Addressed

1. **Group A stubs were unimplemented** — `setup_genie_automation.py` and `setup_job_params.py` were scaffolds with `raise NotImplementedError`.
2. **feedback_pipeline Task 2 used the wrong product** — `create_feature_branch.py` called the Genie Spaces API (SQL Q&A), not Genie Code (autonomous agent). No `genie_space_id` would produce the desired behavior.
3. **Prompt fixture had obsolete UC skill registration section** — referenced `POST /api/2.1/unity-catalog/skills` which is superseded by the Genie Code automation pattern.
4. **pip/restartPython bug** — `dbutils.library.restartPython()` was on a `# MAGIC` line in both stubs (doesn't execute as Python).

---

## Changes Made

### 1. `src/notebooks/setup_genie_automation.py` — IMPLEMENTED

Full implementation replacing the stub:
- **SDK init + path resolution** — `WorkspaceClient()`, resolves `uid` (numeric user ID) and `bundle_root` from notebook context path
- **Read prompt fixture** — opens `fixtures/prompts/feedback_loop_prompt.md` via `/Workspace` path, extracts `## Skill Prompt` section using regex
- **Build composite prompt** — task instructions with `{{catalog}}`/`{{schema}}` runtime placeholders + skill rules. Uses `__PLACEHOLDER__` token substitution to avoid f-string conflicts with Genie Code `{{}}` syntax
- **List automations** — `GET /api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE`, finds by `display_name == "Ground Truth Feedback Loop"`
- **Create or update** — PATCH with etag if exists, POST if new (no schedule, no trigger — job-driven only)
- **Validate** — reads back and asserts `insight_type`, `display_name`, and prompt prefix
- **Emit** — `dbutils.jobs.taskValues.set(key="configuration_id", value=configuration_id)`
- Fixed pip/restart cell split
- Added `prompt_path` widget (default: `fixtures/prompts/feedback_loop_prompt.md`)

### 2. `src/notebooks/setup_job_params.py` — IMPLEMENTED

Full implementation replacing the stub:
- Reads `configuration_id` from `setup_genie_automation` via `dbutils.jobs.taskValues.get()`
- GETs current `feedback_pipeline` job definition via `/api/2.1/jobs/get`
- Finds `create_feature_branch` task and replaces it with a `genie_task` block (configuration_id + parameters + timeout 1800s + health rule at 600s)
- POSTs via `/api/2.1/jobs/reset` with updated settings
- Validates by reading the job back and asserting genie_task presence + configuration_id match
- Fixed pip/restart cell split

### 3. `resources/jobs/feedback_pipeline.job.yml` — REWORKED

- Replaced `create_feature_branch` `notebook_task` with `genie_task` block
- `configuration_id: "PENDING_SETUP"` — placeholder patched at runtime by `setup_job_params`
- Removed `genie_space_id` and `git_folder_id` parameters (wrong product)
- Added `timeout_seconds: 1800` and health rule (`RUN_DURATION_SECONDS > 600`)
- Removed `environment_key: serverless` from task (genie_task manages its own compute)
- Updated header comment to reference rework plan

### 4. `fixtures/prompts/feedback_loop_prompt.md` — UPDATED

- Removed entire `## Registration` section (UC skill curl commands, skill_id references)
- Reframed YAML frontmatter: "Feedback Loop Skill" → "Feedback Loop Prompt Rules"
- Added `Consumed by: src/notebooks/setup_genie_automation.py` note
- Updated `## Purpose` to describe consumption by the automation notebook
- Bumped version to 1.1.0 with changelog entry
- `## Skill Prompt` section content unchanged (still the extraction target)

### 5. `src/notebooks/create_feature_branch.py` — DEPRECATED

- Added prominent deprecation header with cross-references to:
  - `docs/plans/feedback_pipeline_rework_plan.md`
  - `resources/jobs/feedback_pipeline.job.yml`
  - `src/notebooks/setup_genie_automation.py`
  - `src/notebooks/setup_job_params.py`
- Original code preserved for reference
- No job YAML references this file

---

## Key Decisions

1. **`__PLACEHOLDER__` token pattern** for prompt template — avoids f-string/`.format()` conflicts with Genie Code `{{param}}` placeholders. Plain string with `.replace()` calls.
2. **`PENDING_SETUP` placeholder** in feedback_pipeline YAML — the genie_task needs a `configuration_id` at deploy time, but the automation doesn't exist yet. Placeholder is patched by `setup_job_params` on first deploy.
3. **Option C for deprecation** — kept `create_feature_branch.py` in place with header (no file-move tool available). Job YAML change is what matters.
4. **Bundle validate `--strict` warning expected** — `genie_task` is Beta, not yet in the validator's JSON schema. Jobs API accepts it (confirmed in live testing). Non-strict validation passes.

---

## Validation

- `bundle validate --target dev` — OK (1 expected warning: `genie_task` unknown field)
- `bundle validate --strict --target dev` — fails on the warning (expected for Beta task type)
- `bundle summary --target dev` — confirms all resources resolve correctly
- Git commit + push — 21 files committed to `mg-genie-bundle-scaffolds`

---

## Files Modified

| File | Action |
|------|--------|
| `src/notebooks/setup_genie_automation.py` | Implemented (was stub) |
| `src/notebooks/setup_job_params.py` | Implemented (was stub) |
| `resources/jobs/feedback_pipeline.job.yml` | Reworked (notebook_task → genie_task) |
| `fixtures/prompts/feedback_loop_prompt.md` | Updated (removed Registration, reframed) |
| `src/notebooks/create_feature_branch.py` | Deprecated (added header) |

---

## What's Next

1. **Deploy to dev** — `bundle deploy --target dev` to push the genie_task changes live
2. **Run post_deploy_setup with `--var run_setup=true`** — triggers `setup_genie_automation` + `setup_job_params` to create the automation and wire the real `configuration_id`
3. **Hardcode configuration_id** — once known, update `feedback_pipeline.job.yml` to replace `PENDING_SETUP`
4. **Group B stubs** — `setup_gateway_connection.py`, `setup_cdf_config.py`, `setup_app_role_sp.py` (blocked on Bundle 2)
5. **Bundle 2 (ground-truth-app)** — Node.js AppKit + React + MCP Server
6. **Bundle 3 (ground-truth-agent)** — Genie Agent + metric views over CDF
