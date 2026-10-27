# Databricks notebook source
# MAGIC %md
# MAGIC # Register Feedback Branch
# MAGIC
# MAGIC **Job:** `feedback_pipeline`, task 4 of 4 (after the `author_feedback_branch` Genie Code task).
# MAGIC
# MAGIC 1. Parse the Genie Code JSON summary `{branch, files, asset_ids, skipped, batch_id, skill_version}` from
# MAGIC    `{{tasks.author_feedback_branch.output.response}}` (falls back to the Jobs API run output when the parameter is empty).
# MAGIC 2. Check the branch name is `mg-genie-feedback-<run_date>` (or `-2`, `-3`, ...) and that it exists on the remote (`git ls-remote`).
# MAGIC 3. `POST /api/steward/feedback-branches` on the app as the M2M service principal (status `proposed`), which upserts
# MAGIC    `app.feedback_batches` and notifies stewards in-app. The batch's vote ids are sent as `voteIds` so the app marks them processed.
# MAGIC
# MAGIC `dry_run=true` stops before the POST. A summary with `branch: null` (nothing applied) registers nothing.
# MAGIC
# MAGIC **Design source:** `docs/plans/27_infra_feedback_pipeline_genie_task.md`, build conventions §9 (calling the app from jobs).
# MAGIC Pure helpers are unit-tested in `tests/test_feedback_pipeline.py`.

# COMMAND ----------

# DBTITLE 1,Install latest Databricks SDK
# MAGIC %pip install --upgrade databricks-sdk

# COMMAND ----------

dbutils.library.restartPython()

# COMMAND ----------

# DBTITLE 1,Parameters
dbutils.widgets.text("batch_id", "", "Batch id (collect_feedback)")
dbutils.widgets.text("run_date", "", "Run date yyyymmdd (collect_feedback)")
dbutils.widgets.text("feedback_table", "", "Staging table (collect_feedback)")
dbutils.widgets.text("branch_prefix", "mg-genie-feedback-", "Feedback branch prefix")
dbutils.widgets.text("repo_path", "", "Workspace Git folder of the repo")
dbutils.widgets.text("dry_run", "false", "Dry run (no POST)")
dbutils.widgets.text("genie_response", "", "author_feedback_branch final response")
dbutils.widgets.text("job_run_id", "", "Job run id (fallback lookup)")
dbutils.widgets.text("bundle_target", "dev", "Bundle target")
dbutils.widgets.text("app_name", "", "App name (default from bundle_target)")
dbutils.widgets.text("secret_scope", "semantic_ground_truth_credentials", "Secret scope")
dbutils.widgets.text("m2m_client_id_key", "", "Secret key: M2M client id")
dbutils.widgets.text("m2m_client_secret_key", "", "Secret key: M2M client secret")

p = {k: dbutils.widgets.get(k).strip() for k in [
    "batch_id", "run_date", "feedback_table", "branch_prefix", "repo_path", "dry_run",
    "genie_response", "job_run_id", "bundle_target", "app_name", "secret_scope",
    "m2m_client_id_key", "m2m_client_secret_key",
]}
for k, v in p.items():
    if k != "genie_response":
        print(f"{k}={v}")
print(f"genie_response: {len(p['genie_response'])} chars")

# COMMAND ----------

# DBTITLE 1,Pure helpers
# --- pure helpers (stdlib only; unit-tested in tests/test_feedback_pipeline.py) ---
import json
import re

FEEDBACK_BRANCH_PREFIX = "mg-genie-feedback-"
_RUN_DATE = re.compile(r"^\d{8}$")
_FQ_TABLE = re.compile(r"^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$")


def _check_prefix_and_date(prefix, run_date):
    if prefix != FEEDBACK_BRANCH_PREFIX:
        raise ValueError(f"branch_prefix must be exactly {FEEDBACK_BRANCH_PREFIX!r}, got {prefix!r}")
    if not _RUN_DATE.match(run_date or ""):
        raise ValueError(f"run_date must be yyyymmdd, got {run_date!r}")


def next_branch_name(prefix, run_date, existing):
    """mg-genie-feedback-<yyyymmdd>, then -2, -3, ... when the name is already taken."""
    _check_prefix_and_date(prefix, run_date)
    taken = set(existing or [])
    base = f"{prefix}{run_date}"
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def is_valid_feedback_branch(name, prefix, run_date):
    """True for <prefix><run_date> or <prefix><run_date>-<n> with n >= 2."""
    _check_prefix_and_date(prefix, run_date)
    m = re.fullmatch(re.escape(prefix + run_date) + r"(?:-(\d+))?", name or "")
    return bool(m) and (m.group(1) is None or int(m.group(1)) >= 2)


def parse_remote_heads(ls_remote_output):
    """Branch names from `git ls-remote --heads` output."""
    heads = set()
    for line in (ls_remote_output or "").splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].startswith("refs/heads/"):
            heads.add(parts[1][len("refs/heads/"):])
    return heads


def _normalize_summary(obj):
    branch = obj.get("branch")
    if branch is not None and not isinstance(branch, str):
        raise ValueError(f"summary.branch must be a string or null, got {branch!r}")
    return {
        "branch": branch or None,
        "files": [str(f) for f in obj.get("files") or []],
        "asset_ids": [str(a) for a in obj.get("asset_ids") or []],
        "skipped": list(obj.get("skipped") or []),
        "batch_id": obj.get("batch_id"),
        "skill_version": obj.get("skill_version"),
    }


def parse_genie_summary(text):
    """Parse the last JSON summary (an object with a `branch` key) from a Genie Code response.

    Prefers fenced ```json blocks (last one wins); falls back to the last bare JSON object.
    Raises ValueError when no summary is found.
    """
    text = text or ""
    for block in reversed(re.findall(r"```(?:json)?\s*\n(.*?)```", text, re.DOTALL)):
        try:
            obj = json.loads(block)
        except ValueError:
            continue
        if isinstance(obj, dict) and "branch" in obj:
            return _normalize_summary(obj)
    decoder = json.JSONDecoder()
    for start in reversed([i for i, ch in enumerate(text) if ch == "{"]):
        try:
            obj, _ = decoder.raw_decode(text[start:])
        except ValueError:
            continue
        if isinstance(obj, dict) and "branch" in obj:
            return _normalize_summary(obj)
    raise ValueError("No JSON summary with a 'branch' key found in the Genie Code response")


def build_upsert_body(summary, batch_id, vote_ids):
    """UpsertFeedbackBranchRequest {batchId?, branchName, files, summary?, status} (+ voteIds, see session 27 request).

    `batchId` is NOT sent: in the app contract it is the id of an existing `app.feedback_batches` row
    (the app answers 404 when it does not exist), while `batch_id` here is the staging batch id from
    collect_feedback. Without it the app upserts by `branchName`. The staging batch id goes in `summary`.
    """
    skipped = summary.get("skipped") or []
    text = (
        f"{len(summary.get('asset_ids') or [])} asset(s) changed in {len(summary.get('files') or [])} file(s); "
        f"{len(skipped)} skipped; skill ground-truth-feedback-author {summary.get('skill_version') or 'unknown'}; "
        f"staging batch {batch_id}"
    )
    return {
        "branchName": summary["branch"],
        "files": list(summary.get("files") or []),
        "summary": text,
        "status": "proposed",
        "voteIds": list(vote_ids),
    }


def default_app_name(bundle_target):
    """App bundle names: dev-semantic-ground-truth (dev), semantic-ground-truth (prod)."""
    return "dev-semantic-ground-truth" if bundle_target == "dev" else "semantic-ground-truth"


def quote_table(fq_name):
    if not _FQ_TABLE.match(fq_name or ""):
        raise ValueError(f"feedback_table must be catalog.schema.table, got {fq_name!r}")
    return ".".join(f"`{part}`" for part in fq_name.split("."))

# COMMAND ----------

# DBTITLE 1,Get the Genie Code summary
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
_check_prefix_and_date(p["branch_prefix"], p["run_date"])
if not p["batch_id"]:
    raise ValueError("batch_id is empty; collect_feedback must stage a batch first")

response = p["genie_response"]
if not response or response.startswith("{{"):
    # Fallback: read the agent's final response from the Jobs API.
    if not p["job_run_id"] or p["job_run_id"].startswith("{{"):
        raise ValueError("genie_response is empty and job_run_id is not set")
    run = w.api_client.do("GET", "/api/2.2/jobs/runs/get", query={"run_id": p["job_run_id"]})
    task_run = next((t for t in run.get("tasks", []) if t.get("task_key") == "author_feedback_branch"), None)
    if not task_run:
        raise ValueError("author_feedback_branch task run not found in this job run")
    out = w.api_client.do("GET", "/api/2.2/jobs/runs/get-output", query={"run_id": task_run["run_id"]})
    response = (((out.get("genie_task_output") or {}).get("agent_output") or {}).get("response")) or ""
    print(f"Read final response from runs/get-output ({len(response)} chars)")

summary = parse_genie_summary(response)
print(json.dumps(summary, indent=2))
if summary["batch_id"] and summary["batch_id"] != p["batch_id"]:
    raise ValueError(f"Summary batch_id {summary['batch_id']} does not match this run's batch {p['batch_id']}")

# COMMAND ----------

# DBTITLE 1,Nothing applied: register nothing
if summary["branch"] is None:
    print(f"Genie Code applied no edits ({len(summary['skipped'])} skipped); no branch to register.")
    dbutils.jobs.taskValues.set(key="branch", value="")
    dbutils.notebook.exit("no_branch")

# COMMAND ----------

# DBTITLE 1,Verify the branch name and that it exists on the remote
import os
import subprocess

branch = summary["branch"]
if not is_valid_feedback_branch(branch, p["branch_prefix"], p["run_date"]):
    raise ValueError(
        f"Branch {branch!r} is not {p['branch_prefix']}{p['run_date']}[-n]; refusing to register it"
    )

repo_path = p["repo_path"]
if not repo_path.startswith("/Workspace/"):
    repo_path = "/Workspace" + repo_path
remote_url = w.repos.get(w.workspace.get_status(repo_path).object_id).url
ls = subprocess.run(
    ["git", "ls-remote", "--heads", remote_url, f"refs/heads/{branch}"],
    capture_output=True, text=True, timeout=120,
    env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
)
if ls.returncode != 0:
    raise RuntimeError(f"git ls-remote failed ({ls.returncode}): {ls.stderr.strip()[:300]}")
if branch not in parse_remote_heads(ls.stdout):
    raise RuntimeError(f"Branch {branch} was reported by Genie Code but does not exist on {remote_url}")
print(f"Branch {branch} exists on {remote_url}")

# COMMAND ----------

# DBTITLE 1,Collect the batch's vote ids
vote_ids = sorted({
    v
    for r in spark.sql(
        f"SELECT vote_ids FROM {quote_table(p['feedback_table'])} WHERE batch_id = :batch_id",
        args={"batch_id": p["batch_id"]},
    ).collect()
    for v in (r["vote_ids"] or [])
})
if not vote_ids:
    raise ValueError(f"No staged votes for batch {p['batch_id']} in {p['feedback_table']}")
body = build_upsert_body(summary, p["batch_id"], vote_ids)
print(json.dumps({**body, "voteIds": f"<{len(vote_ids)} ids>"}, indent=2))

# COMMAND ----------

# DBTITLE 1,Register the branch with the app (M2M)
import requests

if p["dry_run"].lower() == "true":
    print("dry_run=true: not calling the app")
    dbutils.jobs.taskValues.set(key="branch", value=branch)
    dbutils.notebook.exit("dry_run")

if not p["m2m_client_id_key"] or not p["m2m_client_secret_key"]:
    raise ValueError("m2m_client_id_key and m2m_client_secret_key are required")
app_name = p["app_name"] or default_app_name(p["bundle_target"])
app_url = (w.apps.get(app_name).url or "").rstrip("/")
if not app_url:
    raise RuntimeError(f"App {app_name} has no URL (not deployed?)")

m2m = WorkspaceClient(
    host=w.config.host,
    client_id=dbutils.secrets.get(p["secret_scope"], p["m2m_client_id_key"]),
    client_secret=dbutils.secrets.get(p["secret_scope"], p["m2m_client_secret_key"]),
    auth_type="oauth-m2m",
)
resp = requests.post(
    f"{app_url}/api/steward/feedback-branches",
    json=body,
    headers={**m2m.config.authenticate(), "Content-Type": "application/json"},
    allow_redirects=False,
    timeout=60,
)
if resp.status_code in (301, 302, 303, 307, 308, 401, 403):
    raise RuntimeError(
        f"App rejected the M2M caller (HTTP {resp.status_code}). The M2M service principal needs CAN_USE on "
        f"{app_name} and the admin role in the app (GT_BOOTSTRAP_ADMIN_IDS)."
    )
if not resp.ok:
    raise RuntimeError(f"POST /api/steward/feedback-branches failed (HTTP {resp.status_code}): {resp.text[:500]}")
print(f"Registered {branch} for batch {p['batch_id']} (HTTP {resp.status_code})")

dbutils.jobs.taskValues.set(key="branch", value=branch)
dbutils.jobs.taskValues.set(key="file_count", value=len(body["files"]))
