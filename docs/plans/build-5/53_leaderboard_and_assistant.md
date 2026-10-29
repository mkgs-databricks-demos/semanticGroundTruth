# Session 53: Leaderboard (S2) + Assistant (S3)

**Build 5 · wave `5-2` · edit (parallel)**

Reference: `screen_inventory.md` S2, S3, F10; `figma_make_brief.md` S2, S3; `figma/_code/src/pages/LeaderboardPage.tsx`, `AssistantPage.tsx`; screenshots `docs/design/ui/figma/leaderboard/`, `assistant/`.

## Steps

1. **Leaderboard:** period tabs (arrow keys change period; request `period=30d` parsed by `LeaderboardQuery`), ranked table, current-user row marked "You", medals with `aria-label`, skipped stat shown but not a rank or sort column; loading (5 skeleton rows), empty (`leaderboard-empty-root`, "Start reviewing" → `/`), error + Retry, offline note.
2. **Assistant:** reviewer-facing copy (F10: no file paths); 3 starter prompts that send on click; `role="log"` message list with `data-role`; input disabled while streaming; error + Try again; no-agent state; offline disables input. Keep the existing agents hook (mock it at module level in tests). Traces are recorded server-side by session 45; nothing to do client-side.
3. `// @a11y-strict` on every file written. Tests: every S2 and S3 row of `ui_test_strategy.md` §8, axe light + dark.
4. vitest + both `tsc -b` in `/tmp/gt-53/`.

## Owned paths

* `ground-truth-app/client/src/pages/leaderboard/**`, `ground-truth-app/client/src/components/leaderboard/**`
* `ground-truth-app/client/src/pages/agents/**`, `ground-truth-app/client/src/components/assistant/**`

## Dependencies

49
