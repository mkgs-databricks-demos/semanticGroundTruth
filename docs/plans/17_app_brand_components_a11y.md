# 17 — App branded components, accessibility, Logic View

**Wave 1 · edit (alone) · bundle `ground-truth-app` · gaps G6, G7, G8 · depends on 16, 20**

Source of truth: `docs/plans/ui_brand_plan.md` sections 3.2, 6, 7. Use only the semantic tokens session 16 defined in `client/src/index.css`.

## Goal
Every screen uses brand tokens, the review flow is fully keyboard- and screen-reader-operable, and reviewers can see the logic behind an asset.

## Steps
1. Replace every hard-coded Tailwind palette class (16 at plan time: `review/SwipeActions.tsx` 12, `review/ExampleQuestions.tsx` 2, `review/StreakBadge.tsx` 1, `steward/MetricViewPanel.tsx` 1) with token classes (`bg-vote-approve`, `text-muted-foreground`, `border-input`, …). Re-grep at the end; zero matches is a gate line.
2. Review flow (`review/*`): approve/reject/edit/skip buttons use `--vote-*` + icon + visible label, ≥ 44 × 44 px; keyboard shortcuts ← reject, → approve, ↑ edit, S skip (ignored while a sheet or input has focus) with a `sr-only` hint; `aria-live="polite"` region announcing the last vote; swipe overlay tint from the vote token; `ConfidenceMeter` uses `--confidence-*` and shows the number.
3. `review/LogicView.tsx` (new): two tabs — "Plain English" (definition, synonyms, example questions) and "Definition" (metric-view YAML or SQL expression in DM Mono on `--muted`, horizontally scrollable, copy button with `aria-label`). Data comes from fields the review card already receives; if the SQL/YAML field is absent for an asset type, show the plain-English tab only. Render it in `ReviewCard.tsx` behind a "Show logic" disclosure (`aria-expanded`).
4. `executive/DashboardLink.tsx`: read `executive_dashboard_url` from `GET /api/config` (contract and route from session 20, via `lib/api`); remove `VITE_EXEC_DASHBOARD_URL`; open in a new tab with `rel="noopener noreferrer"`; empty URL shows the existing not-configured message with an admin hint.
5. Leaderboard, steward, admin, executive components: apply ui_brand_plan §6 rows (table header style, current-user row, KPI typography, destructive confirm dialogs).
6. `client/src/theme/a11y-static.test.ts`: read every `.tsx` under `client/src/components` and `client/src/pages` as text and fail on (a) hard-coded palette classes, (b) `<button` / `<Button` with no text child and no `aria-label`, (c) `outline-none` without `focus-visible:`. Keep the checks simple regexes; document known false-positive escapes inline.
7. Do not edit `components/layout/**` (session 16) or add dependencies.

## Done when
Wave 1 gate lines hold; manual read-through of each changed component confirms labels and focus styles.
