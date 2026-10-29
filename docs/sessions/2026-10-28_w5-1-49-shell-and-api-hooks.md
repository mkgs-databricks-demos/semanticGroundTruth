# Session 49 · Build 5 · wave 5-1 — shell and API hooks

Run `229891579528310`, branch `mg-genie-build-5`, mode edit. Plan: `docs/plans/build-5/49_shell_and_api_hooks.md`.

## What changed

**Routes (`client/src/App.tsx`)**
* New routes: `/settings`, `/steward/feedback-queue`, `/steward/conflicts`, `/steward/feedback-branches`. Each has a placeholder page with one `<h1>` and the final export name. Session 52 fills in Settings; session 55 fills in the steward pages.
* `/steward/**`, `/executive`, `/admin` and `/settings` are now lazy chunks (`React.lazy`), with a page-shaped skeleton as the `Suspense` fallback (`RouteFallback`). Review, Leaderboard and Assistant stay eager.
* The router root has an `errorElement` (`RouteErrorPage`). Route `*` renders the S11 not-found page inside the shell. `handle.title` covers every route.
* `appRoutes` is exported so tests can mount the real route table in a memory router.

**Shell (`client/src/components/layout/**`)**
* `AppLayout`: header variant A, with a 4 px brand bar. The product name is a link to `/`, not an `<h1>` (fixes F2). Skip link to `#main` moves focus with a click handler. The rest: offline banner, steward sub-nav on `/steward*` (stewards only), left drawer (`ui/Sheet`), and a bottom nav limited to 4 items. `notificationActions` is passed through to the bell.
* `NavItem`: one item used by desktop, drawer and bottom nav. It uses Databricks icons, marks the active route with an underline plus `aria-current`, and has no pill (F6, F7).
* `NavLinks`: role-filtered `NAV_ENTRIES`. While `GET /api/me` is pending, role-gated items show as skeletons.
* `StewardSubNav`: Console, Feedback queue, Conflicts, Feedback branches. Each has a count badge, and the count is also in the link's accessible name.
* `NotificationBell`: a popover instead of a sheet. States: populated, loading, empty ("You're all caught up"), and error (muted dot, "Notifications unavailable" tooltip, bell still focusable). The list is fetched only when the popover opens. The `notificationActions(n)` slot is where session 56 adds Share to Slack. "Mark all read" is disabled offline.
* `ShellPopover`: a non-modal dialog. Escape closes it and returns focus to the trigger (KB K6); a click outside closes it.
* `UserMenu`: name, email, roles and a Settings link.
* `ThemeToggle`: cycles light, dark, system.
* `OfflineBanner`: a `role="status"` region that is always mounted.
* `RouteFallback`: the lazy-route skeleton.
* `ShellIcons`: sun, moon, monitor and menu glyphs (see Decisions).

**Theme (`client/src/lib/settings/ThemeSync.tsx`)**
* `<ThemeSync/>` sets next-themes from `GET /api/me/settings` once and writes nothing back.
* `usePersistedTheme()` applies a theme at once (next-themes also writes `localStorage` `sgt-theme`) and then saves it with `PUT /api/me/settings`. Offline, it changes the theme locally and sends nothing.
* `main.tsx` uses the shared `THEME_STORAGE_KEY`.

**API (`client/src/lib/api/**`)**
* Endpoints: `getSlackChannels`, `shareNotificationToSlack`, `shareAssetToSlack` (plus `api.slack.*`).
* Hooks: `useSlackChannels`, `useShareNotificationToSlack`, `useShareAssetToSlack`, `useStewardBadgeCounts`, and `useReviewSessionStats`. `useReviewSessionStats` counts votes and skips on the client; `useSubmitVote` and `useSkipCard` increment it.
* Changed hooks: the steward list hooks and `useNotifications` now take `{ enabled }`.
* Keys: `reviewSession`, `slackChannels`.

**Other**
* `lib/useOnlineStatus.ts`: shared online state, read by the banner and the write actions.
* `lib/time.ts`: `formatRelativeTime`.
* Fallbacks: `pages/fallback/NotFoundPage.tsx` and `AppErrorPage.tsx`. App error shows Reload and Copy details; the error and stack sit behind a closed "Technical details" `<details>`.
* `ErrorBoundary` now renders `AppError`, so it no longer shows the stack to every user.

## Tests
* `components/layout/AppLayout.test.tsx` (23): S0 populated (nav per role, bell name "Notifications (2 unread)", active underline, notificationActions slot, account menu), loading skeletons, notifications empty and error, offline, steward sub-nav, theme write-through, KB K6 (skip link, Tab order, Escape returns focus, drawer), axe in light and dark.
* `pages/fallback/Fallback.test.tsx` (15): S11 not found and app error (disclosure, Reload, Copy details, axe in both themes), ErrorBoundary, router errorElement and 404 response, lazy routes with titles, ThemeSync seeding and later toggle.
* `lib/api/build5-hooks.test.tsx` (16): every build-5 hook checked against mockApi (method, path, query, body, data, error).
* Negative check: removing `<ThemeSync/>`, the skip-link handler or the skip counter makes the matching tests fail.

## Validation (`/tmp/gt-49`)
* `tsc -b` server and client: exit 0.
* vitest: 46 files, 1343 passed, 2 skipped. Baseline was 43 files and 1201 passed.
* `vite build` OK. Lazy chunks: StewardPage 28.1 kB, AdminPage 13.4 kB, ExecutivePage 2.9 kB, placeholder pages about 0.45 kB each. The main chunk is 801 kB (247 kB gzip) and still triggers Vite's 500 kB warning. I did not measure a baseline build; the main chunk can only be smaller than before, because these pages used to be imported eagerly.

## Decisions
* **Theme and menu glyphs:** the Databricks icon set has no sun, moon, monitor or menu icon. I ported the Figma inline SVGs into `ShellIcons.tsx` (currentColor, no hex). No lucide imports.
* **Badge counts:** there is no badge-count endpoint, so the counts come from the three list endpoints: queue `total`, conflict groups, and branches with status `proposed`. A count that is loading, failed or zero shows no badge.
* **Review session counters:** a client-only React Query cache entry that is never fetched, so invalidating `['review']` is harmless. Session 51 reads it for the session-complete panel.
* **Popovers:** a local `ShellPopover` instead of a Radix popover, to keep the KB K6 focus rules explicit and testable.

## Requests
* Session 43 harness (`client/src/test/online.ts`): `setOnline(false)` also sets React Query's `onlineManager` offline. `resetOnline()` restores `navigator.onLine` but sends no `online` event, so later tests in the same file keep paused queries. The fix is for `resetOnline()` to dispatch `online` when it restores. For now, the 49 offline test ends with `setOnline(true)`.

## Files
`client/src/App.tsx`, `main.tsx`, `ErrorBoundary.tsx`; `components/layout/{AppLayout,NavLinks,NavItem,NotificationBell,ShellPopover,ShellIcons,StewardSubNav,UserMenu,ThemeToggle,OfflineBanner,RouteFallback}.tsx`, `AppLayout.test.tsx`; `lib/api/{endpoints,hooks,keys}.ts`, `build5-hooks.test.tsx`; `lib/settings/ThemeSync.tsx`; `lib/useOnlineStatus.ts`; `lib/time.ts`; `pages/fallback/{NotFoundPage,AppErrorPage}.tsx`, `Fallback.test.tsx`; `pages/settings/SettingsPage.tsx`; `pages/steward/{FeedbackQueuePage,ConflictsPage,FeedbackBranchesPage}.tsx`.
