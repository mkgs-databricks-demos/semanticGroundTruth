# Session 17 — App branded components, accessibility, Logic View

**Wave 1 · edit · run 745271774924215 · 2026-10-23**

## Scope

ui_brand_plan sections 6-7 (gaps G6, G7, G8): migrate every component to semantic tokens, vote tokens + icons + keyboard shortcuts + live region in the review flow, LogicView on ReviewCard, DashboardLink from /api/config, static a11y test.

## Problems & Root Causes

None blocking. All 16 hard-coded Tailwind palette classes (12 in SwipeActions, 2 in ExampleQuestions, 1 in StreakBadge, 1 in MetricViewPanel) replaced with semantic tokens.

## Changes

### Token migration (plan step 1)

* **SwipeActions.tsx** — replaced 12 hard-coded `border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950` etc. with `border-vote-reject/40 text-vote-reject hover:bg-vote-reject/10` (and equivalent for approve/edit). Added visible text labels, Skip button with `SkipForward` icon, ≥ 44 × 44 px minimum targets, and shortcut hints in `aria-label`.
* **ExampleQuestions.tsx** — `text-green-600` → `text-vote-approve`, `text-red-600` → `text-vote-reject`.
* **StreakBadge.tsx** — `text-orange-500` → `text-[var(--warning)]`.
* **MetricViewPanel.tsx** — `text-green-600` → `text-[var(--success)]`.

### Review flow (plan step 2)

* **CardStack.tsx** — keyboard shortcuts updated: `ArrowRight` approve, `ArrowLeft` reject, `ArrowUp` edit, `S` skip. Added swipe overlay tint (12% opacity of `--vote-approve`/`--vote-reject` via `useTransform`). Added `aria-live="polite"` region announcing "Approved/Rejected/Editing/Skipped <asset name>". Added `sr-only` keyboard shortcut hint.
* **ConfidenceMeter.tsx** — replaced Progress with a custom bar using `--confidence-low` / `--confidence-mid` / `--confidence-high` bands (< 40% / 40-69% / ≥ 70%). Numeric value colored to match band.

### LogicView (plan step 3)

* **LogicView.tsx** (NEW) — two-tab disclosure: "Plain English" (plainEnglishLogic, description, synonyms) and "Definition" (yamlContent in DM Mono, horizontally scrollable, copy button with `aria-label`). Data from existing `Asset` fields. Auto-hides when no content.
* **ReviewCard.tsx** — replaced old collapsible YAML section with `<LogicView asset={asset} />`. Card styled with `shadow-sm rounded-xl border`, asset name 20px Bold.

### DashboardLink (plan step 4)

* **DashboardLink.tsx** — reads `executive_dashboard_url` from `GET /api/config` via `useRuntimeConfig()` hook (new). Removed `import.meta.env.VITE_EXEC_DASHBOARD_URL`. Empty URL shows admin hint for `GT_EXEC_DASHBOARD_URL` env. Loading state shows Skeleton.
* **lib/api/endpoints.ts** — added `getRuntimeConfig()` calling `/api/config`.
* **lib/api/hooks.ts** — added `useRuntimeConfig()` with 5 min staleTime.
* **lib/api/keys.ts** — added `runtimeConfig` query key.

### Brand styling (plan step 5)

* **KpiCards.tsx** — KPI value 32px Bold, label 12px uppercase tracking-wider muted.
* **LeaderboardTable.tsx** — table headers 12px uppercase Medium muted. Current-user row `bg-accent`. Rank 1–3 show Medal icon with `aria-label` (Gold/Silver/Bronze).
* **MaintenanceActions.tsx** — destructive confirm pattern: first click switches to `variant="destructive"` with AlertTriangle icon, second click executes. Recompute input gets `border-input` and `aria-label`.

### ReviewPage (plan step 7 partial)

* **ReviewPage.tsx** — keyboard hint updated to `← reject · → approve · ↑ edit · S skip`.

### Static a11y test (plan step 6)

* **theme/a11y-static.test.ts** (NEW) — vitest, reads all `.tsx` under `components/` and `pages/`, fails on:
  * (a) Hard-coded Tailwind palette classes matching `(bg|text|border|ring|from|to)-(red|green|…)-NNN`
  * (b) Self-closing `<button>`/`<Button>` without `aria-label`
  * (c) `outline-none` in className without a `focus-visible:` replacement

## Decisions

* Used `text-[var(--warning)]` and `text-[var(--success)]` (arbitrary-value syntax) for tokens not registered in `@theme`; vote tokens use native utility classes (`text-vote-approve`) since session 16 registered `--color-vote-*` in `@theme`.
* LogicView doesn't duplicate synonym display (SynonymChips handles it); shows `asset.synonyms` only inside the Plain English tab disclosure as a compact summary.
* Kept `VoteType` for the skip action — assumes `'skip'` is in the union; if not, a type error will surface in the app build.

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| Hard-coded palette grep | pass | 0 matches for `(bg|text|border|ring|from|to)-(red|green|blue|yellow|amber|emerald|orange|slate|gray|zinc|rose|sky)-\d{2,3}` under `client/src` |
| LogicView.tsx exists | pass | New file, imported by ReviewCard.tsx |
| DashboardLink reads /api/config | pass | No VITE_EXEC_DASHBOARD_URL references in client/src |
| a11y-static.test.ts exists | pass | |
| All imports resolve | pass | All relative imports verified against directory listings |
| No layout/** edits | pass | 0 files under components/layout/ changed |
| No new npm dependencies | pass | Only existing lucide-react icons (Medal, SkipForward, AlertTriangle, CheckCheck, Copy) |
| bundle validate --strict | skipped | No YAML files changed |

## Files Modified

17 files (15 modified, 2 new):

* `ground-truth-app/client/src/components/review/SwipeActions.tsx`
* `ground-truth-app/client/src/components/review/ExampleQuestions.tsx`
* `ground-truth-app/client/src/components/review/StreakBadge.tsx`
* `ground-truth-app/client/src/components/review/ConfidenceMeter.tsx`
* `ground-truth-app/client/src/components/review/CardStack.tsx`
* `ground-truth-app/client/src/components/review/ReviewCard.tsx`
* `ground-truth-app/client/src/components/review/LogicView.tsx` (NEW)
* `ground-truth-app/client/src/components/executive/DashboardLink.tsx`
* `ground-truth-app/client/src/components/executive/KpiCards.tsx`
* `ground-truth-app/client/src/components/leaderboard/LeaderboardTable.tsx`
* `ground-truth-app/client/src/components/steward/MetricViewPanel.tsx`
* `ground-truth-app/client/src/components/admin/MaintenanceActions.tsx`
* `ground-truth-app/client/src/pages/review/ReviewPage.tsx`
* `ground-truth-app/client/src/lib/api/endpoints.ts`
* `ground-truth-app/client/src/lib/api/hooks.ts`
* `ground-truth-app/client/src/lib/api/keys.ts`
* `ground-truth-app/client/src/theme/a11y-static.test.ts` (NEW)
