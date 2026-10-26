"""Unit tests for the feedback_pipeline pure helpers (build 4, session 27, gap G4).

The helpers live in the "Pure helpers" cell of each Databricks source notebook
(marked `# --- pure helpers`). They use only the standard library, so the cell is
executed on its own here, without Spark, dbutils or the Databricks SDK.

Run from the repo root:
    python -m pytest ground-truth-infra/tests/test_feedback_pipeline.py
In a Databricks workspace folder (no __pycache__ allowed):
    PYTHONDONTWRITEBYTECODE=1 python -B -m pytest -p no:cacheprovider ground-truth-infra/tests/test_feedback_pipeline.py
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

INFRA = Path(__file__).resolve().parents[1]
NOTEBOOKS = INFRA / "src" / "notebooks"
CELL_SEPARATOR = "\n# COMMAND ----------\n"
MARKER = "# --- pure helpers"


def load_helpers(notebook_name):
    """Exec the pure-helpers cell of a Databricks .py source notebook; return its namespace."""
    source = (NOTEBOOKS / notebook_name).read_text()
    cells = [c for c in source.split(CELL_SEPARATOR) if MARKER in c]
    assert len(cells) == 1, f"{notebook_name}: expected exactly one pure-helpers cell, found {len(cells)}"
    namespace = {}
    exec(compile(cells[0], f"{notebook_name}:pure-helpers", "exec"), namespace)
    return namespace


@pytest.fixture(scope="module")
def collect():
    return load_helpers("collect_feedback.py")


@pytest.fixture(scope="module")
def register():
    return load_helpers("register_feedback_branch.py")


@pytest.fixture(scope="module")
def automation():
    return load_helpers("setup_genie_automation.py")


@pytest.fixture(scope="module")
def job_params():
    return load_helpers("setup_job_params.py")


# ---------------------------------------------------------------------------
# Branch names
# ---------------------------------------------------------------------------

PREFIX = "mg-genie-feedback-"
# The retired pre-build-4 branch prefix, built from parts so repo greps for it only find real uses.
LEGACY_PREFIX = "feedback" + "/"


def test_next_branch_name_without_collision(register):
    assert register["next_branch_name"](PREFIX, "20261024", []) == "mg-genie-feedback-20261024"


def test_next_branch_name_appends_collision_suffix(register):
    existing = {"main", "mg-genie-feedback-20261024", "mg-genie-feedback-20261024-2"}
    assert register["next_branch_name"](PREFIX, "20261024", existing) == "mg-genie-feedback-20261024-3"


def test_next_branch_name_ignores_other_dates(register):
    existing = {"mg-genie-feedback-20261023", "mg-genie-feedback-20261023-2"}
    assert register["next_branch_name"](PREFIX, "20261024", existing) == "mg-genie-feedback-20261024"


@pytest.mark.parametrize("prefix", [LEGACY_PREFIX, "mg-genie-", "mg-genie-feedback", ""])
def test_branch_prefix_other_than_owner_convention_is_rejected(register, collect, prefix):
    with pytest.raises(ValueError):
        register["next_branch_name"](prefix, "20261024", [])
    with pytest.raises(ValueError):
        collect["validate_branch_prefix"](prefix)


@pytest.mark.parametrize("run_date", ["2026-10-24", "261024", "", "2026102a"])
def test_run_date_must_be_yyyymmdd(register, run_date):
    with pytest.raises(ValueError):
        register["next_branch_name"](PREFIX, run_date, [])


@pytest.mark.parametrize(
    "name, ok",
    [
        ("mg-genie-feedback-20261024", True),
        ("mg-genie-feedback-20261024-2", True),
        ("mg-genie-feedback-20261024-11", True),
        ("mg-genie-feedback-20261024-1", False),
        ("mg-genie-feedback-20261023", False),
        ("mg-genie-feedback-20261024-x", False),
        (LEGACY_PREFIX + "2026-10-24-mv_review_activity", False),
        ("main", False),
        (None, False),
    ],
)
def test_is_valid_feedback_branch(register, name, ok):
    assert register["is_valid_feedback_branch"](name, PREFIX, "20261024") is ok


def test_run_date_str_is_utc_yyyymmdd(collect):
    assert collect["run_date_str"](datetime(2026, 10, 24, 23, 5, tzinfo=timezone.utc)) == "20261024"
    assert re.fullmatch(r"\d{8}", collect["run_date_str"]())


def test_parse_remote_heads(register):
    out = (
        "0741bc7f6251d393c2c50b138377aa6191d8b937\trefs/heads/main\n"
        "1111111111111111111111111111111111111111\trefs/heads/mg-genie-feedback-20261024\n"
        "2222222222222222222222222222222222222222\trefs/tags/v1\n"
    )
    assert register["parse_remote_heads"](out) == {"main", "mg-genie-feedback-20261024"}
    assert register["parse_remote_heads"]("") == set()


# ---------------------------------------------------------------------------
# Genie Code summary parsing
# ---------------------------------------------------------------------------

SUMMARY = {
    "branch": "mg-genie-feedback-20261024",
    "files": ["ground-truth-infra/fixtures/metric_views/mv_review_activity.yaml"],
    "asset_ids": ["9c476136-250e-498e-9d2b-e66f42a491c4"],
    "skipped": [{"asset_id": "5991...", "reason": "no_fixture_in_repo"}],
    "batch_id": "b-1",
    "skill_version": "1.0.0",
}


def test_parse_summary_from_fenced_json_block(register):
    text = "Applied 1 edit.\n\n```json\n" + json.dumps(SUMMARY, indent=2) + "\n```\n"
    assert register["parse_genie_summary"](text) == SUMMARY


def test_parse_summary_uses_the_last_summary_block(register):
    first = {**SUMMARY, "branch": "mg-genie-feedback-20261024-2"}
    text = (
        "Example:\n```json\n" + json.dumps(first) + "\n```\n"
        "Config:\n```json\n{\"not\": \"a summary\"}\n```\n"
        "Final:\n```json\n" + json.dumps(SUMMARY) + "\n```"
    )
    assert register["parse_genie_summary"](text)["branch"] == "mg-genie-feedback-20261024"


def test_parse_summary_falls_back_to_bare_json(register):
    text = "Done. Summary: " + json.dumps(SUMMARY) + " -- end"
    assert register["parse_genie_summary"](text)["files"] == SUMMARY["files"]


def test_parse_summary_null_branch_and_missing_lists(register):
    parsed = register["parse_genie_summary"]('```json\n{"branch": null, "skill_version": "1.0.0"}\n```')
    assert parsed["branch"] is None
    assert parsed["files"] == [] and parsed["asset_ids"] == [] and parsed["skipped"] == []


@pytest.mark.parametrize("text", ["", "no json here", "```json\n{broken\n```", '{"files": []}'])
def test_parse_summary_without_summary_raises(register, text):
    with pytest.raises(ValueError):
        register["parse_genie_summary"](text)


def test_parse_summary_rejects_non_string_branch(register):
    with pytest.raises(ValueError):
        register["parse_genie_summary"]('```json\n{"branch": 42}\n```')


def test_build_upsert_body_matches_contract(register):
    body = register["build_upsert_body"](SUMMARY, "b-1", ["v2", "v1"])
    # batchId in the app contract is an existing app.feedback_batches id (404 otherwise), not the staging batch id.
    assert "batchId" not in body
    assert "staging batch b-1" in body["summary"]
    assert body["branchName"] == "mg-genie-feedback-20261024"
    assert body["files"] == SUMMARY["files"]
    assert body["status"] == "proposed"
    assert body["voteIds"] == ["v2", "v1"]
    assert "1 asset(s) changed" in body["summary"] and "1.0.0" in body["summary"]


def test_default_app_name(register):
    assert register["default_app_name"]("dev") == "dev-semantic-ground-truth"
    assert register["default_app_name"]("prod") == "semantic-ground-truth"


def test_quote_table(register):
    assert register["quote_table"]("hls_fde_dev.s.feedback_staging") == "`hls_fde_dev`.`s`.`feedback_staging`"
    for bad in ["a.b", "a.b.c; DROP TABLE x", "a.b.`c`", ""]:
        with pytest.raises(ValueError):
            register["quote_table"](bad)


# ---------------------------------------------------------------------------
# Vote selection and grouping
# ---------------------------------------------------------------------------


def vote(id_, asset, sort_by, vote_type="edit", change="insert", processed=False, created="2026-10-23T10:00:00", **edits):
    return {
        "_pg_change_type": change,
        "_sort_by": sort_by,
        "id": id_,
        "asset_id": asset,
        "user_id": f"u-{id_}",
        "vote_type": vote_type,
        "feedback": edits.pop("feedback", None),
        "edit_description": edits.get("description"),
        "edit_plain_english_logic": edits.get("plain_english_logic"),
        "edit_display_name": edits.get("display_name"),
        "is_processed": processed,
        "created_at": created,
    }


def test_latest_non_deleted_keeps_latest_row_and_drops_deletes(collect):
    rows = [
        vote("v1", "a1", 1, description="old"),
        vote("v1", "a1", 5, change="update_postimage", description="new"),
        vote("v1", "a1", 4, change="update_preimage", description="old"),
        vote("v2", "a1", 2, description="x"),
        vote("v2", "a1", 6, change="delete"),
    ]
    latest = collect["latest_non_deleted"](rows)
    assert [r["id"] for r in latest] == ["v1"]
    assert latest[0]["edit_description"] == "new"


def test_select_unprocessed_edits_excludes_processed_skips_and_feedback_only(collect):
    rows = [
        vote("v1", "a1", 1, description="Count of bookings"),
        vote("v2", "a1", 2, processed=True, description="done already"),
        vote("v3", "a2", 3, vote_type="skip"),
        vote("v4", "a2", 4, vote_type="approve"),
        vote("v5", "a3", 5, feedback="Suggested edit: clarify the description."),
        vote("v6", "a3", 6, display_name="   "),
    ]
    assert [r["id"] for r in collect["select_unprocessed_edits"](rows)] == ["v1"]


def test_asset_with_only_skips_is_not_staged(collect):
    rows = [vote("v1", "a9", 1, vote_type="skip"), vote("v2", "a9", 2, vote_type="skip")]
    assert collect["group_edit_votes"](collect["select_unprocessed_edits"](rows), {}) == []


def test_resolve_field_majority_wins(collect):
    r = collect["resolve_field"]([("A", "2026-10-01"), ("B", "2026-10-03"), (" A ", "2026-10-02")])
    assert r == {"value": "A", "support": 2, "total": 3, "conflict": True}


def test_resolve_field_tie_goes_to_most_recent(collect):
    r = collect["resolve_field"]([("A", "2026-10-01"), ("B", "2026-10-03"), ("A", "2026-10-02"), ("B", "2026-10-01")])
    assert r["value"] == "B" and r["support"] == 2 and r["total"] == 4 and r["conflict"] is True


def test_resolve_field_single_value_and_empty(collect):
    assert collect["resolve_field"]([("A", "t")]) == {"value": "A", "support": 1, "total": 1, "conflict": False}
    assert collect["resolve_field"]([(None, "t"), ("  ", "t")]) is None


def test_group_edit_votes_builds_one_row_per_asset(collect):
    votes = [
        vote("v2", "a1", 2, created="2026-10-23T12:00:00", description="New text"),
        vote("v1", "a1", 1, created="2026-10-23T09:00:00", description="New text", display_name="Bookings"),
        vote("v3", "a2", 3, created="2026-10-23T10:00:00", plain_english_logic="Sum of paid"),
    ]
    assets = {
        "a1": {"asset_type": "measure", "name": "cat.sch.mv_x/bookings", "display_name": "Total Bookings",
               "description": "Old", "plain_english_logic": "COUNT(*)", "fixture_path": None},
    }
    rows = collect["group_edit_votes"](votes, assets)
    assert [r["asset_id"] for r in rows] == ["a1", "a2"]
    a1 = rows[0]
    assert a1["vote_ids"] == ["v1", "v2"]  # oldest first
    assert a1["vote_count"] == 2
    assert a1["asset_name"] == "cat.sch.mv_x/bookings" and a1["current_description"] == "Old"
    resolved = json.loads(a1["resolved_json"])
    assert resolved["description"] == {"value": "New text", "support": 2, "total": 2, "conflict": False}
    assert resolved["display_name"]["value"] == "Bookings"
    assert "plain_english_logic" not in resolved
    edits = json.loads(a1["edits_json"])
    assert [e["vote_id"] for e in edits] == ["v1", "v2"] and edits[0]["display_name"] == "Bookings"
    a2 = rows[1]  # asset missing from lb_assets_history: staged without metadata
    assert a2["asset_type"] is None and json.loads(a2["resolved_json"])["plain_english_logic"]["value"] == "Sum of paid"


def test_validate_identifier(collect):
    assert collect["validate_identifier"]("dev_matthew_giglia_semantic_ground_truth") == "`dev_matthew_giglia_semantic_ground_truth`"
    for bad in ["", "a-b", "a`b", "a; drop"]:
        with pytest.raises(ValueError):
            collect["validate_identifier"](bad)


# ---------------------------------------------------------------------------
# Skill versioning and the automation prompt
# ---------------------------------------------------------------------------

SKILL_FILE = INFRA / "fixtures" / "skills" / "ground-truth-feedback-author" / "SKILL.md"
PROMPT_FILE = INFRA / "fixtures" / "prompts" / "feedback_loop_prompt.md"


def test_skill_file_is_version_1_0_0(automation):
    text = SKILL_FILE.read_text()
    assert automation["parse_skill_version"](text) == "1.0.0"
    assert "name: ground-truth-feedback-author" in text


def test_parse_skill_version_variants(automation):
    parse = automation["parse_skill_version"]
    assert parse("---\nname: x\nversion: '1.2.3'\n---\nbody") == "1.2.3"
    assert parse("---\nname: x\n---\nversion: 9.9.9") is None  # outside the frontmatter
    assert parse("no frontmatter") is None


@pytest.mark.parametrize(
    "source, existing, copy",
    [("1.0.0", None, True), ("1.0.0", "0.9.0", True), ("1.10.0", "1.9.0", True),
     ("1.0.0", "1.0.0", False), ("1.0.0", "1.0.1", False), ("1.0.0", "2.0", False)],
)
def test_should_copy_skill_never_downgrades(automation, source, existing, copy):
    assert automation["should_copy_skill"](source, existing) is copy


def test_target_and_display_name(automation):
    root = "/Users/matthew.giglia@databricks.com/.bundle/ground-truth-infra/dev/files"
    assert automation["target_from_bundle_root"](root) == "dev"
    assert automation["target_from_bundle_root"]("/Users/x/semanticGroundTruth/ground-truth-infra") is None
    assert automation["automation_display_name"]("dev") == "Ground Truth Feedback Author (dev)"


def test_prompt_fixture_renders_with_all_placeholders(automation):
    template = automation["extract_automation_prompt"](PROMPT_FILE.read_text())
    prompt = automation["render_prompt"](template, "1.0.0")
    assert prompt.startswith("You are the Semantic Ground Truth feedback author")
    for placeholder in ["{{run_date}}", "{{batch_id}}", "{{branch_prefix}}", "{{feedback_table}}",
                        "{{skill_path}}", "{{repo_path}}", "{{base_branch}}"]:
        assert placeholder in prompt
    assert "expected skill version: 1.0.0" in prompt
    assert "skill_version" in prompt
    assert "__SKILL_VERSION__" not in prompt


def test_render_prompt_rejects_incomplete_template(automation):
    with pytest.raises(ValueError):
        automation["render_prompt"]("You are the Semantic Ground Truth feedback author {{run_date}}", "1.0.0")


# ---------------------------------------------------------------------------
# setup_job_params: placeholder -> genie_task
# ---------------------------------------------------------------------------

GENIE_PARAMS = {
    "run_date": "{{tasks.collect_feedback.values.run_date}}",
    "batch_id": "{{tasks.collect_feedback.values.batch_id}}",
    "branch_prefix": "{{job.parameters.branch_prefix}}",
    "feedback_table": "{{tasks.collect_feedback.values.feedback_table}}",
    "skill_path": "/Users/x/.bundle/ground-truth-infra/dev/files/fixtures/skills/ground-truth-feedback-author/SKILL.md",
    "repo_path": "{{job.parameters.repo_path}}",
    "base_branch": "{{job.parameters.base_branch}}",
}
CONFIG_ID = "genie_code/users/123/scheduled_insights/abc"


def placeholder_task():
    return {
        "task_key": "author_feedback_branch",
        "depends_on": [{"task_key": "check_has_feedback", "outcome": "true"}],
        "notebook_task": {"notebook_path": "/x/create_feature_branch", "base_parameters": dict(GENIE_PARAMS)},
        "environment_key": "serverless",
        "timeout_seconds": 1800,
    }


def test_to_genie_task_from_placeholder(job_params):
    patched = job_params["to_genie_task"](placeholder_task(), CONFIG_ID)
    assert patched["genie_task"] == {"configuration_id": CONFIG_ID, "parameters": GENIE_PARAMS}
    assert "notebook_task" not in patched and "environment_key" not in patched
    assert patched["depends_on"] == [{"task_key": "check_has_feedback", "outcome": "true"}]
    assert patched["timeout_seconds"] == 1800


def test_to_genie_task_is_idempotent(job_params):
    once = job_params["to_genie_task"](placeholder_task(), "old")
    twice = job_params["to_genie_task"](once, CONFIG_ID)
    assert twice["genie_task"] == {"configuration_id": CONFIG_ID, "parameters": GENIE_PARAMS}


def test_to_genie_task_requires_all_parameters(job_params):
    task = placeholder_task()
    del task["notebook_task"]["base_parameters"]["skill_path"]
    with pytest.raises(ValueError):
        job_params["to_genie_task"](task, CONFIG_ID)


def test_patch_tasks_only_touches_author_task(job_params):
    collect_task = {"task_key": "collect_feedback", "notebook_task": {"notebook_path": "/x/collect_feedback"}}
    tasks = job_params["patch_tasks"]([collect_task, placeholder_task()], CONFIG_ID)
    assert tasks[0] is collect_task
    assert "genie_task" in tasks[1]
    with pytest.raises(ValueError):
        job_params["patch_tasks"]([collect_task], CONFIG_ID)


# ---------------------------------------------------------------------------
# Guardrail: no file under ground-truth-infra creates a non-conforming branch
# ---------------------------------------------------------------------------


def test_no_feedback_slash_branch_names_in_infra_code():
    offenders = []
    for path in list((INFRA / "src").rglob("*.py")) + list((INFRA / "resources").rglob("*.yml")):
        legacy = re.escape(LEGACY_PREFIX)
        if re.search(legacy + r"\{|" + legacy + r"YYYY|['\"]" + legacy, path.read_text()):
            offenders.append(str(path.relative_to(INFRA)))
    assert offenders == []
