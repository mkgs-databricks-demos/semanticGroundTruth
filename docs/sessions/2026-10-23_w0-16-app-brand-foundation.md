# Session 16 — App brand foundation: tokens, theme, fonts, assets, shell

**Wave 0 · edit · Run 745271774924215 · Branch `mg-genie-ui-brand-and-gaps`**

## Summary

Implemented the brand foundation layer for the Semantic Ground Truth app: Databricks brand tokens (light + dark), self-hosted DM Sans / DM Mono fonts, ThemeProvider + MotionConfig at the app root, per-route document.title, updated header with symbol + 3-state theme toggle, brand-accent active-link underlines, WCAG contrast test, global focus ring, and reduced-motion rule.

## AppKit dark mode finding (plan step 1)

Could not inspect `node_modules/@databricks/appkit-ui/dist/styles.css` directly — no `node_modules` is present in the workspace (expected; no Node toolchain in build sessions). Strategy: declare our `.dark` block AFTER the `@import "@databricks/appkit-ui/styles.css"` so our tokens win regardless of whether AppKit uses `@media` or `.dark` for dark mode. Added `@custom-variant dark (&:where(.dark, .dark *))` for Tailwind v4.

## WCAG 2.1 AA contrast verification

All 20 pairings from `ui_brand_plan.md` §7.1 verified in Python before writing `contrast.test.ts`. Known-answer sanity check (black on white = 21.00) passed. All ratios meet or exceed thresholds.

## Files created

| File | Purpose |
| --- | --- |
| `ground-truth-app/client/src/theme/tokens.ts` | Brand primitives + light/dark semantic maps + contrast pairings |
| `ground-truth-app/client/src/theme/contrast.test.ts` | Vitest: WCAG relative-luminance helper + assertions for all 20 pairings |
| `ground-truth-app/client/public/fonts/dm-sans-regular.ttf` | DM Sans 400 |
| `ground-truth-app/client/public/fonts/dm-sans-italic.ttf` | DM Sans 400 italic |
| `ground-truth-app/client/public/fonts/dm-sans-medium.ttf` | DM Sans 500 |
| `ground-truth-app/client/public/fonts/dm-sans-bold.ttf` | DM Sans 700 |
| `ground-truth-app/client/public/fonts/dm-mono-regular.ttf` | DM Mono 400 |
| `ground-truth-app/client/public/fonts/dm-mono-medium.ttf` | DM Mono 500 |
| `ground-truth-app/client/public/fonts/ofl.txt` | OFL license |
| `ground-truth-app/client/public/brand/databricks-symbol-color.svg` | Placeholder — needs manual CDN download |
| `ground-truth-app/client/public/brand/databricks-symbol-light.svg` | Placeholder — needs manual CDN download |

## Files modified

| File | Change |
| --- | --- |
| `ground-truth-app/client/src/index.css` | Full rewrite: removed commented-out oklch blocks, added @font-face (6 faces), @custom-variant dark, @theme (fonts, durations, easings), :root brand primitives, :root semantic tokens, .dark semantic tokens, global :focus-visible ring, reduced-motion rule |
| `ground-truth-app/client/src/main.tsx` | Wrapped tree in ThemeProvider (attribute="class", defaultTheme="system", storageKey="sgt-theme", disableTransitionOnChange) and MotionConfig (reducedMotion="user") |
| `ground-truth-app/client/src/App.tsx` | Added PageTitle component using useMatches + handle.title for per-route document.title |
| `ground-truth-app/client/index.html` | Title "Semantic Ground Truth", meta theme-color for both schemes, preload dm-sans-regular.ttf |
| `ground-truth-app/client/public/site.webmanifest` | name/short_name updated, theme_color #1B3139, background_color #F9F7F4 |
| `ground-truth-app/client/src/components/layout/AppLayout.tsx` | Databricks symbol + DM Sans Bold product name, 3-state theme toggle (light/dark/system), ThemeIcon component, aria-label naming next state, aria-label on mobile nav |
| `ground-truth-app/client/src/components/layout/NavLinks.tsx` | Active link: 2px border-brand-accent underline + font-medium (replaces bg-primary pill), aria-label on nav |

## Files regenerated (binary)

| File | Source |
| --- | --- |
| `ground-truth-app/client/public/favicon-192x192.png` | Resized from favicon-512x512.png via Pillow |
| `ground-truth-app/client/public/apple-touch-icon.png` | Resized to 180×180 from favicon-512x512.png via Pillow |

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| WCAG contrast (20 pairings) | pass | All ratios verified in Python |
| ThemeProvider wraps App | pass | attribute="class", defaultTheme="system" |
| MotionConfig wraps App | pass | reducedMotion="user" |
| index.css: no oklch comments | pass | All commented-out blocks removed |
| index.css: :root + .dark tokens | pass | --background, --foreground, --primary, --input, --ring in both |
| Fonts present | pass | 5 required files in client/public/fonts/ |
| index.html title | pass | "Semantic Ground Truth" |
| site.webmanifest theme_color | pass | #1B3139 |
| tokens.ts + contrast.test.ts exist | pass | Both created |
| bundle validate --strict | skipped | No YAML files changed |

## Decisions

- **D1 (primary button color):** Followed the plan default — Lava 700 (#BD2B26) for light --primary (5.94:1 with white text), Lava 500 (#FF5F46) with Navy 900 text for dark (5.59:1). Lava 600 reserved for --brand-accent (large text, logo, nav bar, progress fill).
- **SVG imports:** Used URL string constants (not ES module imports) for public/ assets, matching Vite’s static file serving.
- **Per-route title:** Used react-router `handle.title` + `useMatches()` pattern — no new dependency needed.

## Requests (for other sessions / manual steps)

- Replace `client/public/brand/databricks-symbol-color.svg` and `databricks-symbol-light.svg` with the real Databricks symbol SVGs from the brandfolder CDN (URLs in the placeholder comments). Genie Code serverless blocks external CDN downloads.
- Replace `client/public/favicon-*.png` and `favicon.svg` with Databricks-branded orange favicons from the brandfolder CDN. Current files are the AppKit scaffold template icons (Lava 300 geometric shapes) and the regenerated 192/apple-touch from the 512.
