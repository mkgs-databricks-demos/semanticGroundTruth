# Session 51: Review screen (S1, signature screen)

**Build 5 · wave `5-2` · edit (parallel)**

Reference: `screen_inventory.md` S1, F3, F5; `figma_make_brief.md` S1; `figma/_code/src/pages/ReviewPage.tsx`; screenshots `docs/design/ui/figma/review/` (all states, light/dark, 390 px); `docs/design/L200-C3_card_ui.md`.

## Steps

1. Rebuild `pages/review/ReviewPage.tsx` and `components/review/**` to the export: card with asset type badge, name as `<h1>` region heading per inventory, confidence meter (`role="meter"`, "Confidence 71%"), progress bar ("Review progress 42 of 120"), logic/query preview, synonyms, example questions; 4 actions Approve / Reject / Edit / Skip with Databricks icons and key hints (A, R, E, S).
2. **States:** loading skeleton; populated; empty (`review-empty-root`, "Switch campaign" when filtered, "View leaderboard"); **error separate from empty** (F3: `GET /api/review/next` failure → `InlineAlert` + Retry); vote-error (card stays, toast); offline (actions disabled with reason, no request); session-complete after `cardsPerSession` (from settings) votes + skips with "Keep going"; resurfaced badge "You skipped this earlier" when `resurfacedFromSkip`.
3. **Skip** (F5): `CardStack` never posts `voteType: 'skip'`; skip calls `POST /api/review/skip` with an optional reason from `SKIP_REASONS` (picker with 4 options); skip counter `review-skip-counter` = `skippedToday`; toast names the cooldown hours.
4. **Reject / Edit sheets** (`Sheet` primitive): reject needs a reason; edit requires at least one proposed value (matches session 44's refine; client-side inline error before submit).
5. **Motion:** framer-motion swipe kept; `prefers-reduced-motion` → no swipe animation, instant transitions (test).
6. `// @a11y-strict` on every file written. Tests: every S1 row of `ui_test_strategy.md` §8 incl. KB K1, F3 regression, "never posts skip vote" test, reduced-motion test, axe in light + dark.
7. vitest + both `tsc -b` in `/tmp/gt-51/`.

## Owned paths

* `ground-truth-app/client/src/pages/review/**`
* `ground-truth-app/client/src/components/review/**`

## Dependencies

49
