# Session 19 — App MCP card brand (light + dark)

**Wave:** 0 · **Mode:** edit · **Date:** 2026-10-23 · **Run:** 745271774924215
**Gap:** G9 · **Plan:** `docs/plans/19_app_mcp_card_brand.md`

## Summary

Replaced all inline hex colors in the MCP App card (`server/mcp/views/cardHtml.ts`) with CSS custom properties sourced from `ui_brand_plan.md` §3.1/§3.2. Added a `@media (prefers-color-scheme: dark)` block with correct dark-mode token overrides. Updated font stacks to DM Sans (body) and DM Mono (logic text). Added a `:focus-visible` rule with the Blue 600/400 ring token.

## Changes

### `ground-truth-app/server/mcp/views/cardHtml.ts` (edited)

- Defined 14 CSS custom properties under `:root` (light mode) with dark-mode overrides under `@media (prefers-color-scheme: dark)`.
- **Light tokens:** `--page-bg` Oat Light `#F9F7F4`, `--text` Navy 800, `--text-secondary` Gray Text `#5A6F77`, `--surface` White, `--header-bg` Navy 800, `--brand-accent` Lava 600, `--primary` Lava 700 `#BD2B26` (5.94 contrast with white), `--border` Gray Lines `#DCE0E2`, `--ring` Blue 600.
- **Dark tokens:** `--page-bg` Navy 900 `#0B2026`, `--text` White, `--text-secondary` Navy 400 `#90A5B1`, `--surface` Navy 800, `--header-bg` Navy 900, `--brand-accent` Lava 500 `#FF5F46`, `--primary` Lava 500 (5.59 contrast with Navy 900), `--border` Navy 600 `#1B5162`, `--ring` Blue 400 `#8ACAFF`.
- **Fonts:** `--font-sans: "DM Sans", system-ui, sans-serif` on body; `--font-mono: "DM Mono", ui-monospace, monospace` on `.logic`.
- Removed off-brand `#f8f9fa`. No `font-face` (plan says no font download inside the iframe).
- Added `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`.
- All HTML escaping (`escHtml`) and template logic unchanged. No tool names or response shapes changed.

### `ground-truth-app/server/mcp/views/cardHtml.test.ts` (created)

- 9 vitest tests covering: no `#f8f9fa`, `prefers-color-scheme: dark` present, XSS escaping of `<script>` in asset name, DM Sans + DM Mono font stacks, CSS custom property usage, light-mode token values, dark-mode token values, `:focus-visible` rule, and content rendering.
- Written, not run (no Node toolchain in build sessions per conventions).

## Checks

| Check | Result | Detail |
|---|---|---|
| No `#f8f9fa` in cardHtml.ts | pass | Searched full file — not present |
| `prefers-color-scheme: dark` in cardHtml.ts | pass | Line 64 |
| `#FF3621` still present (existing test compat) | pass | Line 55 (`--brand-accent`) |
| `#1B3139` still present (existing test compat) | pass | Lines 50, 53, 69 |
| No files outside `server/mcp/views/**` | pass | Only cardHtml.ts edited, cardHtml.test.ts created |
| bundle validate --strict | skipped | No YAML files changed |
| vitest | skipped | No Node toolchain in sessions |

## Decisions

- **Badge uses `--primary` (Lava 700/500) not `--brand-accent` (Lava 600):** Badge text is 11px bold. White-on-Lava-600 is 3.62 (fails WCAG AA normal text). Lava 700 in light (5.94) and Lava 500 + Navy 900 in dark (5.59) both pass.
- **Dark header = Navy 900:** Card surface in dark mode is Navy 800. Header uses Navy 900 (same as page bg) to maintain the "header darker than body" hierarchy. The card's border-radius + shadow visually separates header from page background.
- **`.logic` uses DM Mono:** Plan says DM Mono for "SQL, YAML, metric-view names". The logic field often contains SQL-like expressions (`SUM(amount) WHERE ...`).

## Requests

None.
