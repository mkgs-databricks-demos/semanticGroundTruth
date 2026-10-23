# 16 — App brand foundation: tokens, theme, fonts, assets, shell

**Wave 0 · edit · bundle `ground-truth-app` · gaps G7, G8 (foundation half)**

Source of truth: `docs/plans/ui_brand_plan.md` sections 3, 4, 5, 7.2, 8. Hex values and contrast ratios in that file are final; do not re-pick colors.

## Goal
The app renders in Databricks brand colors and DM Sans in light and dark mode, the theme toggle works, and every later component change only has to reference semantic tokens.

## Steps
1. Read `node_modules/@databricks/appkit-ui/dist/styles.css` if present (otherwise the package source in the pnpm store) and note how it selects dark mode. Record the finding in the session summary. Keep the class strategy either way; declare our `.dark` block after the `@import` so it wins.
2. `client/src/theme/tokens.ts`: export the brand primitives and the light/dark semantic maps from ui_brand_plan §3.1–3.3 as plain objects (no `enum`, no `namespace`). This is the single place hex values live in TypeScript.
3. `client/src/index.css`: delete the commented-out blocks and the `@media (prefers-color-scheme)` block. Add `@custom-variant dark (&:where(.dark, .dark *));`, `@font-face` rules, `:root` and `.dark` semantic tokens (shadcn names AppKit consumes + `--brand-accent`, `--vote-*`, `--confidence-*`, `--info`), `@theme` mapping (`--font-sans`, `--font-mono`, `--color-brand-accent`, `--color-vote-*`, durations, easings), a global `:focus-visible` ring, `color-scheme: light dark`, and the reduced-motion rule from §7.2. Add a header comment that the values mirror `theme/tokens.ts`.
4. `client/src/theme/contrast.test.ts`: WCAG relative-luminance helper; assert every pairing in ui_brand_plan §7.1 for both modes against its threshold, reading values from `tokens.ts`. Include a known-answer case (black on white = 21).
5. `client/src/main.tsx`: wrap `App` in `ThemeProvider` (`next-themes`, `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="sgt-theme"`, `disableTransitionOnChange`) and `MotionConfig reducedMotion="user"` (`framer-motion`). Keep StrictMode, ErrorBoundary, QueryClientProvider, ResourceStatusProvider order.
6. Fonts: copy from `/Workspace/Shared/brandfolder/DM Sans/` (`dm-sans-regular.ttf`, `dm-sans-italic.ttf`, `dm-sans-medium.ttf`, `dm-sans-bold.ttf`, `ofl.txt`) and `/Workspace/Shared/brandfolder/DM Mono/` (`dm-mono-regular.ttf`, `dm-mono-medium.ttf`) into `client/public/fonts/`. Binary copy with Python `shutil.copyfile` is allowed for these assets.
7. Icons: from `/Workspace/Shared/brandfolder/assets.csv` take the CDN URLs (strip query params) for `databricks-favicon-{16x16,32x32,48x48,512x512}-orange.png`, `databricks-symbol-color.svg`, `databricks-symbol-light.svg`; download into `client/public/` (favicons replace the existing files; symbols go to `client/public/brand/`). Derive `favicon-192x192.png` and `apple-touch-icon.png` (180) from the 512 with Pillow if available, otherwise reuse the 512 and note it. `favicon.svg` = the color symbol.
8. `client/index.html`: title `Semantic Ground Truth`, `<meta name="theme-color">` for both schemes, preload `dm-sans-regular.ttf`. `client/public/site.webmanifest`: names, `theme_color #1B3139`, `background_color #F9F7F4`.
9. `client/src/components/layout/AppLayout.tsx` + `NavLinks.tsx`: symbol (light/dark variant via `resolvedTheme`) + product name in DM Sans Bold; active link = 2 px `--brand-accent` underline + medium weight; theme toggle cycles light → dark → system with an `aria-label` naming the next state; `<nav aria-label>` on desktop and bottom nav. `App.tsx`: per-route `document.title`.
10. No new npm dependencies; do not touch `pnpm-lock.yaml`.

## Done when
Wave 0 gate lines for 16 hold; `contrast.test.ts` would pass for the values in §7.1 (compute them in Python in the session to confirm before writing); no file outside `owned_paths` changed.
