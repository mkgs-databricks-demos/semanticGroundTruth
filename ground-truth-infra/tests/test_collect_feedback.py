"""Unit tests for collect_feedback's handling of edit votes without a proposed value
(build 5, session 46, follow-up 6 pipeline side).

The helpers live in the notebook's "Pure helpers" cell (marked `# --- pure helpers`), which uses only
the standard library, so it is executed on its own here (same loader as test_feedback_pipeline.py).

Run from the repo root:
    python -m pytest ground-truth-infra/tests/test_collect_feedback.py
In a Databricks workspace folder (no __pycache__ allowed):
    PYTHONDONTWRITEBYTECODE=1 python -B -m pytest -p no:cacheprovider ground-truth-infra/tests/test_collect_feedback.py
"""

from datetime import datetime, timezone
from pathlib import Path

import pytest

NOTEBOOK = Path(__file__).resolve().parents[1] / "src" / "notebooks" / "collect_feedback.py"
CELL_SEPARATOR = "\n# COMMAND ----------\n"
MARKER = "# --- pure helpers"

# The vote from follow-up 6: edit, free text only, never processed.
NO_VALUE_VOTE = "3e792f67-71f2-4c3b-81ec-85e3f84452a5"


@pytest.fixture(scope="module")
def cf():
    cells = [c for c in NOTEBOOK.read_text().split(CELL_SEPARATOR) if MARKER in c]
    assert len(cells) == 1, f"expected exactly one pure-helpers cell, found {len(cells)}"
    namespace = {}
    exec(compile(cells[0], "collect_feedback.py:pure-helpers", "exec"), namespace)
    return namespace


def vote(vid, vote_type="edit", processed=False, feedback=None, **edits):
    row = {
        "id": vid,
        "asset_id": f"asset-{vid[:4]}",
        "user_id": "reviewer@example.com",
        "vote_type": vote_type,
        "feedback": feedback,
        "is_processed": processed,
        "created_at": datetime(2026, 10, 27, tzinfo=timezone.utc),
    }
    for field in ("description", "plain_english_logic", "display_name"):
        row[f"edit_{field}"] = edits.get(field)
    return row


def rows():
    return [
        vote(NO_VALUE_VOTE, feedback="Suggested edit: clarify the description."),
        vote("aaaa0000-0000-0000-0000-000000000001", description="New description"),
        vote("bbbb0000-0000-0000-0000-000000000002", feedback="   ", description="   ", display_name=""),
        vote("cccc0000-0000-0000-0000-000000000003", processed=True, feedback="already handled"),
        vote("dddd0000-0000-0000-0000-000000000004", vote_type="approve"),
        vote("eeee0000-0000-0000-0000-000000000005", vote_type="reject", feedback="wrong"),
    ]


def test_reason_constant(cf):
    assert cf["NO_PROPOSED_VALUE"] == "no_proposed_value"


def test_selects_unprocessed_edits_without_a_value(cf):
    ids = [r["id"] for r in cf["select_edits_without_value"](rows())]
    # whitespace-only edit_* values count as no value; processed, approve and reject votes are excluded
    assert ids == [NO_VALUE_VOTE, "bbbb0000-0000-0000-0000-000000000002"]


def test_with_and_without_value_partition_the_unprocessed_edits(cf):
    with_value = {r["id"] for r in cf["select_unprocessed_edits"](rows())}
    without = {r["id"] for r in cf["select_edits_without_value"](rows())}
    unprocessed_edits = {r["id"] for r in rows() if r["vote_type"] == "edit" and not r["is_processed"]}
    assert with_value.isdisjoint(without)
    assert with_value | without == unprocessed_edits


def test_disposition_rows(cf):
    at = datetime(2026, 10, 27, 12, tzinfo=timezone.utc)
    selected = cf["select_edits_without_value"](rows())
    out = cf["disposition_rows"](selected, cf["NO_PROPOSED_VALUE"], at)
    assert [r["vote_id"] for r in out] == sorted([NO_VALUE_VOTE, "bbbb0000-0000-0000-0000-000000000002"])
    first = next(r for r in out if r["vote_id"] == NO_VALUE_VOTE)
    assert first == {
        "vote_id": NO_VALUE_VOTE,
        "asset_id": "asset-3e79",
        "user_id": "reviewer@example.com",
        "feedback": "Suggested edit: clarify the description.",
        "processed_reason": "no_proposed_value",
        "recorded_at": at,
    }
    blank = next(r for r in out if r["vote_id"] != NO_VALUE_VOTE)
    assert blank["feedback"] is None


def test_disposition_rows_skip_already_recorded_and_duplicates(cf):
    at = datetime(2026, 10, 27, tzinfo=timezone.utc)
    selected = cf["select_edits_without_value"](rows())
    out = cf["disposition_rows"](selected + selected, "no_proposed_value", at, already_recorded={NO_VALUE_VOTE})
    assert [r["vote_id"] for r in out] == ["bbbb0000-0000-0000-0000-000000000002"]
    assert cf["disposition_rows"]([], "no_proposed_value", at) == []


def test_no_value_vote_is_never_staged(cf):
    staged = cf["group_edit_votes"](cf["select_unprocessed_edits"](rows()), {})
    staged_ids = {i for r in staged for i in r["vote_ids"]}
    assert NO_VALUE_VOTE not in staged_ids
    assert staged_ids == {"aaaa0000-0000-0000-0000-000000000001"}


@pytest.mark.parametrize("text,expected", [("true", True), ("FALSE", False), ("", False), (None, False), ("1", True)])
def test_parse_bool(cf, text, expected):
    assert cf["parse_bool"](text) is expected


def test_parse_bool_rejects_other_text(cf):
    with pytest.raises(ValueError):
        cf["parse_bool"]("sometimes")
