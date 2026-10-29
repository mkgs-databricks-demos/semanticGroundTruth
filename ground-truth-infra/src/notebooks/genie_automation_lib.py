"""Pure selection logic for setup_genie_automation (build 5, session 46, follow-up 1).

No Databricks imports: the notebook passes in what it read from the APIs, so
`tests/test_genie_automation_lib.py` runs this without a workspace.

Why the automation is not simply looked up by name: an automation created without a
schedule is not returned by `GET /api/2.0/alerts-internal/scheduled-insights-list/GENIE_CODE`,
and its `display_name` is not kept by the create call (checked 2026-10-27: the build-4 ids
`e9bdf433...` and `20536fcd...` both resolve with GET, neither is listed, neither has a
display name). The name lookup never matched, so every `post_deploy_setup` run created a new
automation. The id to reuse therefore comes, in order, from:

1. the `genie_task.configuration_id` of `feedback_pipeline.author_feedback_branch`
   (present when the job is still patched, i.e. no `bundle deploy` since the last setup run);
2. `previous_configuration_id`: the id `deploy.sh` read from that task just before the infra
   deploy reset it (covers the first run, before any state file exists);
3. the state file the notebook writes next to the deployed bundle (survives `bundle deploy`,
   which resets the task to its notebook placeholder);
4. the newest listed automation with the expected display name (in case the list API starts
   returning unscheduled automations);

and an automation is created only when none of these exists.
"""

import json
import re

TASK_KEY = "author_feedback_branch"
CONFIG_ID_PREFIX = "genie_code/users/"
STATE_FILE_NAME = "genie_automation.json"
_INSIGHT_ID = re.compile(r"^[0-9a-f]{32}$")


def insight_id(configuration_id):
    """genie_code/users/<uid>/scheduled_insights/<iid> -> <iid>."""
    return (configuration_id or "").rstrip("/").split("/")[-1]


def is_configuration_id(value):
    return (
        isinstance(value, str)
        and value.startswith(CONFIG_ID_PREFIX)
        and "/scheduled_insights/" in value
        and bool(_INSIGHT_ID.match(insight_id(value)))
    )


def configuration_id_for(value, user_id):
    """Accept a full configuration id or a bare 32-hex insight id (owned by `user_id`)."""
    value = (value or "").strip()
    if is_configuration_id(value):
        return value
    if _INSIGHT_ID.match(value):
        return f"{CONFIG_ID_PREFIX}{user_id}/scheduled_insights/{value}"
    raise ValueError(f"Not a Genie Code automation id: {value!r}")


def configuration_id_on_job(job_settings, task_key=TASK_KEY):
    """The genie_task configuration_id of `task_key`, or None (task missing, still a placeholder, or malformed)."""
    for task in (job_settings or {}).get("tasks") or []:
        if task.get("task_key") == task_key:
            cid = (task.get("genie_task") or {}).get("configuration_id")
            return cid if is_configuration_id(cid) else None
    return None


def parse_id_list(text):
    """Comma- or newline-separated ids, stripped, de-duplicated, order kept."""
    out = []
    for part in (text or "").replace("\n", ",").split(","):
        part = part.strip()
        if part and part not in out:
            out.append(part)
    return out


def parse_bool(text, default=False):
    if text is None or str(text).strip() == "":
        return default
    value = str(text).strip().lower()
    if value in ("true", "1", "yes"):
        return True
    if value in ("false", "0", "no"):
        return False
    raise ValueError(f"Not a boolean: {text!r}")


def state_file_path(bundle_root):
    """Where the chosen configuration_id is recorded.

    Deployed bundle (<root_path>/files): <root_path>/setup_state/genie_automation.json, outside the
    synced files/ folder so `bundle deploy` never overwrites or deletes it.
    Anything else (e.g. run from the Git folder): <bundle_root>/.databricks/setup_state/..., which is gitignored.
    """
    root = (bundle_root or "").rstrip("/")
    if not root:
        raise ValueError("bundle_root is empty")
    if "/.bundle/" in root and root.endswith("/files"):
        return f"{root[: -len('/files')]}/setup_state/{STATE_FILE_NAME}"
    return f"{root}/.databricks/setup_state/{STATE_FILE_NAME}"


def read_state(text):
    """configuration_id from the state file text, or None when absent/unreadable."""
    try:
        data = json.loads(text or "")
    except ValueError:
        return None
    cid = data.get("configuration_id") if isinstance(data, dict) else None
    return cid if is_configuration_id(cid) else None


def state_json(configuration_id, display_name, skill_version, updated_at):
    if not is_configuration_id(configuration_id):
        raise ValueError(f"Not a configuration id: {configuration_id!r}")
    return json.dumps(
        {
            "configuration_id": configuration_id,
            "display_name": display_name,
            "skill_version": skill_version,
            "updated_at": updated_at,
        },
        indent=2,
        sort_keys=True,
    ) + "\n"


def _created_key(automation):
    value = automation.get("create_timestamp") or automation.get("create_time") or ""
    try:
        return (1, float(value), "")
    except (TypeError, ValueError):
        return (0, 0.0, str(value))


def resolve_automation(display_name, job_configuration_id=None, recorded_configuration_id=None,
                       listed=(), exists=lambda cid: True, extra_duplicate_ids=(),
                       previous_configuration_id=None):
    """Decide which automation to keep, and which others are duplicates.

    Candidates, in order: the id on the job task, the id the job had before the deploy
    (`previous_configuration_id`), the id in the state file, then listed automations
    named `display_name` (newest first). The first candidate that still exists is kept
    (`exists(cid)` is called at most once per id). Candidates that no longer exist are `stale`
    (never deleted). Every other candidate, plus `extra_duplicate_ids` (full configuration ids),
    is a duplicate. The kept id is never a duplicate.

    Returns {"action": "update" | "create", "configuration_id": str | None,
             "source": "job" | "previous" | "state" | "name" | "none", "duplicates": [...], "stale": [...]}.
    """
    alive = {}

    def exists_once(cid):
        if cid not in alive:
            alive[cid] = bool(exists(cid))
        return alive[cid]

    named = sorted(
        (a for a in (listed or ()) if a.get("display_name") == display_name and is_configuration_id(a.get("name"))),
        key=_created_key,
        reverse=True,
    )
    candidates = []
    if is_configuration_id(job_configuration_id):
        candidates.append(("job", job_configuration_id))
    if is_configuration_id(previous_configuration_id) and previous_configuration_id != job_configuration_id:
        candidates.append(("previous", previous_configuration_id))
    if is_configuration_id(recorded_configuration_id):
        candidates.append(("state", recorded_configuration_id))
    candidates.extend(("name", a["name"]) for a in named)

    keep, source, stale = None, "none", []
    for src, cid in candidates:
        if keep is not None:
            break
        if exists_once(cid):
            keep, source = cid, src
        elif cid not in stale:
            stale.append(cid)

    duplicates = []
    for cid in [c for _, c in candidates] + list(extra_duplicate_ids or ()):
        if not is_configuration_id(cid):
            raise ValueError(f"Not a configuration id: {cid!r}")
        if cid != keep and cid not in stale and cid not in duplicates:
            duplicates.append(cid)

    return {
        "action": "update" if keep else "create",
        "configuration_id": keep,
        "source": source,
        "duplicates": duplicates,
        "stale": stale,
    }


def update_mask(current, user_prompt, display_name):
    """Fields to PATCH so the kept automation matches (empty when it is up to date)."""
    current = current or {}
    fields = []
    if current.get("user_prompt") != user_prompt:
        fields.append("user_prompt")
    if current.get("display_name") != display_name:
        fields.append("display_name")
    return fields


def is_feedback_author(automation, prompt_prefix, display_name):
    """True when an automation is a feedback-author automation (safe to delete as a duplicate)."""
    automation = automation or {}
    return (automation.get("user_prompt") or "").startswith(prompt_prefix) or automation.get("display_name") == display_name
