"""Metric view id dimensions are canonical UUID strings (build 5, session 47, follow-up 4).

Postgres UUID columns land in bronze_lakebase_cdf.data (VARIANT) as BINARY, so
`data:<col>::STRING` holds the raw 16 bytes. Every metric view dimension over such a
column must format it as lowercase 8-4-4-4-12 text with UUID_EXPR, keeping its name
(dashboard widgets and Genie SQL bind by name). The fixtures must still parse the way
src/notebooks/deploy_metric_view.py parses them (yaml.safe_load, then the YAML between
the $$ delimiters).

Run from the repo root:
    python -m pytest ground-truth-infra/tests/test_metric_view_ids.py
In a Databricks workspace folder (no __pycache__ allowed):
    PYTHONDONTWRITEBYTECODE=1 python -B -m pytest -p no:cacheprovider ground-truth-infra/tests/test_metric_view_ids.py
"""

import re
import uuid
from pathlib import Path

import pytest
import yaml

INFRA = Path(__file__).resolve().parents[1]
REPO = INFRA.parent
FIXTURES = INFRA / "fixtures" / "metric_views"
MIGRATIONS = REPO / "ground-truth-app" / "server" / "migrations"

UUID_EXPR = "regexp_replace(lower(hex({col})), '^(.{{8}})(.{{4}})(.{{4}})(.{{4}})(.{{12}})$', '$1-$2-$3-$4-$5')"

# Same substitution and $$ extraction as deploy_metric_view.py (Step 2 and validate_only).
RESOLVE = {"${catalog}": "cat", "${schema}": "sch", "${var.catalog}": "cat", "${var.schema}": "sch"}
BODY_RE = re.compile(r"\$\$(.*?)\$\$", re.DOTALL)
# `data:<field>::STRING AS <alias>` in a metric view source query.
VARIANT_COL_RE = re.compile(r"data:(\w+)::STRING\s+AS\s+(\w+)", re.IGNORECASE)

FIXTURE_FILES = sorted(FIXTURES.glob("*.yaml"))


def uuid_columns():
    """Column names declared UUID in the app's Postgres migrations (the BINARY fields in bronze)."""
    names = set()
    for path in MIGRATIONS.glob("*.ts"):
        names.update(m.lower() for m in re.findall(r"^\s*([a-z_]+)\s+UUID\b", path.read_text(), re.I | re.M))
    return names


def load_metric_view(path):
    """Parse a fixture exactly as deploy_metric_view.py does; return (fixture, metric view YAML)."""
    fixture = yaml.safe_load(path.read_text())
    sql = fixture["sql"]
    for key, value in RESOLVE.items():
        sql = sql.replace(key, value)
    match = BODY_RE.search(sql)
    assert match, f"{path.name}: no $$ delimiters"
    return fixture, yaml.safe_load(match.group(1))


def uuid_aliases(mv_def, uuid_cols):
    """Source aliases selected from a BINARY UUID variant field."""
    return {alias for field, alias in VARIANT_COL_RE.findall(mv_def["source"]) if field.lower() in uuid_cols}


def sql_uuid_format(raw: bytes) -> str:
    """Python port of UUID_EXPR (hex -> lower -> regexp_replace)."""
    return re.sub(r"^(.{8})(.{4})(.{4})(.{4})(.{12})$", r"\1-\2-\3-\4-\5", raw.hex().lower())


def test_migrations_found_and_user_id_is_not_uuid():
    cols = uuid_columns()
    assert {"id", "asset_id", "campaign_id"} <= cols
    assert "user_id" not in cols, "user_id is an email / SPN id string, not a UUID"


def test_uuid_expression_matches_python_uuid():
    for raw in (bytes.fromhex("3e1c271b8b9141b3ba68f24b3f65a79f"), uuid.uuid4().bytes, bytes(16)):
        assert sql_uuid_format(raw) == str(uuid.UUID(bytes=raw))


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda p: p.name)
def test_fixture_parses_like_deploy_metric_view(path):
    fixture, mv_def = load_metric_view(path)
    assert fixture["name"] == path.stem
    assert mv_def["source"].strip()
    assert isinstance(mv_def.get("dimensions"), list) and mv_def["dimensions"]
    # Exactly one $$ ... $$ body: an expression containing $$ would truncate the view.
    assert fixture["sql"].count("$$") == 2, f"{path.name}: '$$' must appear only as the delimiters"


@pytest.mark.parametrize("path", FIXTURE_FILES, ids=lambda p: p.name)
def test_uuid_dimensions_use_uuid_expression(path):
    _, mv_def = load_metric_view(path)
    aliases = uuid_aliases(mv_def, uuid_columns())
    for dim in mv_def["dimensions"]:
        expr = str(dim["expr"]).strip()
        if expr in aliases:
            pytest.fail(f"{path.name}: dimension {dim['name']} exposes BINARY {expr}; use {UUID_EXPR.format(col=expr)}")
        if dim["name"].endswith("_id") and dim["name"] in aliases:
            assert expr == UUID_EXPR.format(col=dim["name"]), f"{path.name}: {dim['name']} expr is {expr!r}"


def test_review_activity_ids_keep_names_and_raw_measures():
    _, mv_def = load_metric_view(FIXTURES / "mv_review_activity.yaml")
    dims = {d["name"]: d for d in mv_def["dimensions"]}
    assert dims["asset_id"]["expr"] == UUID_EXPR.format(col="asset_id")
    assert dims["campaign_id"]["expr"] == UUID_EXPR.format(col="campaign_id")
    assert dims["asset_id"]["display_name"] == "Asset ID"
    assert dims["campaign_id"]["display_name"] == "Campaign ID"
    assert dims["user_id"]["expr"] == "user_id"
    # Measures count raw ids; the format change must not touch them.
    assert all("hex(" not in m["expr"] for m in mv_def["measures"])
