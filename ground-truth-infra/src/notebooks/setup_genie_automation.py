# Databricks notebook source
# DBTITLE 1,Setup Genie Code Automation
# MAGIC %md
# MAGIC # Setup Genie Code Automation
# MAGIC Creates or updates the Genie Code automation used by the `feedback_pipeline` task `author_feedback_branch` (a `genie_task`).
# MAGIC
# MAGIC * **One automation per target** (build 5, follow-up 1). The automation to reuse is, in order: the `configuration_id` on `feedback_pipeline.author_feedback_branch` (when it still exists), `previous_configuration_id` (the id `deploy.sh` read from that task just before the infra deploy reset it), the id recorded in `<root_path>/setup_state/genie_automation.json` (written by this notebook, outside the synced `files/` so `bundle deploy` keeps it), the newest listed automation named `Ground Truth Feedback Author (<target>)`. It is **updated in place** (prompt and display name); one is created only when none exists. An unscheduled automation is not returned by the list API and the create call does not keep its display name, which is why the name lookup alone created a new automation on every run. Selection logic: `genie_automation_lib.py` (pure, `tests/test_genie_automation_lib.py`).
# MAGIC * **`cleanup_duplicates`** (default `true`): deletes the other candidates (an older id on the job or in the state file, other automations with the same name) and any ids in `duplicate_ids`, logging each id. An id is deleted only if its prompt starts with the feedback-author prefix or it has the expected name.
# MAGIC * Created with **no schedule and no trigger** (the job drives it). Its `user_prompt` is the § Automation Prompt block of `fixtures/prompts/feedback_loop_prompt.md` with the skill version filled in, and is updated only when it changes (i.e. when the skill version or the prompt fixture changes).
# MAGIC * The rules live in the versioned skill `fixtures/skills/ground-truth-feedback-author/SKILL.md`; Genie Code reads it at the bundle-deployed path passed as `{{skill_path}}`.
# MAGIC * If the owner's `/Workspace/Users/<owner>/.assistant/skills/` folder exists, the skill is also copied to `ground-truth-feedback-author/SKILL.md` there, unless that copy has the same or a newer `version`.
# MAGIC
# MAGIC **Design source:** `docs/plans/27_infra_feedback_pipeline_genie_task.md`, `docs/plans/post_deploy_automation_plan.md` Task 1, `docs/research/03_genie_code_workflow_tasks.md` §2–3
# MAGIC
# MAGIC **API:** `/api/2.0/alerts-internal/scheduled-insights` (list, create, patch, get, delete); `GET /api/2.1/jobs/get` (read-only)
# MAGIC
# MAGIC **Outputs (task values):** `configuration_id` (full `genie_code/users/<uid>/scheduled_insights/<id>` name), `skill_version`. Pure helpers are unit-tested in `tests/test_feedback_pipeline.py`.

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# DBTITLE 1,Parameters
dbutils.widgets.text("catalog", "", "Target catalog")
dbutils.widgets.text("schema", "", "Target schema")
dbutils.widgets.text("git_folder_id", "", "Git folder ID of the repo (informational)")
dbutils.widgets.text("bundle_target", "", "Bundle target (default: parsed from the bundle root path)")
dbutils.widgets.text("prompt_path", "fixtures/prompts/feedback_loop_prompt.md", "Prompt fixture (relative to bundle root)")
dbutils.widgets.text("skill_path", "fixtures/skills/ground-truth-feedback-author/SKILL.md", "Skill file (relative to bundle root)")
dbutils.widgets.text("feedback_job_id", "", "feedback_pipeline job ID (its author_feedback_branch configuration_id is reused)")
dbutils.widgets.text("previous_configuration_id", "", "Automation id on the job before the deploy reset it (set by deploy.sh)")
dbutils.widgets.text("cleanup_duplicates", "true", "Delete other feedback-author automations (true/false)")
dbutils.widgets.text("duplicate_ids", "", "Extra automation ids to delete (comma-separated; one-time cleanup)")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
bundle_target_param = dbutils.widgets.get("bundle_target").strip()
prompt_path = dbutils.widgets.get("prompt_path").strip()
skill_rel_path = dbutils.widgets.get("skill_path").strip()
feedback_job_id = dbutils.widgets.get("feedback_job_id").strip()
previous_configuration_id = dbutils.widgets.get("previous_configuration_id").strip()
cleanup_duplicates_param = dbutils.widgets.get("cleanup_duplicates")
duplicate_ids_param = dbutils.widgets.get("duplicate_ids")
print(f"catalog={catalog}, schema={schema}, bundle_target={bundle_target_param or '<from path>'}")
print(f"prompt_path={prompt_path}, skill_path={skill_rel_path}")
print(f"feedback_job_id={feedback_job_id or '<none>'}, previous_configuration_id={previous_configuration_id or '<none>'}, cleanup_duplicates={cleanup_duplicates_param}, duplicate_ids={duplicate_ids_param or '<none>'}")

# COMMAND ----------

# DBTITLE 1,Pure helpers
# --- pure helpers (stdlib only; unit-tested in tests/test_feedback_pipeline.py) ---
import re

SKILL_NAME = "ground-truth-feedback-author"
PROMPT_PREFIX = "You are the Semantic Ground Truth feedback author"
REQUIRED_PLACEHOLDERS = (
    "{{run_date}}", "{{batch_id}}", "{{branch_prefix}}", "{{feedback_table}}",
    "{{skill_path}}", "{{repo_path}}", "{{base_branch}}",
)


def parse_skill_version(text):
    """`version:` from a SKILL.md YAML frontmatter, or None."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text or "", re.DOTALL)
    if not m:
        return None
    v = re.search(r"^version:\s*['\"]?([0-9]+(?:\.[0-9]+)*)['\"]?\s*$", m.group(1), re.MULTILINE)
    return v.group(1) if v else None


def version_tuple(version):
    return tuple(int(x) for x in version.split("."))


def should_copy_skill(source_version, existing_version):
    """Copy only when there is no copy, the copy has no version, or it is strictly older."""
    if existing_version is None:
        return True
    return version_tuple(source_version) > version_tuple(existing_version)


def target_from_bundle_root(bundle_root):
    """<root_path>/.bundle/<bundle name>/<target>/files -> <target>, else None."""
    parts = [p for p in (bundle_root or "").split("/") if p]
    if ".bundle" in parts:
        i = parts.index(".bundle")
        if len(parts) > i + 2:
            return parts[i + 2]
    return None


def automation_display_name(target):
    return f"Ground Truth Feedback Author ({target})"


def extract_automation_prompt(markdown):
    """The ```text block under `## Automation Prompt` in the prompt fixture."""
    m = re.search(r"^## Automation Prompt\s*\n+```text\n(.*?)\n```", markdown or "", re.DOTALL | re.MULTILINE)
    if not m:
        raise ValueError("No '## Automation Prompt' ```text block found in the prompt fixture")
    return m.group(1).strip()


def render_prompt(template, skill_version):
    if not template.startswith(PROMPT_PREFIX):
        raise ValueError(f"Automation prompt must start with {PROMPT_PREFIX!r}")
    missing = [p for p in REQUIRED_PLACEHOLDERS if p not in template]
    if missing:
        raise ValueError(f"Automation prompt is missing placeholders: {missing}")
    if "__SKILL_VERSION__" not in template:
        raise ValueError("Automation prompt must contain __SKILL_VERSION__")
    return template.replace("__SKILL_VERSION__", skill_version)

# COMMAND ----------

# DBTITLE 1,Resolve paths, read the skill and the prompt
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
me = w.current_user.me()
uid = me.id
print(f"Owner: {me.user_name} (id {uid})")

# Notebook is at <bundle_root>/src/notebooks/<name>; go up 3 path segments.
ctx = dbutils.notebook.entry_point.getDbutils().notebook().getContext()
bundle_root = "/".join(ctx.notebookPath().get().split("/")[:-3])
fs_root = bundle_root if bundle_root.startswith("/Workspace/") else f"/Workspace{bundle_root}"
print(f"Bundle root: {fs_root}")

bundle_target = bundle_target_param or target_from_bundle_root(bundle_root)
if not bundle_target:
    raise ValueError("Cannot infer the bundle target from the notebook path; pass the bundle_target parameter")
AUTOMATION_DISPLAY_NAME = automation_display_name(bundle_target)

with open(f"{fs_root}/{skill_rel_path}") as f:
    skill_text = f.read()
skill_version = parse_skill_version(skill_text)
if not skill_version:
    raise ValueError(f"{skill_rel_path} has no 'version:' in its frontmatter")

with open(f"{fs_root}/{prompt_path}") as f:
    user_prompt = render_prompt(extract_automation_prompt(f.read()), skill_version)

print(f"Automation: {AUTOMATION_DISPLAY_NAME}; skill {SKILL_NAME} {skill_version}; prompt {len(user_prompt)} chars")
print(user_prompt)

# COMMAND ----------

# DBTITLE 1,Copy the skill to the owner's Genie Code skills (never downgrade)
import os

user_skills_root = f"/Workspace/Users/{me.user_name}/.assistant/skills"
if os.path.isdir(user_skills_root):
    dest = f"{user_skills_root}/{SKILL_NAME}/SKILL.md"
    existing_version = None
    if os.path.exists(dest):
        with open(dest) as f:
            existing_version = parse_skill_version(f.read())
    if should_copy_skill(skill_version, existing_version):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            f.write(skill_text)
        print(f"Copied skill {skill_version} to {dest} (was {existing_version or 'absent'})")
    else:
        print(f"Kept {dest}: version {existing_version} >= {skill_version}")
else:
    print(f"{user_skills_root} does not exist; not copying the skill")

# COMMAND ----------

# DBTITLE 1,Create or update the automation (no schedule, no trigger)
import os
import sys
from datetime import datetime, timezone

from databricks.sdk.errors import NotFound

# genie_automation_lib.py sits next to this notebook (a plain .py file, so it stays importable).
nb_dir = f"{fs_root}/src/notebooks"
if nb_dir not in sys.path:
    sys.path.insert(0, nb_dir)
import genie_automation_lib as gal

INSIGHTS = "/api/2.0/alerts-internal/scheduled-insights"


def get_automation(cid):
    """The automation, or None when it no longer exists."""
    try:
        raw = w.api_client.do("GET", f"{INSIGHTS}/{gal.insight_id(cid)}", query={"name": cid})
    except NotFound:
        return None
    return raw.get("scheduled_insight", raw) if isinstance(raw, dict) else None


def list_automations():
    items, token = [], None
    while True:
        query = {"parent_asset_name": f"users/{uid}"}
        if token:
            query["page_token"] = token
        resp = w.api_client.do("GET", f"{INSIGHTS}-list/GENIE_CODE", query=query)
        items.extend(resp.get("scheduled_insights", []))
        token = resp.get("next_page_token")
        if not token:
            return items


# 1. The id on the feedback_pipeline job (gone after a bundle deploy resets the task to the placeholder)
job_cid = None
if feedback_job_id:
    job = w.api_client.do("GET", "/api/2.1/jobs/get", query={"job_id": feedback_job_id})
    job_cid = gal.configuration_id_on_job(job.get("settings"))
print(f"id on {gal.TASK_KEY}: {job_cid or '<none: placeholder or no job id>'}")

# 2. The id recorded by the previous run
state_path = gal.state_file_path(fs_root)
recorded_cid = None
if os.path.exists(state_path):
    with open(state_path) as f:
        recorded_cid = gal.read_state(f.read())
print(f"id in {state_path}: {recorded_cid or '<none>'}")

# 3. Listed automations (unscheduled ones are usually not listed)
existing = list_automations()
print(f"Listed {len(existing)} GENIE_CODE automations")
if any(a.get("display_name") == "Ground Truth Feedback Loop" for a in existing):
    print("note: the pre-build-4 automation 'Ground Truth Feedback Loop' still exists; it is no longer used")

cleanup_duplicates = gal.parse_bool(cleanup_duplicates_param, default=True)
extra_ids = [gal.configuration_id_for(i, uid) for i in gal.parse_id_list(duplicate_ids_param)]
fetched = {}


def exists(cid):
    fetched[cid] = get_automation(cid)
    return fetched[cid] is not None


plan = gal.resolve_automation(
    AUTOMATION_DISPLAY_NAME,
    job_configuration_id=job_cid,
    recorded_configuration_id=recorded_cid,
    previous_configuration_id=gal.configuration_id_for(previous_configuration_id, uid) if previous_configuration_id else None,
    listed=existing,
    exists=exists,
    extra_duplicate_ids=extra_ids,
)
print(f"plan: {plan['action']} (source {plan['source']}); duplicates {plan['duplicates']}; stale {plan['stale']}")

if plan["action"] == "create":
    resp = w.api_client.do(
        "POST",
        "/api/2.0/alerts-internal/scheduled-insights",
        body={
            "parent_asset_name": f"users/{uid}",
            "scheduled_insight": {
                "insight_type": "GENIE_CODE",
                "user_prompt": user_prompt,
                "display_name": AUTOMATION_DISPLAY_NAME,
            },
        },
    )
    configuration_id = resp["name"]
    print(f"Created automation {configuration_id}")
else:
    configuration_id = plan["configuration_id"]
    insight_id = gal.insight_id(configuration_id)
    current = fetched.get(configuration_id) or get_automation(configuration_id) or {}
    fields = gal.update_mask(current, user_prompt, AUTOMATION_DISPLAY_NAME)
    if not fields:
        print(f"Automation {configuration_id} is up to date (skill {skill_version})")
    else:
        w.api_client.do(
            "PATCH",
            f"{INSIGHTS}/{insight_id}",
            body={
                "insight_id": insight_id,
                "update_mask": ",".join(fields),
                "etag": current.get("etag"),
                "scheduled_insight": {
                    "name": configuration_id,
                    "user_prompt": user_prompt,
                    "display_name": AUTOMATION_DISPLAY_NAME,
                },
            },
        )
        print(f"Updated {fields} of {configuration_id} in place (skill {skill_version})")

# Record the id outside the synced bundle files, so the next run reuses it even after a bundle deploy.
os.makedirs(os.path.dirname(state_path), exist_ok=True)
with open(state_path, "w") as f:
    f.write(gal.state_json(configuration_id, AUTOMATION_DISPLAY_NAME, skill_version,
                           datetime.now(timezone.utc).isoformat()))
print(f"Recorded {configuration_id} in {state_path}")

# Duplicates: only feedback-author automations are ever deleted.
if plan["duplicates"] and not cleanup_duplicates:
    print(f"cleanup_duplicates=false: leaving {len(plan['duplicates'])} duplicate(s): {plan['duplicates']}")
elif plan["duplicates"]:
    for dup in plan["duplicates"]:
        current_dup = fetched.get(dup) or get_automation(dup)
        if current_dup is None:
            print(f"duplicate {dup}: already gone")
        elif not gal.is_feedback_author(current_dup, PROMPT_PREFIX, AUTOMATION_DISPLAY_NAME):
            print(f"duplicate {dup}: NOT deleted (not a feedback-author automation: {current_dup.get('display_name')!r})")
        else:
            w.api_client.do("DELETE", f"{INSIGHTS}/{gal.insight_id(dup)}", query={"name": dup})
            print(f"duplicate {dup}: deleted")

# COMMAND ----------

# DBTITLE 1,Validate
insight_id = configuration_id.split("/")[-1]
raw = w.api_client.do(
    "GET", f"/api/2.0/alerts-internal/scheduled-insights/{insight_id}", query={"name": configuration_id}
)
v = raw.get("scheduled_insight", raw) if isinstance(raw, dict) else {}

assert configuration_id.startswith("genie_code/users/"), f"Unexpected configuration_id {configuration_id}"
if v.get("insight_type"):
    assert v["insight_type"] == "GENIE_CODE", f"Expected GENIE_CODE, got {v['insight_type']}"
if v.get("display_name"):
    assert v["display_name"] == AUTOMATION_DISPLAY_NAME, f"Display name mismatch: {v['display_name']}"
if v.get("user_prompt"):
    assert v["user_prompt"].startswith(PROMPT_PREFIX), "user_prompt does not start with the feedback author prompt"
    assert f"expected skill version: {skill_version}" in v["user_prompt"], "user_prompt has a stale skill version"
for key in ("schedule", "trigger", "cron_schedule"):
    assert not v.get(key), f"Automation must have no {key} (the feedback_pipeline job drives it): {v.get(key)}"
print(f"Validation passed: {configuration_id} ({AUTOMATION_DISPLAY_NAME}, skill {skill_version})")

# COMMAND ----------

# DBTITLE 1,Emit outputs
dbutils.jobs.taskValues.set(key="configuration_id", value=configuration_id)
dbutils.jobs.taskValues.set(key="skill_version", value=skill_version)
print(f"taskValues: configuration_id={configuration_id}, skill_version={skill_version}")