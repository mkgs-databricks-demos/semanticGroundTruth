"""Unit tests for genie_automation_lib (build 5, session 46, follow-up 1: one Genie Code automation).

Run from the repo root:
    python -m pytest ground-truth-infra/tests/test_genie_automation_lib.py
In a Databricks workspace folder (no __pycache__ allowed):
    PYTHONDONTWRITEBYTECODE=1 python -B -m pytest -p no:cacheprovider ground-truth-infra/tests/test_genie_automation_lib.py
"""

import importlib.util
import json
from pathlib import Path

import pytest

LIB_PATH = Path(__file__).resolve().parents[1] / "src" / "notebooks" / "genie_automation_lib.py"


def _load():
    spec = importlib.util.spec_from_file_location("genie_automation_lib", LIB_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


lib = _load()

UID = "1081964970114387"
NAME = "Ground Truth Feedback Author (dev)"
PREFIX = "You are the Semantic Ground Truth feedback author"


def cid(hex_char):
    return f"genie_code/users/{UID}/scheduled_insights/{hex_char * 32}"


A, B, C, D, E = (cid(x) for x in "abcde")


def job_with(task):
    return {"tasks": [{"task_key": "collect_feedback", "notebook_task": {}}, task]}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def test_lib_has_no_databricks_imports():
    source = LIB_PATH.read_text()
    assert "databricks" not in "\n".join(l for l in source.splitlines() if l.startswith(("import ", "from ")))
    assert "dbutils" not in source.replace("`dbutils`", "")


def test_insight_id_and_validation():
    assert lib.insight_id(A) == "a" * 32
    assert lib.is_configuration_id(A)
    for bad in (None, "", "a" * 32, "genie_code/users/1/scheduled_insights/xyz", "foo/users/1/scheduled_insights/" + "a" * 32):
        assert not lib.is_configuration_id(bad)


def test_configuration_id_for_accepts_full_or_bare_id():
    assert lib.configuration_id_for(A, UID) == A
    assert lib.configuration_id_for(" " + "b" * 32 + " ", UID) == B
    with pytest.raises(ValueError):
        lib.configuration_id_for("not-an-id", UID)


def test_configuration_id_on_job():
    patched = job_with({"task_key": "author_feedback_branch", "genie_task": {"configuration_id": A, "parameters": {}}})
    assert lib.configuration_id_on_job(patched) == A
    placeholder = job_with({"task_key": "author_feedback_branch", "notebook_task": {"base_parameters": {}}})
    assert lib.configuration_id_on_job(placeholder) is None
    assert lib.configuration_id_on_job({"tasks": []}) is None
    assert lib.configuration_id_on_job(None) is None
    malformed = job_with({"task_key": "author_feedback_branch", "genie_task": {"configuration_id": "junk"}})
    assert lib.configuration_id_on_job(malformed) is None


def test_parse_id_list_and_bool():
    assert lib.parse_id_list(" a, b\nb ,,c ") == ["a", "b", "c"]
    assert lib.parse_id_list("") == []
    assert lib.parse_bool("TRUE") is True
    assert lib.parse_bool("false") is False
    assert lib.parse_bool("", default=True) is True
    with pytest.raises(ValueError):
        lib.parse_bool("maybe")


def test_state_file_path_outside_synced_files():
    deployed = "/Workspace/Users/u@x.com/.bundle/semantic-ground-truth-infra/dev/files"
    assert lib.state_file_path(deployed) == (
        "/Workspace/Users/u@x.com/.bundle/semantic-ground-truth-infra/dev/setup_state/genie_automation.json"
    )
    git_folder = "/Workspace/Users/u@x.com/semanticGroundTruth/ground-truth-infra/"
    assert lib.state_file_path(git_folder) == (
        "/Workspace/Users/u@x.com/semanticGroundTruth/ground-truth-infra/.databricks/setup_state/genie_automation.json"
    )
    with pytest.raises(ValueError):
        lib.state_file_path("")


def test_state_round_trip():
    text = lib.state_json(A, NAME, "1.0.0", "2026-10-27T00:00:00+00:00")
    assert json.loads(text)["configuration_id"] == A
    assert lib.read_state(text) == A
    assert lib.read_state("") is None
    assert lib.read_state("{not json") is None
    assert lib.read_state(json.dumps({"configuration_id": "junk"})) is None
    assert lib.read_state(json.dumps([A])) is None
    with pytest.raises(ValueError):
        lib.state_json("junk", NAME, "1.0.0", "now")


# ---------------------------------------------------------------------------
# resolve_automation (the selection rules from the session 46 plan)
# ---------------------------------------------------------------------------

def test_existing_id_on_job_wins():
    listed = [{"name": C, "display_name": NAME, "create_timestamp": "2026-10-27T10:00:00Z"}]
    plan = lib.resolve_automation(NAME, job_configuration_id=A, recorded_configuration_id=B, listed=listed)
    assert plan["action"] == "update"
    assert plan["configuration_id"] == A
    assert plan["source"] == "job"
    assert plan["duplicates"] == [B, C]
    assert plan["stale"] == []


def test_same_id_on_job_and_state_is_not_a_duplicate():
    plan = lib.resolve_automation(NAME, job_configuration_id=A, recorded_configuration_id=A)
    assert (plan["configuration_id"], plan["source"], plan["duplicates"]) == (A, "job", [])


def test_state_file_used_after_bundle_deploy_reset_the_task():
    plan = lib.resolve_automation(NAME, job_configuration_id=None, recorded_configuration_id=B)
    assert (plan["action"], plan["configuration_id"], plan["source"]) == ("update", B, "state")


def test_previous_id_from_deploy_sh_wins_over_state_after_a_deploy():
    # deploy.sh read A from the job before `bundle deploy` reset the task; no state file yet (first run).
    plan = lib.resolve_automation(NAME, job_configuration_id=None, previous_configuration_id=A)
    assert (plan["action"], plan["configuration_id"], plan["source"], plan["duplicates"]) == ("update", A, "previous", [])
    plan = lib.resolve_automation(NAME, previous_configuration_id=A, recorded_configuration_id=B)
    assert (plan["configuration_id"], plan["duplicates"]) == (A, [B])


def test_job_id_wins_over_previous_id():
    plan = lib.resolve_automation(NAME, job_configuration_id=A, previous_configuration_id=B)
    assert (plan["configuration_id"], plan["source"], plan["duplicates"]) == (A, "job", [B])
    same = lib.resolve_automation(NAME, job_configuration_id=A, previous_configuration_id=A)
    assert (same["configuration_id"], same["duplicates"]) == (A, [])


def test_deleted_job_id_falls_back_and_is_stale_not_duplicate():
    plan = lib.resolve_automation(
        NAME, job_configuration_id=A, recorded_configuration_id=B, exists=lambda c: c != A
    )
    assert (plan["configuration_id"], plan["source"]) == (B, "state")
    assert plan["stale"] == [A]
    assert plan["duplicates"] == []


def test_falls_back_to_newest_by_name():
    listed = [
        {"name": C, "display_name": NAME, "create_timestamp": "2026-10-25T10:00:00Z"},
        {"name": D, "display_name": NAME, "create_timestamp": "2026-10-27T10:00:00Z"},
        {"name": E, "display_name": "Some other automation", "create_timestamp": "2026-10-28T10:00:00Z"},
    ]
    plan = lib.resolve_automation(NAME, listed=listed)
    assert (plan["action"], plan["configuration_id"], plan["source"]) == ("update", D, "name")
    assert plan["duplicates"] == [C]


def test_newest_by_name_with_numeric_timestamps():
    listed = [
        {"name": C, "display_name": NAME, "create_timestamp": 1761500000000},
        {"name": D, "display_name": NAME, "create_timestamp": "1761600000000"},
    ]
    assert lib.resolve_automation(NAME, listed=listed)["configuration_id"] == D


def test_creates_when_none_exists():
    plan = lib.resolve_automation(NAME, listed=[{"name": E, "display_name": "Other"}])
    assert plan == {"action": "create", "configuration_id": None, "source": "none", "duplicates": [], "stale": []}


def test_creates_when_every_candidate_is_gone():
    plan = lib.resolve_automation(NAME, job_configuration_id=A, recorded_configuration_id=B, exists=lambda c: False)
    assert plan["action"] == "create"
    assert plan["stale"] == [A, B]
    assert plan["duplicates"] == []


def test_duplicates_listed_for_deletion_include_extra_ids_but_never_the_kept_one():
    listed = [{"name": C, "display_name": NAME, "create_timestamp": "2026-10-27T10:00:00Z"}]
    plan = lib.resolve_automation(NAME, job_configuration_id=A, listed=listed, extra_duplicate_ids=[D, A, D])
    assert plan["configuration_id"] == A
    assert plan["duplicates"] == [C, D]


def test_extra_ids_must_be_configuration_ids():
    with pytest.raises(ValueError):
        lib.resolve_automation(NAME, extra_duplicate_ids=["d" * 32])


def test_exists_called_once_per_candidate_and_not_after_a_match():
    calls = []

    def exists(c):
        calls.append(c)
        return True

    lib.resolve_automation(NAME, job_configuration_id=A, recorded_configuration_id=B, exists=exists)
    assert calls == [A]


# ---------------------------------------------------------------------------
# Update and delete guards
# ---------------------------------------------------------------------------

def test_update_mask():
    assert lib.update_mask({"user_prompt": "p", "display_name": NAME}, "p", NAME) == []
    assert lib.update_mask({"user_prompt": "old"}, "p", NAME) == ["user_prompt", "display_name"]
    assert lib.update_mask(None, "p", NAME) == ["user_prompt", "display_name"]


def test_is_feedback_author():
    assert lib.is_feedback_author({"user_prompt": PREFIX + " ..."}, PREFIX, NAME)
    assert lib.is_feedback_author({"display_name": NAME}, PREFIX, NAME)
    assert not lib.is_feedback_author({"user_prompt": "# End-of-Day Trade Journal"}, PREFIX, NAME)
    assert not lib.is_feedback_author(None, PREFIX, NAME)
