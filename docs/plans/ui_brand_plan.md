# UI Brand Plan — Semantic Ground Truth App

**Date:** 2026-10-23 · **Branch:** `mg-genie-ui-brand-and-gaps` · **Scope:** `ground-truth-app/client/**` and `ground-truth-app/server/mcp/views/cardHtml.ts`
**Closes gaps:** G7 (theme/brand), G8 (accessibility), G9 (MCP card brand) from `docs/plans/gap_analysis_2026-10.md`
**Brand sources:** Databricks Extended Brand Guidelines (colors, typography, design approach, assets), `/Shared/brandfolder/` (fonts + `assets.csv`). Every contrast ratio below was recomputed with the WCAG 2.1 relative-luminance formula on 2026-10-23, not copied from the guide.

## 1. Goals

* **Distilled** — one accent family (Lava), Navy/Oat/White surfaces, no decorative chrome. Remove before adding.
* **Bold** — Lava CTAs, DM Sans Bold headings, a confident card-review surface (the product's signature screen).
* **Fresh** — light and dark mode that actually work, motion that explains swipes, modern spacing on an 8 px grid.
* **Accessible** — WCAG 2.1 AA on every text, control, and focus indicator pairing in both modes (design NFR, L200-C3).
* **Non-invasive** — keep `@databricks/appkit-ui` components; re-skin them through their CSS variables instead of forking.

## 2. Current state (evidence)

| Area | Finding | File |
| --- | --- | --- |
| Tokens | All brand overrides commented out; stock AppKit/shadcn neutral palette in both modes. Dark mode is `prefers-color-scheme` only. | `client/src/index.css` L3–82 |
| Theme toggle | `AppLayout` calls `next-themes` `useTheme()` but no `ThemeProvider` wraps the tree, so `setTheme` is a no-op and the Sun/Moon `dark:` classes never flip. | `client/src/components/layout/AppLayout.tsx` L15, L29–53; `client/src/main.tsx` |
| Typography | No `@font-face`; AppKit default sans. No DM Mono for SQL/YAML. | `client/src/index.css` |
| Title / PWA | `<title>ground-truth-app</title>`; manifest `name`/`short_name` = `ground-truth-app`, `theme_color` `#ffffff`. | `client/index.html` L12; `client/public/site.webmanifest` |
| Favicon | AppKit template icon (Lava 300 shapes), not the Databricks symbol. | `client/public/favicon*.png`, `favicon.svg` |
| Hard-coded colors | 16 Tailwind palette classes bypass tokens: 12 in `SwipeActions.tsx`, 2 `ExampleQuestions.tsx`, 1 `StreakBadge.tsx`, 1 `MetricViewPanel.tsx`. | grep `(bg|text|border|ring)-(red|green|…)-NNN` |
| Reduced motion | Honoured only in `CardStack.tsx`. | grep `useReducedMotion` |
| MCP card | Inline hex (`#f8f9fa` off-brand, Lava/Navy correct), light mode only. | `server/mcp/views/cardHtml.ts` L51–116 |
| Libraries present | `next-themes` 0.4.6, `framer-motion` ^12.23, `lucide-react`, `vitest` 4.1.9. No new runtime dependency is needed. | `ground-truth-app/package.json` |

## 3. Token architecture

Two layers, both in `client/src/index.css`:

1. **Brand primitives** — `--dbx-*` hex variables (full Lava/Navy/Green/Yellow/Blue/Maroon scales + Oat + functional grays). Never referenced directly by components.
2. **Semantic tokens** — the shadcn variable names AppKit UI already consumes (`--background`, `--primary`, `--border`, `--ring`, `--chart-N`, `--sidebar-*`, plus AppKit's `--success`/`--warning`), assigned from primitives. App-specific semantic tokens are added for the review flow (`--vote-approve`, `--vote-reject`, `--vote-edit`, `--vote-skip`).

Dark mode switches on a `.dark` class on `<html>` (set by `next-themes`), with Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));`. The `@media (prefers-color-scheme)` block is removed; `system` is handled by `next-themes` `defaultTheme="system"`. **Verify first** (session 16 step 1): inspect `node_modules/@databricks/appkit-ui/dist/styles.css` for its dark selector. If it ships `@media` dark rules, keep the class strategy and re-declare the dark tokens under `.dark` *after* the import so ours win.

### 3.1 Semantic mapping

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--background` | Oat Light `#F9F7F4` | Navy 900 `#0B2026` | Page |
| `--foreground` | Navy 800 `#1B3139` | White | 12.71 / 16.82 |
| `--card`, `--popover` | White | Navy 800 `#1B3139` | Cards sit above page |
| `--card-foreground` | Navy 800 | White | 13.59 / 13.59 |
| `--muted` | Oat Medium `#EEEDE9` | Navy 700 `#143D4A` | |
| `--muted-foreground` | Gray Text `#5A6F77` | Navy 400 `#90A5B1` | 4.94 on Oat Light, 4.51 on Oat Medium / 6.57 on Navy 900, 4.57 on Navy 700 |
| `--primary` | Lava 700 `#BD2B26` | Lava 500 `#FF5F46` | See D1 |
| `--primary-foreground` | White | Navy 900 `#0B2026` | 5.94 / 5.59 |
| `--brand-accent` | Lava 600 `#FF3621` | Lava 600 | Logo, active-nav bar, progress fill, large display text only |
| `--secondary`, `--accent` | Oat Medium | Navy 700 | Hover fills |
| `--secondary-foreground`, `--accent-foreground` | Navy 800 | White | |
| `--destructive` | Lava 700 | Lava 500 | Same as primary; destructive buttons add an icon + confirm text so color is not the only cue |
| `--success` / fg | Green 700 `#00875C` / White | Green 500 `#42BA91` / Navy 900 | Fill text 4.55 / 6.94; as text on card 4.55 / 5.61 (Green 600 is 4.48 on Navy 800 — fails, so not used for dark text) |
| `--warning` / fg | Yellow 600 `#FFAB00` / Navy 900 | Yellow 600 / Navy 900 | 8.87; warning *text* on light surfaces uses Yellow 800 `#7D5319` (6.72) |
| `--info` / link | Blue 600 `#2272B4` | Blue 400 `#8ACAFF` | 4.75 on Oat Light / 7.75 on Navy 800 |
| `--border` (decorative) | Gray Lines `#DCE0E2` | Navy 600 `#1B5162` | Card/divider only — not a control boundary |
| `--input` (control boundary) | Navy 500 `#618794` | Navy 500 | 3.9 on White / 3.50 on Navy 800 — meets 1.4.11 (Gray Lines 1.33 and Navy 400 2.56 do not) |
| `--ring` | Blue 600 | Blue 400 | 4.75 on Oat Light / 9.59 on Navy 900 |
| `--sidebar` / fg | Oat Light / Navy 800 | Gray Nav `#303F47` / White | |
| `--radius` | `0.5rem` (8 px) | | Buttons/inputs 8 px, cards 12 px |

**D1 — Primary button color (decision for review).** White on Lava 600 is 3.62:1, which passes only for *large* text (≥ 24 px regular or ≥ 18.66 px bold). AppKit `Button` default is 14 px medium, so Lava 600 fills would fail 1.4.3. Plan: `--primary` = Lava 700 in light mode (5.94) and Lava 500 with Navy 900 text in dark mode (5.59); Lava 600 stays the brand accent via `--brand-accent` and is allowed on `size="lg"` bold CTAs. If you prefer brand-exact Lava 600 fills, the alternative is bold 18.66 px button text everywhere — not recommended for dense steward/admin screens.

### 3.2 Review-flow tokens

| Token | Light | Dark | Used by |
| --- | --- | --- | --- |
| `--vote-approve` | Green 700 | Green 500 | Approve button, right-swipe overlay, ConfidenceMeter high band |
| `--vote-reject` | Lava 700 | Lava 500 | Reject button, left-swipe overlay |
| `--vote-edit` | Blue 600 | Blue 400 | Edit button, up-swipe overlay |
| `--vote-skip` | Gray Text `#5A6F77` | Navy 400 | Skip (4.94 / 5.31; Navy 500 was rejected at 3.64 on Oat Light) |
| `--confidence-low/mid/high` | Lava 700 / Yellow 800 / Green 700 | Lava 500 / Yellow 600 / Green 500 | `ConfidenceMeter.tsx` |

Each vote also carries an icon (`Check`, `X`, `Pencil`, `SkipForward`) and a text label, so color is never the only signal (1.4.1).

### 3.3 Charts

`--chart-1..5` = Lava 600, Blue 600, Green 600, Yellow 600, Maroon 500 (light); Lava 500, Blue 400, Green 500, Yellow 500, Maroon 300 (dark). Series also differ by label/legend, never color alone. These are non-text marks so ≥ 3:1 against the card surface is the bar (all pass except Yellow 600 on White, 1.9 — use it only with a Navy 800 outline or as the last series).

## 4. Typography

* Copy six TTFs from `/Shared/brandfolder/DM Sans/` (400, 400 italic, 500, 700) and `/Shared/brandfolder/DM Mono/` (400, 500) into `client/public/fonts/`, plus `ofl.txt`. Self-hosted (no Google Fonts CDN — the app runs in a HIPAA workspace and should not make third-party requests).
* `@font-face` with `font-display: swap`; `--font-sans: "DM Sans", system-ui, sans-serif`; `--font-mono: "DM Mono", ui-monospace, monospace` in `@theme`.
* Scale (8 px rhythm): 12 caption/badge, 14 table/body-dense, 16 body, 20 card title, 24 page H2, 32 page H1. Line height 1.5 body / 1.2 headings. Headings Bold 700, labels/nav Medium 500.
* DM Mono only for SQL, YAML, metric-view names, API paths (`QueryPreview.tsx`, `MetricViewPanel.tsx`, future `LogicView`).
* Left-aligned text everywhere except the empty-state hero.

## 5. Assets and identity

| Item | Change | Source |
| --- | --- | --- |
| Favicons | Replace 16/32/48/512 PNG with `databricks-favicon-*-orange.png`; regenerate 192 and apple-touch from 512 | `/Shared/brandfolder/assets.csv` (Symbols & Favicons) |
| `favicon.svg` | `databricks-symbol-color.svg` | brandfolder CDN, downloaded once and committed |
| Header mark | `databricks-symbol-color.svg` (light) / `databricks-symbol-light.svg` (dark), 24 px, followed by "Semantic Ground Truth" in DM Sans Bold | Do not recreate or recolor the lockup; product name is plain text beside the symbol |
| Title | `<title>Semantic Ground Truth</title>`; per-route `document.title` = `"<Page> · Semantic Ground Truth"` | `client/index.html`, `App.tsx` |
| Manifest | `name` "Semantic Ground Truth", `short_name` "Ground Truth", `theme_color` `#1B3139`, `background_color` `#F9F7F4` | `client/public/site.webmanifest` |
| Empty states | Navy primary icons (light) / white (dark) from `databricks-primary-icons-collection.csv` — `unity-catalog`, `genie`, `ai-bi` — 64 px in a `--muted` tile | `components/review/EmptyState.tsx` |

All assets are committed into `client/public/` (no runtime CDN calls). A small one-off notebook or the session agent downloads them from the CDN URLs in `assets.csv`.

## 6. Component plan

| Surface | Change | Files |
| --- | --- | --- |
| Provider | Wrap the tree in `ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="sgt-theme" disableTransitionOnChange` | `client/src/main.tsx` |
| Header / nav | Symbol + name; active link = 2 px `--brand-accent` underline + `font-medium` (not a filled Lava pill); theme toggle cycles light/dark/system with an `aria-label` that names the next state | `layout/AppLayout.tsx`, `layout/NavLinks.tsx` |
| Review card | White/Navy 800 card, 12 px radius, `shadow-sm`; asset name 20 px Bold; type badge; definition 16 px; synonyms as `--muted` chips; SQL in DM Mono on `--muted` | `review/ReviewCard.tsx`, `SynonymChips.tsx`, `QueryPreview.tsx`, `AssetTypeBadge.tsx` |
| Swipe actions | Replace 12 hard-coded classes with `--vote-*` tokens; 44 × 44 px minimum targets; visible labels; keyboard shortcuts (←/→/↑/S) announced in a `sr-only` hint | `review/SwipeActions.tsx` |
| Swipe overlay | Directional tint at 12 % opacity of the vote token + large icon; reduced motion = no translate, immediate state change | `review/CardStack.tsx` |
| Progress / streak | Progress fill `--brand-accent`; streak badge `--warning` with Navy 900 text | `ProgressBar.tsx`, `StreakBadge.tsx` |
| Confidence | `--confidence-*` bands + numeric value text | `ConfidenceMeter.tsx` |
| Leaderboard | Table header `--muted` 12 px uppercase Medium; current user row `--accent`; rank 1–3 medal icons with `aria-label` | `leaderboard/*` |
| Steward / admin | Forms use `--input` borders and `--ring`; destructive maintenance actions = destructive variant + confirm dialog | `steward/*`, `admin/*` |
| Executive | KPI cards: 32 px Bold value, 12 px muted label, delta badge success/destructive with arrow icon | `executive/KpiCards.tsx` |
| Example questions / metric panel | Remove the remaining hard-coded palette classes | `ExampleQuestions.tsx`, `MetricViewPanel.tsx` |
| MCP App card | Replace inline hex with the same semantic values (CSS variables in the `<style>` block) and add a `@media (prefers-color-scheme: dark)` variant, since Genie One controls the host theme; `#f8f9fa` → Oat Light | `server/mcp/views/cardHtml.ts` |

## 7. Accessibility (WCAG 2.1 AA)

### 7.1 Verified pairings (recomputed 2026-10-23)

| Pairing | Light | Dark | Requirement |
| --- | --- | --- | --- |
| Body text on page | 12.71 | 16.82 | 4.5 |
| Body text on card | 13.59 | 13.59 | 4.5 |
| Muted text on page | 4.94 | 6.57 | 4.5 |
| Muted text on muted surface | 4.51 | 4.57 | 4.5 (tight — never lighten) |
| Primary button text | 5.94 | 5.59 | 4.5 |
| Success (text or fill) | 4.55 | 5.61 | 4.5 |
| Link / info text | 4.75 | 7.75 | 4.5 |
| Warning text | 6.72 (Yellow 800) | 7.17 (Yellow 600) | 4.5 |
| Input boundary | 3.90 | 3.50 | 3.0 (1.4.11) |
| Focus ring | 4.75 | 9.59 | 3.0 (1.4.11) |

Rejected candidates (all fail): white on Lava 600 at 14 px (3.62), white on Lava 500 (3.01), Green 600 text on Navy 800 (4.48), Gray Lines as input border (1.33), Navy 400 as light input border (2.56).

### 7.2 Rules

* **Contrast unit test** — `client/src/theme/contrast.test.ts` imports a `tokens.ts` table (the single source of the hex values also used to generate `index.css` comments) and asserts every pairing in §7.1 per mode. Fails CI if a token change drops below threshold.
* **Focus** — global `:focus-visible` 2 px `--ring` with 2 px offset in `--background`; never `outline: none` without a replacement.
* **Reduced motion** — global `@media (prefers-reduced-motion: reduce)` rule zeroing transitions/animations, plus framer-motion `MotionConfig reducedMotion="user"` at the root so every `motion.*` component honours it (today only `CardStack` does).
* **Keyboard** — every swipe action reachable by button and shortcut; sheets/dialogs trap focus (AppKit Sheet does) and return focus on close.
* **Semantics** — one `<h1>` per page, landmark `<nav aria-label>` for desktop and bottom nav, live region (`aria-live="polite"`) announcing "Approved <asset>" after a vote.
* **Forced colors** — borders use `border` (not only `box-shadow`) so cards stay visible in Windows High Contrast.
* **Automated audit** — no new dependencies this build: `jsdom`/`@testing-library` are not in `package.json`, and build sessions have no Node toolchain to refresh `pnpm-lock.yaml`. Instead, a static vitest (`client/src/theme/a11y-static.test.ts`) reads the component sources and fails on hard-coded palette classes, `<button>` elements without text or `aria-label`, and `outline-none` without `focus-visible:ring`. Render-level `vitest-axe` tests are deferred until a lockfile update can be done interactively. Manual Lighthouse pass on the deployed app recorded in the session doc.

## 8. Motion

* Tokens in `@theme`: `--duration-fast 100ms`, `--duration-normal 200ms`, `--duration-moderate 300ms`; `--ease-out cubic-bezier(0.16,1,0.3,1)`, `--ease-in cubic-bezier(0.7,0,0.84,0)`.
* Card exit after vote: 200 ms ease-in translate + fade; next card enter: 200 ms ease-out scale 0.98 → 1. Drag follows the pointer with no easing.
* Buttons/rows: color transitions 100 ms. Sheets: AppKit defaults.
* `ease-spring` only for the streak milestone badge; never on errors.
* No auto-playing decorative animation. `disableTransitionOnChange` on theme switch prevents a full-page color flash.

## 9. Delivery (maps to the next build manifest)

| Session | Content | Acceptance |
| --- | --- | --- |
| 16 `app_brand_foundation` | §3 tokens, ThemeProvider + `MotionConfig`, `.dark` variant, §4 fonts, §5 assets/title/manifest, header/nav, `tokens.ts` + contrast test, global focus + reduced-motion rules | `tsc -b` clean; contrast test green; toggle flips `<html class>`; fonts served from `/fonts/*` (200) |
| 17 `app_brand_components_a11y` | §6 component migration, zero hard-coded palette classes, keyboard shortcuts, live region, Logic View, static a11y test | grep for `-(red|green|blue|yellow|amber|emerald|orange|slate|gray|zinc)-[0-9]` in `client/src` returns 0; `a11y-static.test.ts` present |
| 19 `app_mcp_card_brand` | §6 MCP card tokens + dark variant | `cardHtml.test.ts` asserts no `#f8f9fa`, both schemes present |
| 23 `converge_app` | Deploy, run vitest in the Apps build, Lighthouse a11y ≥ 95 recorded in the session doc | runtime gate clean (no `ERROR` / `"level":"error"`), probes pass |

## 10. Risks and open questions

* **AppKit UI dark selector** — if `appkit-ui/styles.css` hard-codes `@media` dark rules, class-based dark mode needs the override order described in §3. Checked in session 16 before any component work.
* **D1** — primary fill Lava 700 vs Lava 600 (needs your call; plan defaults to Lava 700).
* **Brand-asset licensing** — Databricks symbol use in an internal app is within brand guidance; do not alter the mark's geometry or color.
* **Font weight** — DM Sans Black (900) is not in the shared library; Bold (700) is the heaviest weight used.
* **Genie One host theme** — MCP card dark mode relies on `prefers-color-scheme` inside the iframe; verify when MCP Apps preview is enabled (G9).
