# Research: Genie Code Workflow Tasks (genie_task)

## Date: 2026-10-09

## Summary

Genie Code can run as an autonomous task within a Lakeflow Job via the `genie_task` task type (Beta). This document captures the API surface, execution model, DAB integration pattern, and implications for the Semantic Ground Truth feedback pipeline (C6).

**Key finding:** The `genie_task` job task IS a valid DAB YAML task type (confirmed via Jobs UI YAML export). The backing automation (scheduled insight) is NOT DAB-declarable and must be created via API. Deploy pattern: post-deploy notebook creates the automation → DAB YAML references its `configuration_id` in the job task.

---

## 1. Architecture Overview

A `genie_task` is a two-part construct:

```
Job Task (genie_task)
  └── references → Genie Code Automation (scheduled insight)
                     └── contains → user_prompt + insight_type: GENIE_CODE
```

The **automation** (also called a "scheduled insight") holds the prompt and is created via REST API. The **job task** references it by `configuration_id`. When the job runs, Genie Code launches a fresh chat session with the prompt, executes autonomously with auto-approve, and produces a continuable conversation thread.

---

## 2. Creating the Automation

### API Endpoint

```
POST /api/2.0/alerts-internal/scheduled-insights
```

### Request Body

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
uid = w.current_user.me().id  # numeric user ID (not email)

resp = w.api_client.do("POST", "/api/2.0/alerts-internal/scheduled-insights", body={
    "parent_asset_name": f"users/{uid}",
    "scheduled_insight": {
        "insight_type": "GENIE_CODE",
        "user_prompt": "<the prompt to run>",
        "display_name": "Descriptive Name for UI"
    },
    # Omit 'schedule' and 'trigger' for job-driven-only automations
})

configuration_id = resp["name"]
# e.g. "genie_code/users/1081964970114387/scheduled_insights/7caaf75bae59427fb2d436d8f0225f89"
```

### Response Structure

```json
{
  "name": "genie_code/users/<userId>/scheduled_insights/<insightId>",
  "insight_type": "GENIE_CODE",
  "display_name": "...",
  "user_prompt": "...",
  "etag": "697776412"
}
```

**Key details:**
- `name` is the fully-qualified resource name = `configuration_id` for the job task
- Omitting `schedule` and `trigger` creates a "config-only" automation that only runs when triggered by a job
- `insight_type` must be `"GENIE_CODE"` (case-sensitive in the body)
- `parent_asset_name` must use the **numeric** user ID, not email

---

## 3. Reading / Updating / Deleting Automations

### List

```
GET /api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE
    ?parent_asset_name=users/<userId>
```

Note: URL path segment uses uppercase `GENIE_CODE`; resource `name` uses lowercase `genie_code/`.

### Read One

```
GET /api/2.0/alerts-internal/scheduled-insights/<insightId>
    ?name=genie_code/users/<userId>/scheduled_insights/<insightId>
```

### Update (read-then-write with etag)

```python
iid = "<insightId>"
name = f"genie_code/users/{uid}/scheduled_insights/{iid}"
base = f"/api/2.0/alerts-internal/scheduled-insights/{iid}"

etag = w.api_client.do("GET", base, query={"name": name})["etag"]
w.api_client.do("PATCH", base, body={
    "insight_id": iid,
    "update_mask": "user_prompt,display_name",
    "etag": etag,
    "scheduled_insight": {
        "name": name,
        "user_prompt": "<updated prompt>",
        "display_name": "Updated Name"
    },
})
```

### Delete

```python
w.api_client.do("DELETE", base, query={"name": name})
```

**Warning:** Deleting a job does NOT delete the backing automation. Clean up explicitly.

---

## 4. Creating the Job Task

### Via REST API

```python
w.api_client.do("POST", "/api/2.1/jobs/create", body={
    "name": "My Genie Code Job",
    "tasks": [{
        "task_key": "feedback_genie",
        "genie_task": {
            "configuration_id": configuration_id,
            "parameters": {
                "catalog": "hls_fde_dev",
                "schema": "dev_matthew_giglia_ground_truth"
            }
        }
    }]
})
```

### Via Python SDK (partial — no GenieTask class)

The SDK `Task` class does **not** have a `genie_task` field as of Oct 2026. Use `w.api_client.do()` for creation and the raw Jobs API for reads.

### DAB YAML (confirmed working)

`genie_task` IS a valid DAB task type. Confirmed via the Lakeflow Jobs UI, which generates this YAML when you add a Genie Code task:

```yaml
resources:
  jobs:
    feedback_pipeline:
      name: "Semantic Ground Truth — Feedback Pipeline"
      tasks:
        - task_key: create_feature_branch
          genie_task:
            configuration_id: genie_code/users/<uid>/scheduled_insights/<insightId>
          timeout_seconds: 1800
          health:
            rules:
              - metric: RUN_DURATION_SECONDS
                op: GREATER_THAN
                value: 600
      queue:
        enabled: true
```

**What IS DAB-declarable:** The job task definition (`genie_task.configuration_id` + timeout/health/depends_on).

**What is NOT DAB-declarable:** The backing automation (scheduled insight). It must be created via the API first — the `configuration_id` references an existing automation by its resource name.

**Deploy pattern:** Post-deploy notebook creates the automation → returns `configuration_id` → DAB YAML references it in the job task. See §7.

---

## 5. Parameters

The prompt supports `{{name}}` placeholders replaced at run time from the task's `parameters` map.

```json
{
  "genie_task": {
    "configuration_id": "genie_code/users/<uid>/scheduled_insights/<id>",
    "parameters": {
      "catalog": "hls_fde_dev",
      "schema": "dev_matthew_giglia_ground_truth",
      "cutoff_hours": "24"
    }
  }
}
```

**Rules:**
- Keys: 1–100 chars, `[A-Za-z0-9_.-]`
- Total parameters map: max 10,000 JSON characters
- Values can reference job parameters (`{{job.parameters.region}}`) or upstream task output (`{{tasks.collect_feedback.values.asset_count}}`)
- Unmatched placeholders are left unchanged (not errored)

---

## 6. Execution Model

| Property | Behavior |
|----------|----------|
| **Auto-approve** | Always ON. Cannot be disabled for job tasks. AI classifier blocks risky operations outside prompt scope. |
| **Identity** | Runs as the job owner's Databricks identity (not the automation creator) |
| **Capabilities** | Full Genie Code agent: read tables, write files, run code, create notebooks, Git operations |
| **Output** | Continuable conversation thread. Run output = thread link + latest response. |
| **Structured output** | **NONE.** No `taskValues`, no structured return. Downstream tasks cannot read data from a `genie_task` via task values. |
| **Handoff pattern** | Agent writes results to Delta table or UC Volume → downstream notebook reads from there |
| **Timeout** | Configurable via standard job task timeout settings |
| **Retries** | Configurable via standard job task retry settings |
| **Continuation** | After run completes, open the thread to review or continue interactively |

---

## 7. DAB Deploy Pattern (Post-Deploy Notebook)

The `genie_task` job task is DAB-declarable, but the backing automation is not. The deploy pattern uses a **setup notebook** that creates the automation, then the DAB YAML references it by `configuration_id`.

Two-phase deploy:
1. **`bundle deploy`** — deploys the job with `genie_task` referencing a `configuration_id` (must already exist, or set a placeholder and update post-deploy)
2. **`bundle run post_deploy_setup`** — notebook creates/updates the automation, then patches the job task's `configuration_id` if needed

The setup notebook:

```python
# src/notebooks/setup_genie_task.py
# Runs as a post-deploy job task
# Creates the Genie Code automation and updates the feedback_pipeline job

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
uid = w.current_user.me().id

# Parameters
catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
feedback_job_id = dbutils.widgets.get("feedback_job_id")
git_folder_id = dbutils.widgets.get("git_folder_id")

# Read prompt from versioned fixture
prompt_path = "fixtures/prompts/feedback_loop_prompt.md"
# (Read the prompt file content here)

prompt_template = f"""You are a metric view YAML editor for the Semantic Ground Truth App.

Read the feedback staging table at {{{{catalog}}}}.{{{{schema}}}}.feedback_staging.
For each asset with REJECT or EDIT votes:
1. Read the current fixture YAML
2. Generate an updated YAML addressing reviewer feedback
3. Write proposed changes to a feature branch in Git folder {git_folder_id}

Follow the rules in the skill prompt below:
---
{{prompt_content}}
"""

# Step 1: Create automation (idempotent — check if exists first)
existing = w.api_client.do(
    "GET", "/api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE",
    query={"parent_asset_name": f"users/{uid}"}
).get("scheduled_insights", [])

automation = next(
    (a for a in existing if a.get("display_name") == "Ground Truth Feedback Loop"),
    None
)

if automation:
    configuration_id = automation["name"]
    print(f"Automation already exists: {configuration_id}")
    # Update prompt if changed
    iid = configuration_id.split("/")[-1]
    etag = automation["etag"]
    w.api_client.do("PATCH", f"/api/2.0/alerts-internal/scheduled-insights/{iid}", body={
        "insight_id": iid,
        "update_mask": "user_prompt",
        "etag": etag,
        "scheduled_insight": {"name": configuration_id, "user_prompt": prompt_template},
    })
else:
    resp = w.api_client.do("POST", "/api/2.0/alerts-internal/scheduled-insights", body={
        "parent_asset_name": f"users/{uid}",
        "scheduled_insight": {
            "insight_type": "GENIE_CODE",
            "user_prompt": prompt_template,
            "display_name": "Ground Truth Feedback Loop"
        },
    })
    configuration_id = resp["name"]
    print(f"Created automation: {configuration_id}")

# Step 2: Update the feedback_pipeline job to replace task 2 with genie_task
# Read current job, replace the create_feature_branch task
job = w.api_client.do("GET", "/api/2.1/jobs/get",
                      query={"job_id": feedback_job_id})
tasks = job["settings"]["tasks"]

# Find and replace task 2
for i, task in enumerate(tasks):
    if task["task_key"] == "create_feature_branch":
        tasks[i] = {
            "task_key": "create_feature_branch",
            "depends_on": [{"task_key": "collect_feedback"}],
            "genie_task": {
                "configuration_id": configuration_id,
                "parameters": {
                    "catalog": catalog,
                    "schema": schema
                }
            }
        }
        break

w.api_client.do("POST", "/api/2.1/jobs/reset", body={
    "job_id": int(feedback_job_id),
    "new_settings": {"tasks": tasks}
})
print(f"Updated job {feedback_job_id} with genie_task")

dbutils.notebook.exit(configuration_id)
```

This notebook becomes a task in the `post_deploy_validation` or a dedicated `post_deploy_setup` job, running after `bundle deploy`.

---

## 8. Comparison: genie_task vs Alternatives

| Approach | Structured output | YAML generation | Git operations | DAB-native | Prompt versioning |
|----------|------------------|----------------|----------------|------------|------------------|
| **genie_task** | No (write to Delta) | Yes (full agent) | Yes (native runGit) | Partial (task in YAML; automation via API) | In automation |
| **Foundation Model API** | Yes (parse response) | Yes (direct LLM) | No (manual SDK) | Yes (notebook task) | In notebook code |
| **ai_generate_text()** | Yes (SQL result) | Yes (SQL AI fn) | No (manual SDK) | Yes (SQL task) | In SQL |
| **Genie Spaces API** | No | No (SQL-only) | No | No | N/A |

### When to use genie_task

**Use when:**
- The task needs complex multi-step reasoning (read data → analyze → write files → Git commit)
- You want Genie Code's full tool suite (file I/O, Git, table reads, code execution)
- Structured output isn't needed for downstream task chaining (or you use Delta as handoff)
- The prompt is stable and doesn't need per-row iteration

**Prefer Foundation Model API when:**
- You need structured output (JSON/YAML) parsed in code
- The task is a simple prompt→response pattern
- You need per-row iteration (genie_task runs one prompt per execution)
- You need deterministic retry logic

---

## 9. Implications for the Feedback Pipeline (C6)

### Original Design (L200-C6, L300-04)

The notebook `create_feature_branch.py` calls `/api/2.0/genie/spaces/{space_id}/start-conversation` — the **AI/BI Genie Spaces** API. This is the wrong product for YAML generation:

- Genie Spaces are SQL Q&A data rooms — they generate SQL, not YAML
- There is no `genie_space_id` that would produce the desired behavior
- The `genie_space_id` parameter and UC skill registration step in the design are based on a conflation of Genie Spaces, Genie Code, and Unity Gateway Skills

### Revised Architecture

```
feedback_pipeline job (daily 11 PM)
  ├── Task 1: collect_feedback (notebook_task)
  │   └── Queries unprocessed votes, groups by asset, writes feedback_staging table
  │   └── Sets taskValues: asset_count, feedback_table
  │
  └── Task 2: create_feature_branch (genie_task)
      └── Prompt: "Read {{catalog}}.{{schema}}.feedback_staging.
           For each asset with REJECT/EDIT votes:
           1. Read current fixture YAML from Git folder
           2. Generate updated YAML addressing feedback
           3. Create feature branch and commit proposed changes"
      └── Parameters: catalog, schema (from job params)
```

The `genie_task` replaces both the LLM call AND the Git branch creation — Genie Code natively handles both.

### What changes

| Item | Before | After |
|------|--------|-------|
| `genie_space_id` param | References nonexistent Genie Space | Removed — replaced by `configuration_id` |
| `create_feature_branch.py` | Notebook with manual Genie Spaces + Repos API calls | Replaced by `genie_task` (or kept as Foundation Model API fallback) |
| UC skill registration | `POST /api/2.1/unity-catalog/skills` | Not needed — prompt lives in the automation |
| Post-deploy step #2 | "Register Genie Code skill" | "Create Genie Code automation + wire job task" |
| Post-deploy step #3 | "Set genie_space_id + git_folder_id in job" | Handled by setup notebook |

---

## 10. Verified in This Workspace

**Date:** 2026-10-09
**Workspace:** `fevm-hls-fde` (`https://fevm-hls-fde.cloud.databricks.com`)
**User ID:** `1081964970114387`

| Test | Result |
|------|--------|
| Create automation (no schedule) | ✅ `POST /api/2.0/alerts-internal/scheduled-insights` succeeded |
| Read automation back | ✅ `GET .../scheduled-insights/<id>` returned full details |
| Create job with `genie_task` | ✅ `POST /api/2.1/jobs/create` succeeded, task visible in raw API |
| Parameters on genie_task | ✅ `parameters` map accepted and stored |
| Python SDK `Task` class | ❌ No `genie_task` field (not in SDK yet) |
| DAB YAML `genie_task` | ✅ Valid task type — confirmed via Jobs UI YAML export |
| List existing automations | ✅ 14 existing automations found (from Hi Genie Orchestrator project) |

**Test resources created and pending cleanup:**
- Job ID: `323387939074465` ("TEST — Ground Truth Genie Code Task (delete me)")
- Automation: `genie_code/users/1081964970114387/scheduled_insights/7caaf75bae59427fb2d436d8f0225f89`

---

## 11. API Quick Reference

| Operation | Method | Path | Notes |
|-----------|--------|------|-------|
| Create automation | POST | `/api/2.0/alerts-internal/scheduled-insights` | `insight_type: "GENIE_CODE"` |
| List automations | GET | `/api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE` | `?parent_asset_name=users/<uid>` |
| Read automation | GET | `/api/2.0/alerts-internal/scheduled-insights/<iid>` | `?name=genie_code/users/<uid>/scheduled_insights/<iid>` |
| Update automation | PATCH | `/api/2.0/alerts-internal/scheduled-insights/<iid>` | Requires `etag` + `update_mask` |
| Delete automation | DELETE | `/api/2.0/alerts-internal/scheduled-insights/<iid>` | `?name=...` (not auto-deleted with job) |
| Create job w/ task | POST | `/api/2.1/jobs/create` | `genie_task.configuration_id` = automation `name` |
| Update job tasks | POST | `/api/2.1/jobs/reset` | Replace full `tasks` array |

---

## 12. Open Questions

1. **Beta stability:** `genie_task` is Beta (Previews page). Will the automation API (`alerts-internal/scheduled-insights`) remain stable or move to a public endpoint?
2. **SDK support timeline:** `genie_task` works in DAB YAML but the Python SDK `Task` class has no `GenieTask` field yet. When will SDK parity arrive?
3. **User portability:** The `configuration_id` contains a user-specific path (`users/<uid>`). How does this work for service-principal-owned jobs in production?
4. **Auto-approve scope:** The AI classifier blocks "risky operations" — what constitutes risky for Git commits to a shared repo?
5. **Concurrency:** Can multiple `genie_task` runs execute in parallel, or does Genie Code serialize per user?

---

## References

- [Genie Code task for jobs](https://docs.databricks.com/aws/en/jobs/tasks/genie-code/) — official docs (Beta)
- [Genie Code scheduled tasks](https://docs.databricks.com/aws/en/genie-code/scheduled-tasks/) — recurring prompts (different from job tasks)
- L200-C6 Feedback Pipeline — `docs/design/L200-C6_feedback_pipeline.md`
- L300-04 Lakeflow Jobs — `docs/design/L300-04_lakeflow_jobs.md`
- L300-06 Genie Code Skills — `docs/design/L300-06_genie_code_skills.md`
