# Session 49: Shell (S0, S11), routes, settings plumbing, API hooks for build 5

**Build 5 · wave `5-1` · edit (parallel with 50)**

Reference: `screen_inventory.md` S0, S11, F2, F6, F7, F9; `figma/_code/src/pages/ShellPage.tsx`, `FallbackPages.tsx`, `src/app/routes.tsx`; screenshots `docs/design/ui/figma/shell/`, `not-found/`, `app-error/`; header variant A.

## Steps

1. **Routes** (`client/src/App.tsx`): add `/settings`, `/steward/feedback-queue`, `/steward/conflicts`, `/steward/feedback-branches` with placeholder pages that sessions 52 and 55 replace (each placeholder file is created here under `pages/settings/SettingsPage.tsx`, `pages/steward/{FeedbackQueuePage,ConflictsPage,FeedbackBranchesPage}.tsx` and exports the final component name). Lazy-load (`React.lazy` + `Suspense` skeleton) `/steward/**`, `/executive`, `/admin`, `/settings`. `handle.title` per route. Router `errorElement` = app-error page (S11).
2. **Shell** (`components/layout/**`): header variant A; product name is a link (not `<h1>`); every page renders its own `<h1>` (F2; pages are fixed by their sessions); skip link to `#main`; nav with Databricks icons + underline active state on desktop, mobile bottom nav and drawer with the same item component (F6, F7); steward sub-nav (Console, Feedback queue, Conflicts, Feedback branches) with count badges from the three list endpoints; role-gated items show skeletons until `GET /api/me` resolves; offline banner (`role="status"`); notification bell with accessible name "Notifications (N unread)", popover states (empty "You're all caught up", error). The "Share to Slack" action in the popover is session 56's; leave a slot (`notificationActions` render prop).
3. **Theme from settings** (F9): `lib/settings/ThemeSync.tsx` seeds `next-themes` from `GET /api/me/settings` `theme` once loaded; header toggle (if kept) writes through `PUT /api/me/settings` and `localStorage` `sgt-theme`.
4. **API hooks** (`lib/api/**`, the only session that edits it in build 5): typed hooks for every build-5 endpoint, from `shared/contracts` (session 44): settings get/put, review skip + session stats, feedback queue list, conflicts list + resolve, feedback branches list + status update (with `htmlUrl`), steward badge counts, Slack channels search + share (asset, notification). Query keys in `keys.ts`. Each hook has a test with `mockApi`.
5. **Fallbacks** (S11): `NotFound` and `AppError` (Reload button; stack hidden behind a disclosure).
6. Add `// @a11y-strict` to every file this session writes. Tests: every S0 and S11 row of `ui_test_strategy.md` §8, KB K6, light + dark, axe.
7. vitest + both `tsc -b` in `/tmp/gt-49/`; `pnpm build` and print chunk sizes (`node scripts/check-bundle-size.mjs`).

## Owned paths

* `ground-truth-app/client/src/App.tsx`, `main.tsx`, `ErrorBoundary.tsx`
* `ground-truth-app/client/src/components/layout/**`
* `ground-truth-app/client/src/lib/**`
* `ground-truth-app/client/src/pages/settings/**`, `ground-truth-app/client/src/pages/steward/FeedbackQueuePage.tsx`, `ConflictsPage.tsx`, `FeedbackBranchesPage.tsx`, `ground-truth-app/client/src/pages/fallback/**`

## Dependencies

42, 43, 44
