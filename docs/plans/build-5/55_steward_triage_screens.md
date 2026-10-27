# Session 55: Steward triage: Feedback queue (S8), Conflicts (S9), Feedback branches (S10)

**Build 5 · wave `5-3` · edit (parallel with 56)**

Reference: `screen_inventory.md` S8-S10; `figma_make_brief.md` S8-S10; `figma/_code/src/pages/FeedbackQueuePage.tsx`, `ConflictsPage.tsx`, `FeedbackBranchesPage.tsx`; screenshots `docs/design/ui/figma/steward-feedback-queue/`, `steward-conflicts/`, `steward-feedback-branches/`. APIs: steward triage endpoints from build 4 (plan 27) with session 44's `htmlUrl`; hooks from session 49 (`lib/api`, do not edit).

## Steps

1. All three pages use session 54's `RoleGate` (loading / error / forbidden) and the steward sub-nav from session 49.
2. **Feedback queue:** rows with `data-asset-id`; vote bar with an accessible name (counts, not color only); "Often skipped" badge rule from the inventory; filters with filtered-empty + Clear filters; empty CTA; error / offline; KB K3.
3. **Conflicts:** groups with current value and proposals, `DiffText` `<ins>`/`<del>`; radiogroup to pick the winner (named); resolving disables buttons; resolved removes the group and the toast names the authors; stale (409/404) → alert + Refresh; empty / error / offline; KB K2.
4. **Feedback branches:** cards with `StatusBadge` (text + icon); expand shows files; **Open on GitHub** link when `htmlUrl` is set ("opens in a new tab"), copy-branch-name button always; status change `POST …/:batchId/status` parsed by `UpdateFeedbackBranchStatusRequest`, confirm dialog for rejected; failed-branch, updating, empty / error / offline; KB K4.
5. Components in `components/steward-triage/**`. `// @a11y-strict` on every file written. Tests: every S8, S9, S10 row of `ui_test_strategy.md` §8 incl. K2-K4, axe light + dark. Fixtures with `htmlUrl` live next to these tests.
6. vitest + both `tsc -b` in `/tmp/gt-55/`.

## Owned paths

* `ground-truth-app/client/src/pages/steward/FeedbackQueuePage.tsx`, `ConflictsPage.tsx`, `FeedbackBranchesPage.tsx`
* `ground-truth-app/client/src/components/steward-triage/**`

## Dependencies

44, 49, 54
