# Feedback Pipeline Rework Plan

## Purpose

Migrate the `feedback_pipeline` job's Task 2 from a notebook calling the wrong API (`/api/2.0/genie/spaces/`) to a native `genie_task` that uses a Genie Code automation. This fixes the design conflation between Genie Spaces (SQL Q&A) and Genie Code (autonomous agent), and eliminates the `genie_space_id` parameter that references a nonexistent product.

**Design sources:** L200-C6 Feedback Pipeline, L300-04 Lakeflow Jobs, L300-06 Genie Code Skills
**Research:** `docs/research/03_genie_code_workflow_tasks.md`

---

## Problem Statement

The current `create_feature_branch.py` notebook (Task 2 of `feedback_pipeline`) has three issues:

1. **Wrong API:** Calls `/api/2.0/genie/spaces/{space_id}/start-conversation` — the AI/BI Genie Spaces API, which generates SQL, not YAML. No `genie_space_id` will produce the desired behavior.
2. **Wrong product:** The design conflates Genie Spaces (data rooms), Genie Code (the assistant), and Unity Gateway Skills (discoverable tools). These are three separate products.
3. **Unnecessary complexity:** The notebook manually handles LLM invocation + response parsing + Git branch creation + Repos API calls. Genie Code's `genie_task` does all of this natively.

---

## Solution: Replace Task 2 with `genie_task`

### Architecture Change

```
BEFORE:
  Task 1: collect_feedback (notebook_task) → writes feedback_staging
  Task 2: create_feature_branch (notebook_task) → calls Genie Spaces API (broken)
           └── params: genie_space_id, git_folder_id

AFTER:
  Task 1: collect_feedback (notebook_task) → writes feedback_staging
  Task 2: create_feature_branch (genie_task) → Genie Code reads staging, generates YAML, commits
           └── references: Genie Code automation (holds the prompt)
           └── params: catalog, schema (via {{}} placeholders)
```

The `genie_task` replaces both the LLM call AND the Git branch creation — Genie Code natively handles reading tables, generating YAML, and committing to Git via `runGit`.

---

## Changes Required

### 1. Update Job YAML

**File:** `resources/jobs/feedback_pipeline.job.yml`

**Before:**
```yaml
- task_key: create_feature_branch
  depends_on:
    - task_key: collect_feedback
  notebook_task:
    notebook_path: ../../src/notebooks/create_feature_branch.py
    base_parameters:
      catalog: "${var.catalog}"
      schema: "${resources.schemas.ground_truth_schema.name}"
      genie_space_id: ""   # broken — references wrong product
      git_folder_id: ""    # manual post-deploy step
  environment_key: serverless
```

**After:**
```yaml
- task_key: create_feature_branch
  depends_on:
    - task_key: collect_feedback
  genie_task:
    configuration_id: <set by post_deploy_setup job>  # or hardcode after first deploy
    parameters:
      catalog: "${var.catalog}"
      schema: "${resources.schemas.ground_truth_schema.name}"
  timeout_seconds: 1800
  health:
    rules:
      - metric: RUN_DURATION_SECONDS
        op: GREATER_THAN
        value: 600
```

**Key changes:**
- `notebook_task` → `genie_task`
- `genie_space_id` and `git_folder_id` params removed
- `configuration_id` references a Genie Code automation (created by `post_deploy_setup` job)
- `catalog` and `schema` become `genie_task.parameters` (resolved to `{{catalog}}` / `{{schema}}` placeholders in the prompt)
- Timeout and health rules added (Genie Code tasks can be slower than notebooks)
- `environment_key: serverless` removed (`genie_task` manages its own compute)

---

### 2. Create the Genie Code Automation

The automation holds the prompt that Genie Code executes. Created by `setup_genie_automation.py` in the `post_deploy_setup` job (see `post_deploy_automation_plan.md`).

**Prompt design:**

The prompt should be built from two sources:
1. **Task instructions** — what to do (read staging table, generate YAML, create branch)
2. **Skill rules** — how to generate YAML (from `fixtures/prompts/feedback_loop_prompt.md`)

```
You are a metric view YAML editor for the Semantic Ground Truth App.

Read the feedback staging table at {{catalog}}.{{schema}}.feedback_staging.
For each asset with REJECT or EDIT votes:
1. Read the current fixture YAML from the Git folder at
   /Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-infra/fixtures/metric_views/
2. Generate an updated YAML that addresses the reviewer feedback
3. Create a feature branch named `feedback/YYYY-MM-DD-<asset_name>`
4. Commit the proposed YAML changes to the branch
5. Write a summary of changes to {{catalog}}.{{schema}}.feedback_results

If the staging table is empty or has 0 rows, exit with message "No feedback to process."

Follow these YAML generation rules:
---
<contents of fixtures/prompts/feedback_loop_prompt.md § Skill Prompt>
```

**Parameter placeholders:**
- `{{catalog}}` → resolved from `genie_task.parameters.catalog`
- `{{schema}}` → resolved from `genie_task.parameters.schema`

---

### 3. Migrate the Prompt Fixture

**File:** `fixtures/prompts/feedback_loop_prompt.md`

**Before:** Documented as a UC skill registered via `POST /api/2.1/unity-catalog/skills`
**After:** Used as the YAML generation rules section of the Genie Code automation prompt

**Changes to the file:**
- Remove § Registration (the `curl` commands for UC skills API)
- Remove references to "registering as a UC skill"
- Reframe as "Genie Code automation prompt rules" — the prompt rules themselves are unchanged
- Add a note: "Consumed by `setup_genie_automation.py`, which reads this file and embeds it in the automation's `user_prompt`"

---

### 4. Deprecate `create_feature_branch.py`

**File:** `src/notebooks/create_feature_branch.py`

**Options:**

| Option | Approach | Recommendation |
|--------|----------|----------------|
| **A: Delete** | Remove the file entirely | Clean, but loses fallback |
| **B: Archive** | Move to `src/notebooks/_deprecated/` | Preserves history, clear signal |
| **C: Keep as fallback** | Add a header comment marking it deprecated; keep in `src/notebooks/` | Simplest; job YAML no longer references it |

**Recommendation:** Option B — move to `src/notebooks/_deprecated/create_feature_branch.py`. The job YAML no longer references it, but if the `genie_task` approach needs a fallback (e.g., Beta instability), the notebook code for Foundation Model API invocation is available.

---

### 5. Update `collect_feedback.py` (Minor)

**File:** `src/notebooks/collect_feedback.py`

The notebook currently sets `taskValues` for `asset_count` and `feedback_table`. The `genie_task` cannot read `taskValues` directly, but it CAN read from the staging table itself. 

**Change:** No code change needed in the notebook. The `genie_task` prompt instructs the agent to read the staging table directly. If the table is empty, the agent exits gracefully per the prompt instructions.

**Optional enhancement:** Have `collect_feedback.py` also write a `feedback_summary` row to a control table with the batch timestamp and asset count, so the Genie Code agent can validate it found the right batch.

---

## Deploy Sequence

> **Updated 2026-10-09:** `job_run` resource (from `docs/research/04_dab_secrets_jobruns_mcp.md`) auto-triggers the post-deploy setup on every `bundle deploy`. No manual `bundle run` step needed.

```
1. bundle deploy --target dev
   ├── Deploys updated feedback_pipeline.job.yml with genie_task
   │   (configuration_id is a placeholder or the known value from prior setup)
   ├── Deploys UC secrets, MCP service declaratively
   └── job_run resource AUTO-TRIGGERS post_deploy_setup:
       ├── Task 1 (setup_genie_automation) creates/updates the automation
       └── Task 2 (setup_job_params) patches feedback_pipeline with the real configuration_id

2. Subsequent deploys:
   └── Once configuration_id is known, hardcode it in the DAB YAML
   └── bundle deploy is fully self-contained (job_run re-fires on every deploy)
   └── Prompt updates: job_run auto-triggers setup_genie_automation, which PATCHes the automation
```

---

## Removed Concepts

These items from the original design are superseded:

| Item | Original | Status |
|------|----------|--------|
| `genie_space_id` parameter | References a Genie Space (wrong product) | **Removed** |
| `git_folder_id` parameter | Passed to notebook for Repos API calls | **Removed** — Genie Code uses `runGit` natively |
| UC skill registration | `POST /api/2.1/unity-catalog/skills` | **Removed** — prompt lives in the automation |
| Manual post-deploy step: "Register Genie Code skill" | `PROJECT_MEMORY.md` line 65 | **Replaced** by `setup_genie_automation` task |
| Manual post-deploy step: "Set genie_space_id + git_folder_id" | `PROJECT_MEMORY.md` line 67 | **Replaced** by `setup_job_params` task |
| Genie Spaces API call in notebook | `/api/2.0/genie/spaces/{id}/start-conversation` | **Removed** — `genie_task` handles the LLM call |

---

## Files to Create

| File | Type | Notes |
|------|------|-------|
| (none — new notebooks are in `post_deploy_automation_plan.md`) | | |

## Files to Modify

| File | Change |
|------|--------|
| `resources/jobs/feedback_pipeline.job.yml` | Replace task 2: `notebook_task` → `genie_task` |
| `fixtures/prompts/feedback_loop_prompt.md` | Remove UC skill registration section; reframe as automation prompt rules |
| `PROJECT_MEMORY.md` | Update manual steps, notebook inventory, job descriptions |
| `README.md` | Update "What This Bundle Deploys" table (Genie Code Skill → Genie Code Automation) |

## Files to Archive

| File | Destination | Reason |
|------|-------------|--------|
| `src/notebooks/create_feature_branch.py` | `src/notebooks/_deprecated/` | Replaced by `genie_task`; kept as Foundation Model API fallback |

---

## Validation

1. `databricks bundle validate --strict --target dev` passes with `genie_task` in the job YAML
2. `post_deploy_setup` job creates the automation and patches the feedback_pipeline job
3. Manual test run of `feedback_pipeline` — Task 1 writes staging data, Task 2 (`genie_task`) reads it and produces a conversation thread
4. Review the Genie Code conversation thread to verify YAML generation quality
5. Confirm Git branch creation (check for `feedback/YYYY-MM-DD-*` branches)

---

## Risks

| Risk | Mitigation |
|------|------------|
| `genie_task` is Beta — may have instability | Keep `create_feature_branch.py` as archived fallback; can revert to Foundation Model API approach |
| Auto-approve may block Git commits as "risky" | Test with a real feedback batch; if blocked, narrow the prompt scope or use a notebook task with Foundation Model API |
| `configuration_id` is user-specific | For production, investigate SP-owned automations or parameterize per-target |
| No structured output from `genie_task` | Prompt instructs agent to write results to a Delta table; downstream tasks (if any) read from there |
| Prompt drift between automation and fixture file | `setup_genie_automation.py` reads the fixture file at run time — single source of truth |

---

## Open Questions

1. **First-deploy chicken-and-egg:** The `genie_task` in the DAB YAML needs a `configuration_id`, but the automation doesn't exist until the `job_run` fires post-deploy. Options: (a) placeholder value that fails gracefully on the *feedback_pipeline* job but the *post_deploy_setup* succeeds and patches the real ID, (b) two-pass deploy, (c) use the `job_run`'s `only` field to ensure automation is created before feedback_pipeline is ever triggered.
2. **taskValues handoff:** Does the `genie_task` need the `asset_count` from Task 1? The prompt tells it to read the staging table directly, but should it also respect an "empty batch" signal from Task 1?
3. ~~**Prompt iteration workflow:** When iterating on the prompt in `feedback_loop_prompt.md`, the developer must re-run `post_deploy_setup` to push the update to the automation. Should we add a `bundle run` command for this, or is the manual step acceptable?~~ **RESOLVED** — the `job_run` resource with `lifecycle.triggers: [always]` auto-triggers the setup on every `bundle deploy`, so prompt updates in the fixture file are automatically pushed to the automation.
