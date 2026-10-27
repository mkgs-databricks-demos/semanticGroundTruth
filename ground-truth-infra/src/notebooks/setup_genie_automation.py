# Databricks notebook source
# DBTITLE 1,Setup Genie Code Automation
# MAGIC %md
# MAGIC # Setup Genie Code Automation
# MAGIC Creates or updates the Genie Code automation used by the `feedback_pipeline` task `author_feedback_branch` (a `genie_task`).
# MAGIC
# MAGIC * **Idempotent by display name** `Ground Truth Feedback Author (<target>)`. Created once with **no schedule and no trigger** (the job drives it). Its `user_prompt` is the § Automation Prompt block of `fixtures/prompts/feedback_loop_prompt.md` with the skill version filled in, and is updated only when it changes (i.e. when the skill version or the prompt fixture changes).
# MAGIC * The rules live in the versioned skill `fixtures/skills/ground-truth-feedback-author/SKILL.md`; Genie Code reads it at the bundle-deployed path passed as `{{skill_path}}`.
# MAGIC * If the owner's `/Workspace/Users/<owner>/.assistant/skills/` folder exists, the skill is also copied to `ground-truth-feedback-author/SKILL.md` there, unless that copy has the same or a newer `version`.
# MAGIC
# MAGIC **Design source:** `docs/plans/27_infra_feedback_pipeline_genie_task.md`, `docs/plans/post_deploy_automation_plan.md` Task 1, `docs/research/03_genie_code_workflow_tasks.md` §2–3
# MAGIC
# MAGIC **API:** `/api/2.0/alerts-internal/scheduled-insights` (list, create, patch, get)
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

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
bundle_target_param = dbutils.widgets.get("bundle_target").strip()
prompt_path = dbutils.widgets.get("prompt_path").strip()
skill_rel_path = dbutils.widgets.get("skill_path").strip()
print(f"catalog={catalog}, schema={schema}, bundle_target={bundle_target_param or '<from path>'}")
print(f"prompt_path={prompt_path}, skill_path={skill_rel_path}")

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
existing = w.api_client.do(
    "GET",
    "/api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE",
    query={"parent_asset_name": f"users/{uid}"},
).get("scheduled_insights", [])
print(f"Found {len(existing)} GENIE_CODE automations")
if any(a.get("display_name") == "Ground Truth Feedback Loop" for a in existing):
    print("note: the pre-build-4 automation 'Ground Truth Feedback Loop' still exists; it is no longer used")

matches = [a for a in existing if a.get("display_name") == AUTOMATION_DISPLAY_NAME]
if len(matches) > 1:
    raise RuntimeError(f"{len(matches)} automations named {AUTOMATION_DISPLAY_NAME!r}; delete the extras")
automation = matches[0] if matches else None

if automation is None:
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
    configuration_id = automation["name"]
    insight_id = configuration_id.split("/")[-1]
    current = w.api_client.do(
        "GET", f"/api/2.0/alerts-internal/scheduled-insights/{insight_id}", query={"name": configuration_id}
    )
    current = current.get("scheduled_insight", current)
    if (current.get("user_prompt") or automation.get("user_prompt")) == user_prompt:
        print(f"Automation {configuration_id} is up to date (skill {skill_version})")
    else:
        w.api_client.do(
            "PATCH",
            f"/api/2.0/alerts-internal/scheduled-insights/{insight_id}",
            body={
                "insight_id": insight_id,
                "update_mask": "user_prompt",
                "etag": current.get("etag") or automation["etag"],
                "scheduled_insight": {"name": configuration_id, "user_prompt": user_prompt},
            },
        )
        print(f"Updated user_prompt of {configuration_id} (skill {skill_version})")

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