"""Pure helpers for the ui_visual_checks job (session 48, build 5).

No Playwright, Spark or Databricks imports here: everything is plain data in, plain data out, so
`src/notebooks/tests/test_ui_visual_lib.py` can test it with pytest. The notebook
`ui_visual_checks.ipynb` drives Chromium and feeds the measurements into these functions.

Matrix: 11 routes x 2 color schemes x 2 viewports = 44 cells (ui_test_strategy.md, plan 48).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence
from urllib.parse import urlsplit

# Route -> Figma export slug (docs/design/ui/figma/<slug>/). The slug also names the screenshot.
ROUTES: tuple[tuple[str, str], ...] = (
    ("/", "review"),
    ("/leaderboard", "leaderboard"),
    ("/assistant", "assistant"),
    ("/steward", "steward"),
    ("/steward/feedback-queue", "steward-feedback-queue"),
    ("/steward/conflicts", "steward-conflicts"),
    ("/steward/feedback-branches", "steward-feedback-branches"),
    ("/executive", "executive"),
    ("/admin", "admin"),
    ("/settings", "settings"),
    ("/does-not-exist", "not-found"),
)
THEMES: tuple[str, ...] = ("light", "dark")
# name -> (width, height). "desktop" first: it is the Figma reference size.
VIEWPORTS: tuple[tuple[str, int, int], ...] = (("1440x900", 1440, 900), ("390x844", 390, 844))
MOBILE_MAX_WIDTH = 480

# Page background token per mode (ui_brand_plan / tokens.ts `background`).
BG_TOKENS: Mapping[str, str] = {"light": "#F9F7F4", "dark": "#0B2026"}

ROOT_SELECTOR = '[data-testid$="-root"]'
RENDER_TIMEOUT_MS = 20_000
FOCUS_TABS = 15
AXE_TAGS: tuple[str, ...] = ("wcag2a", "wcag2aa", "wcag21a", "wcag21aa")
AXE_BLOCKING_IMPACTS = frozenset({"serious", "critical"})
SIMILARITY_WIDTH = 360

RESULT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("run_id", "STRING"),
    ("route", "STRING"),
    ("theme", "STRING"),
    ("viewport", "STRING"),
    ("status", "STRING"),
    ("axe_violations", "INT"),
    ("axe_serious", "INT"),
    ("console_errors", "INT"),
    ("failed_requests", "INT"),
    ("h1_count", "INT"),
    ("bg_ok", "BOOLEAN"),
    ("focus_ok", "BOOLEAN"),
    ("figma_similarity", "DOUBLE"),
    ("screenshot_path", "STRING"),
    ("duration_ms", "BIGINT"),
    ("ts", "TIMESTAMP"),
)


@dataclass(frozen=True)
class Cell:
    route: str
    slug: str
    theme: str
    viewport: str
    width: int
    height: int

    @property
    def is_mobile(self) -> bool:
        return self.width <= MOBILE_MAX_WIDTH

    @property
    def screenshot_name(self) -> str:
        """`<route>__<theme>__<viewport>.png`, the route given by its slug (file-name safe)."""
        return f"{self.slug}__{self.theme}__{self.viewport}.png"


def build_matrix(
    routes: Sequence[tuple[str, str]] = ROUTES,
    themes: Sequence[str] = THEMES,
    viewports: Sequence[tuple[str, int, int]] = VIEWPORTS,
) -> list[Cell]:
    """Every route x theme x viewport cell, in a stable order (route, then theme, then viewport)."""
    return [Cell(r, s, t, v, w, h) for r, s in routes for t in themes for v, w, h in viewports]


def screenshot_path(output_volume: str, run_id: str, cell: Cell) -> str:
    """`<output_volume>/<run_id>/<route>__<theme>__<viewport>.png`."""
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", run_id or ""):
        raise ValueError(f"invalid run_id for a path: {run_id!r}")
    return f"{output_volume.rstrip('/')}/{run_id}/{cell.screenshot_name}"


def parse_volume_path(output_volume: str) -> tuple[str, str, str]:
    """Split `/Volumes/<catalog>/<schema>/<volume>[/...]` into its three UC names (plain names only)."""
    parts = output_volume.strip().rstrip("/").split("/")
    if len(parts) < 5 or parts[0] != "" or parts[1] != "Volumes":
        raise ValueError(f"output_volume must look like /Volumes/<catalog>/<schema>/<volume>: {output_volume!r}")
    catalog, schema, volume = parts[2], parts[3], parts[4]
    for n in (catalog, schema, volume):
        if not re.fullmatch(r"[A-Za-z0-9_]+", n):
            raise ValueError(f"invalid UC name in output_volume: {n!r}")
    return catalog, schema, volume


# ---------------------------------------------------------------- colors and focus ring

_RGB_RE = re.compile(r"rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)")


def parse_css_color(value: str | None) -> tuple[int, int, int, float] | None:
    """`rgb(...)` / `rgba(...)` / `#rrggbb` / `transparent` -> (r, g, b, alpha); None if unparseable."""
    if not value:
        return None
    v = value.strip().lower()
    if v == "transparent":
        return (0, 0, 0, 0.0)
    m = re.fullmatch(r"#([0-9a-f]{6})", v)
    if m:
        h = m.group(1)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0)
    m = _RGB_RE.fullmatch(v)
    if not m:
        return None
    r, g, b = (int(round(float(x))) for x in m.groups()[:3])
    a_raw = m.group(4)
    if a_raw is None:
        a = 1.0
    elif a_raw.endswith("%"):
        a = float(a_raw[:-1]) / 100.0
    else:
        a = float(a_raw)
    return (r, g, b, a)


def css_color_to_hex(value: str | None) -> str | None:
    """Opaque CSS color -> `#RRGGBB` (upper case); None when unparseable or not fully opaque."""
    c = parse_css_color(value)
    if c is None or c[3] < 1.0:
        return None
    return "#{:02X}{:02X}{:02X}".format(*c[:3])


def bg_matches(theme: str, computed_bg: str | None) -> bool:
    """`body` computed background equals the page background token of `theme`."""
    return css_color_to_hex(computed_bg) == BG_TOKENS[theme].upper()


def _px(value: str | None) -> float:
    m = re.match(r"\s*(-?[\d.]+)px", value or "")
    return float(m.group(1)) if m else 0.0


def _split_shadows(box_shadow: str) -> list[str]:
    """Split a computed box-shadow list on top-level commas (not the ones inside rgb())."""
    out, depth, cur = [], 0, []
    for ch in box_shadow:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return [s.strip() for s in out if s.strip()]


def _shadow_visible(shadow: str) -> bool:
    color_m = re.search(r"rgba?\([^)]*\)|#[0-9a-fA-F]{6}", shadow)
    color = parse_css_color(color_m.group(0)) if color_m else (0, 0, 0, 1.0)
    if color is None or color[3] <= 0:
        return False
    rest = shadow.replace(color_m.group(0), " ") if color_m else shadow
    lengths = [float(x) for x in re.findall(r"(-?[\d.]+)px", rest)]
    # offset-x offset-y [blur [spread]]: visible when blur or spread is positive.
    return any(v > 0 for v in lengths[2:4])


def focus_ring_visible(style: Mapping[str, str | None]) -> bool:
    """Computed style of a focused element shows a ring: a non-transparent outline or box-shadow of width > 0.

    `style` keys: outlineStyle, outlineWidth, outlineColor, boxShadow (getComputedStyle names).
    """
    outline_style = (style.get("outlineStyle") or "none").strip().lower()
    if outline_style not in ("none", "hidden") and _px(style.get("outlineWidth")) > 0:
        color = parse_css_color(style.get("outlineColor"))
        if color is None or color[3] > 0:  # unparseable (e.g. currentcolor/auto) counts as visible
            return True
    shadow = (style.get("boxShadow") or "none").strip()
    if shadow.lower() != "none" and any(_shadow_visible(s) for s in _split_shadows(shadow)):
        return True
    return False


def focus_ok(samples: Iterable[Mapping[str, object]]) -> tuple[bool, list[str]]:
    """Every Tab stop that landed on an element (not body) has a visible focus ring.

    Each sample: {"tag": str, "label": str, "is_body": bool, "style": {...}}. Returns (ok, offenders).
    """
    offenders = []
    for s in samples:
        if s.get("is_body"):
            continue
        style = s.get("style")
        if not focus_ring_visible(style if isinstance(style, Mapping) else {}):
            offenders.append(f"{s.get('tag', '?')}:{str(s.get('label', ''))[:60]}")
    return (not offenders, sorted(set(offenders)))


# ---------------------------------------------------------------- axe, network, console

def axe_counts(axe_result: Mapping[str, object] | None) -> tuple[int, int, list[str]]:
    """(violations, serious_or_critical, short descriptions) from an `axe.run` result."""
    raw = (axe_result or {}).get("violations")
    violations = [v for v in raw if isinstance(v, Mapping)] if isinstance(raw, list) else []
    serious = [v for v in violations if (v.get("impact") or "") in AXE_BLOCKING_IMPACTS]
    desc = [_axe_desc(v) for v in violations]
    return len(violations), len(serious), desc


def _axe_desc(v: Mapping[str, object]) -> str:
    """`rule(impact, n nodes)`, plus up to 5 node targets and failure summaries when axe gave them.

    Session 62: the targets are what locates the element to fix (the runbook promised them).
    """
    nodes = [n for n in (v.get("nodes") or []) if isinstance(n, Mapping)]
    head = f"{v.get('id')}({v.get('impact')}, {len(v.get('nodes') or [])} nodes)"
    parts = []
    for n in nodes[:5]:
        target = n.get("target")
        sel = " ".join(str(t) for t in target) if isinstance(target, list) else str(target or "")
        summary = " ".join(str(n.get("summary") or "").split())[:200]
        if sel or summary:
            parts.append(f"{sel} -> {summary}" if summary else sel)
    return head + (": " + " | ".join(parts) if parts else "")


def same_origin(url: str, app_url: str) -> bool:
    a, b = urlsplit(url), urlsplit(app_url)
    return (a.scheme, a.netloc.lower()) == (b.scheme, b.netloc.lower())


def is_failed_request(url: str, app_url: str, status: int | None, failure: str | None = None) -> bool:
    """A same-origin request that errored at the network level or returned HTTP >= 400."""
    if not same_origin(url, app_url):
        return False
    return bool(failure) or (status is not None and status >= 400)


# ---------------------------------------------------------------- pass / fail

def evaluate_cell(
    *,
    rendered: bool,
    axe_serious: int,
    console_errors: int,
    failed_requests: int,
    h1_count: int,
    bg_ok: bool,
    focus_ok: bool,
) -> tuple[str, list[str]]:
    """Plan 48 rules: any one of these fails the cell. Returns ("pass" | "fail", reasons)."""
    reasons = []
    if not rendered:
        reasons.append(f"render timeout: no {ROOT_SELECTOR} within {RENDER_TIMEOUT_MS // 1000} s")
    if axe_serious > 0:
        reasons.append(f"axe serious/critical: {axe_serious}")
    if console_errors > 0:
        reasons.append(f"console errors: {console_errors}")
    if failed_requests > 0:
        reasons.append(f"failed requests: {failed_requests}")
    if h1_count != 1:
        reasons.append(f"h1 count {h1_count} (expected 1)")
    if not bg_ok:
        reasons.append("body background is not the theme token")
    if not focus_ok:
        reasons.append("focus ring not visible")
    return ("fail" if reasons else "pass"), reasons


# ---------------------------------------------------------------- Figma similarity (report only)

def figma_reference_path(figma_dir: str | None, cell: Cell) -> str | None:
    """Figma export screenshot for the cell, or None when there is none.

    Desktop: `<slug>/<slug>__populated__<theme>.png`. Mobile prefers `<slug>__populated-mobile__<theme>.png`
    (the export's 390 px frames) and falls back to the desktop frame.
    """
    if not figma_dir:
        return None
    base = Path(figma_dir) / cell.slug
    names = [f"{cell.slug}__populated__{cell.theme}.png"]
    if cell.is_mobile:
        names.insert(0, f"{cell.slug}__populated-mobile__{cell.theme}.png")
    for n in names:
        p = base / n
        if p.is_file():
            return str(p)
    return None


def image_similarity(img_a, img_b, width: int = SIMILARITY_WIDTH) -> float:
    """1 - mean absolute grayscale difference, both images downscaled to `width` px (aspect kept).

    Accepts PIL images. Heights are cropped to the shorter image (full-page screenshots differ in
    length). 1.0 = identical, 0.0 = black vs white everywhere. Rounded to 4 decimals.
    """
    import numpy as np
    from PIL import Image

    def prep(img):
        g = img.convert("L")
        h = max(1, round(g.height * width / g.width))
        return np.asarray(g.resize((width, h), Image.BILINEAR), dtype=np.float64)

    a, b = prep(img_a), prep(img_b)
    h = min(a.shape[0], b.shape[0])
    diff = np.abs(a[:h] - b[:h]).mean() / 255.0
    return round(float(1.0 - diff), 4)


# ---------------------------------------------------------------- reporting

def summary_lines(rows: Sequence[Mapping[str, object]]) -> list[str]:
    """Fixed-width summary table, failures first, then a totals line."""
    ordered = sorted(rows, key=lambda r: (r.get("status") != "fail", str(r.get("route")), str(r.get("theme")), str(r.get("viewport"))))
    head = f"{'status':6} {'route':28} {'theme':5} {'viewport':8} {'axe':>3} {'ser':>3} {'con':>3} {'req':>3} {'h1':>2} {'bg':>2} {'foc':>3} {'figma':>6}"
    lines = [head, "-" * len(head)]
    for r in ordered:
        sim = r.get("figma_similarity")
        lines.append(
            f"{str(r.get('status')):6} {str(r.get('route')):28} {str(r.get('theme')):5} {str(r.get('viewport')):8} "
            f"{r.get('axe_violations', 0):>3} {r.get('axe_serious', 0):>3} {r.get('console_errors', 0):>3} "
            f"{r.get('failed_requests', 0):>3} {r.get('h1_count', 0):>2} {'y' if r.get('bg_ok') else 'n':>2} "
            f"{'y' if r.get('focus_ok') else 'n':>3} {('%.3f' % sim) if isinstance(sim, float) else '-':>6}"
        )
    failed = sum(1 for r in rows if r.get("status") == "fail")
    lines.append(f"{len(rows) - failed}/{len(rows)} cells pass, {failed} fail")
    return lines
