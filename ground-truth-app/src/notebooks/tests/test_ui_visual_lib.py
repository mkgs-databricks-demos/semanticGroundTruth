"""pytest for src/notebooks/ui_visual_lib.py (session 48): matrix, pass/fail rules, colors, focus ring, similarity.

Run from the repo root: python -m pytest ground-truth-app/src/notebooks/tests
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import ui_visual_lib as lib  # noqa: E402  (path set above: notebooks/ is not a package)


# ---------------------------------------------------------------- matrix

def test_matrix_has_44_unique_cells():
    cells = lib.build_matrix()
    assert len(cells) == 44
    assert len({(c.route, c.theme, c.viewport) for c in cells}) == 44
    assert len({c.screenshot_name for c in cells}) == 44


def test_matrix_covers_plan_routes_themes_viewports():
    cells = lib.build_matrix()
    assert {c.route for c in cells} == {
        "/", "/leaderboard", "/assistant", "/steward", "/steward/feedback-queue", "/steward/conflicts",
        "/steward/feedback-branches", "/executive", "/admin", "/settings", "/does-not-exist",
    }
    assert {c.theme for c in cells} == {"light", "dark"}
    assert {(c.width, c.height) for c in cells} == {(1440, 900), (390, 844)}
    assert cells[0] == lib.Cell("/", "review", "light", "1440x900", 1440, 900)


def test_route_slugs_match_figma_export_folders():
    figma = Path(__file__).resolve().parents[4] / "docs" / "design" / "ui" / "figma"
    if not figma.is_dir():
        pytest.skip("Figma export not present in this checkout")
    for _, slug in lib.ROUTES:
        assert (figma / slug).is_dir(), slug


def test_screenshot_path_and_run_id_guard():
    cell = lib.build_matrix()[1]
    assert lib.screenshot_path("/Volumes/c/s/ui_visual_checks/", "123", cell) == \
        "/Volumes/c/s/ui_visual_checks/123/review__light__390x844.png"
    with pytest.raises(ValueError):
        lib.screenshot_path("/Volumes/c/s/v", "../x", cell)


def test_parse_volume_path():
    assert lib.parse_volume_path("/Volumes/hls_fde_dev/dev_x/ui_visual_checks") == ("hls_fde_dev", "dev_x", "ui_visual_checks")
    for bad in ("/tmp/x/y/z", "/Volumes/a/b", "/Volumes/a/b-c/d", "Volumes/a/b/c"):
        with pytest.raises(ValueError):
            lib.parse_volume_path(bad)


# ---------------------------------------------------------------- colors

@pytest.mark.parametrize("value,expected", [
    ("rgb(249, 247, 244)", "#F9F7F4"),
    ("rgba(11, 32, 38, 1)", "#0B2026"),
    ("rgb(11 32 38)", "#0B2026"),
    ("#f9f7f4", "#F9F7F4"),
    ("rgba(0, 0, 0, 0)", None),
    ("transparent", None),
    ("", None),
    ("oklch(0.9 0 0)", None),
])
def test_css_color_to_hex(value, expected):
    assert lib.css_color_to_hex(value) == expected


def test_bg_matches_token_per_theme():
    assert lib.bg_matches("light", "rgb(249, 247, 244)")
    assert lib.bg_matches("dark", "rgb(11, 32, 38)")
    assert not lib.bg_matches("dark", "rgb(249, 247, 244)")
    assert not lib.bg_matches("light", "rgba(0, 0, 0, 0)")


# ---------------------------------------------------------------- focus ring

@pytest.mark.parametrize("style,visible", [
    ({"outlineStyle": "solid", "outlineWidth": "2px", "outlineColor": "rgb(34, 114, 180)", "boxShadow": "none"}, True),
    # Tailwind outline-none: 2px solid transparent is NOT a visible ring
    ({"outlineStyle": "solid", "outlineWidth": "2px", "outlineColor": "rgba(0, 0, 0, 0)", "boxShadow": "none"}, False),
    ({"outlineStyle": "none", "outlineWidth": "0px", "boxShadow": "none"}, False),
    ({"outlineStyle": "auto", "outlineWidth": "1px", "outlineColor": "-webkit-focus-ring-color", "boxShadow": "none"}, True),
    # Tailwind ring-2 ring-offset-2
    ({"outlineStyle": "none", "outlineWidth": "0px",
      "boxShadow": "rgb(255, 255, 255) 0px 0px 0px 2px, rgb(34, 114, 180) 0px 0px 0px 4px, rgba(0, 0, 0, 0) 0px 0px 0px 0px"}, True),
    # ring color transparent, zero-size shadows: invisible
    ({"outlineStyle": "none", "outlineWidth": "0px", "boxShadow": "rgba(0, 0, 0, 0) 0px 0px 0px 2px, rgb(0, 0, 0) 0px 0px 0px 0px"}, False),
    ({}, False),
])
def test_focus_ring_visible(style, visible):
    assert lib.focus_ring_visible(style) is visible


def test_focus_ok_ignores_body_and_lists_offenders():
    ring = {"outlineStyle": "solid", "outlineWidth": "2px", "outlineColor": "rgb(0, 0, 0)"}
    none = {"outlineStyle": "none", "outlineWidth": "0px", "boxShadow": "none"}
    ok, off = lib.focus_ok([{"is_body": True, "style": none}, {"tag": "button", "label": "Vote", "style": ring}])
    assert ok and off == []
    ok, off = lib.focus_ok([{"tag": "a", "label": "Home", "style": none}, {"tag": "a", "label": "Home", "style": none}])
    assert not ok and off == ["a:Home"]


# ---------------------------------------------------------------- axe and network

def test_axe_counts_serious_and_critical_only():
    result = {"violations": [
        {"id": "color-contrast", "impact": "serious", "nodes": [{}, {}]},
        {"id": "region", "impact": "moderate", "nodes": [{}]},
        {"id": "button-name", "impact": "critical", "nodes": [{}]},
        {"id": "x", "impact": None, "nodes": []},
    ]}
    total, serious, desc = lib.axe_counts(result)
    assert (total, serious) == (4, 2)
    assert desc[0] == "color-contrast(serious, 2 nodes)"
    assert lib.axe_counts(None)[:2] == (0, 0)
    assert lib.axe_counts({"violations": "bad"})[:2] == (0, 0)


def test_axe_counts_lists_node_targets():
    # Session 62: the description names the offending elements so a failing cell can be fixed.
    result = {"violations": [{"id": "color-contrast", "impact": "serious", "nodes": [
        {"target": ["#review-root", "span.font-bold"], "summary": "Fix any of the following:\n  contrast 4.25"},
        {"target": [".x"], "summary": ""},
    ]}]}
    _, _, desc = lib.axe_counts(result)
    assert desc == ["color-contrast(serious, 2 nodes): #review-root span.font-bold -> Fix any of the following: contrast 4.25 | .x"]


def test_axe_tags_include_wcag21_aa():
    # color-contrast is a wcag2aa rule, so running these tags includes it.
    assert {"wcag2aa", "wcag21aa"} <= set(lib.AXE_TAGS)


def test_failed_request_is_same_origin_only():
    app = "https://dev-semantic-ground-truth-123.aws.databricksapps.com"
    assert lib.is_failed_request(app + "/api/me", app, 500)
    assert lib.is_failed_request(app + "/api/me", app, None, "net::ERR_ABORTED")
    assert not lib.is_failed_request(app + "/api/me", app, 200)
    assert not lib.is_failed_request(app + "/assets/x.js", app, 304)
    assert not lib.is_failed_request("https://cdn.example.com/x.js", app, 404)
    assert not lib.is_failed_request("http://dev-semantic-ground-truth-123.aws.databricksapps.com/x", app, 404)


# ---------------------------------------------------------------- pass / fail rules

GOOD = dict(rendered=True, axe_serious=0, console_errors=0, failed_requests=0, h1_count=1, bg_ok=True, focus_ok=True)


def test_evaluate_cell_pass():
    assert lib.evaluate_cell(**GOOD) == ("pass", [])


@pytest.mark.parametrize("override,fragment", [
    ({"rendered": False}, "render timeout"),
    ({"axe_serious": 1}, "axe serious"),
    ({"console_errors": 2}, "console errors"),
    ({"failed_requests": 1}, "failed requests"),
    ({"h1_count": 0}, "h1 count 0"),
    ({"h1_count": 2}, "h1 count 2"),
    ({"bg_ok": False}, "background"),
    ({"focus_ok": False}, "focus ring"),
])
def test_evaluate_cell_each_rule_fails(override, fragment):
    status, reasons = lib.evaluate_cell(**{**GOOD, **override})
    assert status == "fail"
    assert len(reasons) == 1 and fragment in reasons[0]


def test_evaluate_cell_collects_all_reasons():
    status, reasons = lib.evaluate_cell(rendered=False, axe_serious=3, console_errors=1, failed_requests=1,
                                        h1_count=0, bg_ok=False, focus_ok=False)
    assert status == "fail" and len(reasons) == 7


# ---------------------------------------------------------------- Figma similarity

def _img(w, h, fill):
    from PIL import Image
    return Image.new("RGB", (w, h), fill)


def test_similarity_identical_is_one_and_inverse_is_zero():
    assert lib.image_similarity(_img(1440, 900, (255, 255, 255)), _img(2880, 1800, (255, 255, 255))) == 1.0
    assert lib.image_similarity(_img(1440, 900, (0, 0, 0)), _img(1440, 900, (255, 255, 255))) == 0.0


def test_similarity_half_changed_and_height_crop():
    from PIL import Image, ImageDraw
    a = _img(720, 400, (255, 255, 255))
    b = a.copy()
    ImageDraw.Draw(b).rectangle([0, 0, 359, 399], fill=(0, 0, 0))  # left half black
    assert lib.image_similarity(a, b) == pytest.approx(0.5, abs=0.01)
    # b is twice as tall: only the overlapping top part is compared (bilinear resize blurs the
    # boundary row, hence the tolerance; without the crop the score would be about 0.5)
    tall = Image.new("RGB", (720, 800), (255, 255, 255))
    ImageDraw.Draw(tall).rectangle([0, 400, 719, 799], fill=(0, 0, 0))
    assert lib.image_similarity(a, tall) == pytest.approx(1.0, abs=0.005)


def test_figma_reference_path_prefers_mobile_frame(tmp_path):
    d = tmp_path / "review"
    d.mkdir()
    (d / "review__populated__dark.png").write_bytes(b"x")
    cells = {(c.theme, c.viewport): c for c in lib.build_matrix() if c.slug == "review"}
    assert lib.figma_reference_path(str(tmp_path), cells[("dark", "1440x900")]) == str(d / "review__populated__dark.png")
    # no mobile frame: fall back to the desktop frame
    assert lib.figma_reference_path(str(tmp_path), cells[("dark", "390x844")]) == str(d / "review__populated__dark.png")
    (d / "review__populated-mobile__dark.png").write_bytes(b"x")
    assert lib.figma_reference_path(str(tmp_path), cells[("dark", "390x844")]) == str(d / "review__populated-mobile__dark.png")
    assert lib.figma_reference_path(str(tmp_path), cells[("light", "1440x900")]) is None
    assert lib.figma_reference_path("", cells[("dark", "1440x900")]) is None


# ---------------------------------------------------------------- reporting and schema

def test_summary_lines_failures_first_and_totals():
    rows = [
        {"status": "pass", "route": "/", "theme": "light", "viewport": "1440x900", "bg_ok": True, "focus_ok": True, "figma_similarity": 0.9},
        {"status": "fail", "route": "/admin", "theme": "dark", "viewport": "390x844", "bg_ok": False, "focus_ok": True, "figma_similarity": None},
    ]
    lines = lib.summary_lines(rows)
    assert lines[2].startswith("fail") and "/admin" in lines[2]
    assert lines[-1] == "1/2 cells pass, 1 fail"


def test_result_columns_match_manifest_contract():
    assert [c for c, _ in lib.RESULT_COLUMNS] == [
        "run_id", "route", "theme", "viewport", "status", "axe_violations", "axe_serious", "console_errors",
        "failed_requests", "h1_count", "bg_ok", "focus_ok", "figma_similarity", "screenshot_path", "duration_ms", "ts",
    ]
