# Runbook — UI theming (Databricks brand, light/dark, WCAG 2.1 AA)

**Scope:** `ground-truth-app/client/**` and the MCP App card (`ground-truth-app/server/mcp/views/cardHtml.ts`).
**Built by:** sessions 16, 17 and 19 of build run `745271774924215` (branch `mg-genie-ui-brand-and-gaps`). The design is in [`docs/plans/ui_brand_plan.md`](../plans/ui_brand_plan.md).

## 1. Where the tokens live

| File | Role |
| --- | --- |
| `client/src/theme/tokens.ts` | **Single source of hex values.** `brand` (primitives), `light` and `dark` (semantic maps), `contrastPairings` (WCAG pairs the test checks). |
| `client/src/index.css` | Applies the tokens. Brand primitives as `--dbx-*` variables, semantic tokens under `:root` (light) and `.dark`, `@theme` registrations for Tailwind v4 (`--font-sans`, `--font-mono`, `--color-brand-accent`, `--color-vote-*`, durations, easings), `@font-face`, the global `:focus-visible` ring and the `prefers-reduced-motion` rule. |
| `client/src/main.tsx` | `ThemeProvider` from `next-themes` (`attribute="class"`, `defaultTheme="system"`, `storageKey="sgt-theme"`, `disableTransitionOnChange`) and framer-motion `MotionConfig reducedMotion="user"` around `App`. |
| `client/src/components/layout/AppLayout.tsx` | Header: Databricks symbol + "Semantic Ground Truth", 3-state theme toggle (light → dark → system). Its `aria-label` names the next state. |
| `server/mcp/views/cardHtml.ts` | The same semantic values as CSS variables inside the card's `<style>`, with a `@media (prefers-color-scheme: dark)` variant (Genie One controls the host theme). |

**Rule:** if you change a hex value, change it in `tokens.ts` **and** in `index.css` (and `cardHtml.ts` if the card uses it). `contrast.test.ts` reads `tokens.ts`, so a value changed only in CSS is not tested.

Dark mode is class-based: `next-themes` sets `.dark` on `<html>`. `@custom-variant dark (&:where(.dark, .dark *))` makes Tailwind `dark:` utilities follow that class. The `.dark` block is declared after the AppKit UI import so our tokens win.

### Semantic tokens (summary)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | Oat Light `#F9F7F4` | Navy 900 `#0B2026` | Page |
| `--foreground` | Navy 800 `#1B3139` | White | Body text |
| `--card` / `--popover` | White | Navy 800 | Surfaces above the page |
| `--muted` / `--muted-foreground` | Oat Medium / Gray Text `#5A6F77` | Navy 700 / Navy 400 | Secondary text and tiles (4.51:1 on muted is tight, so never lighten it) |
| `--primary` / `--primary-foreground` | Lava 700 `#BD2B26` / White | Lava 500 `#FF5F46` / Navy 900 | Buttons (decision D1) |
| `--brand-accent` | Lava 600 `#FF3621` | Lava 600 | Logo, active-nav underline, progress fill, large display text only |
| `--destructive` | Lava 700 | Lava 500 | Destructive buttons also show an icon and confirm step |
| `--success` / `--warning` / `--info` | Green 700 / Yellow 600 / Blue 600 | Green 500 / Yellow 600 / Blue 400 | Status. Warning *text* on light surfaces uses Yellow 800 `#7D5319` |
| `--border` | Gray Lines `#DCE0E2` | Navy 600 | Decorative only (cards, dividers) |
| `--input` | Navy 500 `#618794` | Navy 500 | Control boundaries (meets 1.4.11 at 3:1) |
| `--ring` | Blue 600 | Blue 400 | Focus ring |
| `--chart-1..5` | Lava 600, Blue 600, Green 600, Yellow 600, Maroon 500 | Lava 500, Blue 400, Green 500, Yellow 500, Maroon 300 | Charts (also used by the executive dashboard palette) |
| `--vote-approve/reject/edit/skip` | Green 700 / Lava 700 / Blue 600 / Gray Text | Green 500 / Lava 500 / Blue 400 / Navy 400 | Review flow buttons and swipe overlays |
| `--confidence-low/mid/high` | Lava 700 / Yellow 800 / Green 700 | Lava 500 / Yellow 600 / Green 500 | `ConfidenceMeter` bands (< 40 %, 40–69 %, ≥ 70 %) |

The full table with contrast ratios is in `ui_brand_plan.md` §3 and §7.1.

## 2. Decision D1 — primary fill

White on Lava 600 is 3.62:1. That passes only for large text, and AppKit `Button` text is 14 px medium. So the build used the plan default:

* light `--primary` = **Lava 700** `#BD2B26` with white text (5.94:1)
* dark `--primary` = **Lava 500** `#FF5F46` with Navy 900 text (5.59:1)
* Lava 600 stays the brand accent (`--brand-accent`, Tailwind `text-brand-accent` / `border-brand-accent`)

To switch to brand-exact Lava 600 fills, all button text must be bold 18.66 px or larger. The contrast test will fail if you only change the color.

## 3. Adding or changing a component

1. Use semantic utilities only: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `border-input`, `ring-ring`, `text-brand-accent`, `text-vote-approve`, and so on.
2. For a token that is not registered in `@theme`, use the arbitrary-value form: `text-[var(--warning)]`, `text-[var(--success)]`.
3. **Never** use Tailwind palette classes (`bg-red-500`, `text-green-600`, ...). `a11y-static.test.ts` fails the build on them.
4. Never use a `--dbx-*` primitive in a component. Add or reuse a semantic token instead.
5. New semantic token: add it to `light` and `dark` in `tokens.ts`, to `:root` and `.dark` in `index.css`, register it in `@theme` as `--color-<name>` if you want a utility class, and add a pairing to `contrastPairings` if it carries text or a control boundary.
6. Accessibility basics: icon-only buttons need an `aria-label`. Keep `outline-none` only together with a `focus-visible:` replacement. Touch targets are at least 44 × 44 px. Never use color as the only signal (add an icon or label). Use `motion.*` components, which follow `MotionConfig`, so reduced motion is respected.
7. Fonts: DM Sans is the default (`font-sans`). Use `font-mono` (DM Mono) only for SQL, YAML, metric-view names and API paths.

## 4. Tests

| Test | What it checks | How it runs |
| --- | --- | --- |
| `client/src/theme/contrast.test.ts` | WCAG 2.1 relative-luminance contrast for every `contrastPairings` entry in `tokens.ts` (20 pairs: text ≥ 4.5, input boundary and focus ring ≥ 3.0), plus a black-on-white = 21:1 check | vitest |
| `client/src/theme/a11y-static.test.ts` | Reads every `.tsx` under `components/` and `pages/` as text and fails on: (a) Tailwind palette classes `(bg\|text\|border\|ring\|from\|to)-(red\|green\|...)-NNN`, (b) `<button>`/`<Button>` without text or `aria-label`, (c) `outline-none` without a `focus-visible:` replacement | vitest |
| `server/mcp/views/cardHtml.test.ts` | MCP card: no `#f8f9fa`, dark variant present, light/dark token values, font stacks, `:focus-visible`, HTML escaping | vitest |

The tests run in two places:

* **Every Apps build.** `package.json` `prebuild` ends with `vitest run`, so a failing test fails the app deploy (gap G17). `vitest.config.ts` excludes `**/.venv/**` because the Apps container has a Python venv with unrelated `.test.ts` files.
* **Locally:** `cd ground-truth-app && pnpm test` (Node 22+, pnpm 11+).

Build sessions in Genie Code have no Node toolchain, so they cannot run these tests. The first run happens in the converge session's Apps build.

Render-level `vitest-axe` tests are deferred, because they need `jsdom` / `@testing-library` and a lockfile update.

## 5. Brand assets

| Asset | Location | Source |
| --- | --- | --- |
| DM Sans 400 / 400 italic / 500 / 700, DM Mono 400 / 500, `ofl.txt` | `client/public/fonts/` (served at `/fonts/*`; the gate probes `/fonts/dm-sans-regular.ttf`) | `/Shared/brandfolder/DM Sans/`, `/Shared/brandfolder/DM Mono/` |
| Header symbol (`databricks-symbol-color.svg` light, `databricks-symbol-light.svg` dark) | `client/public/brand/` | Brandfolder CDN, downloaded by `ground-truth-app/src/notebooks/download_brand_assets` (URLs looked up by filename in `/Shared/brandfolder/assets.csv`). Real files since `05e8c1a`. |
| Favicons (`favicon-16/32/48/512`, `favicon.svg`, `apple-touch-icon.png`, `favicon-192x192.png`) | `client/public/` | Same notebook. Official 16/32/48/512 px orange PNGs are used as-is; 192 px and apple-touch are derived from 512 px; `favicon.svg` = `databricks-symbol-color.svg` (`d3aefe3`). The notebook's last cell fails on `Placeholder` text, the AppKit colour `#FABFBA`, missing `#FF3621` or wrong PNG sizes; rerun it after any asset change. |
| Empty-state icons | `components/review/EmptyState.tsx` | **Not done yet.** It still uses a lucide icon. The plan (§5) calls for Databricks primary icons (`unity-catalog`, `genie`, `ai-bi`) from `/Shared/brandfolder/databricks-primary-icons-collection.csv` |

Everything is self-hosted (no Google Fonts or CDN calls at runtime), because the app runs in a HIPAA workspace. Do not change the Databricks symbol's geometry or color.

## 6. Manual checks after a deploy

These are not automated yet (session 23 listed them for the owner):

* The light/dark/system toggle flips `<html class>` and every surface switches cleanly.
* Keyboard-only voting works with ← reject, → approve, ↑ edit, S skip, and the live region announces each vote.
* Lighthouse accessibility score on the review page is at least 90 (the plan target is 95).
* Headings render in DM Sans and code blocks in DM Mono.
* MCP card in Genie One, light and dark, once the MCP Apps preview is enabled (gap G9).
