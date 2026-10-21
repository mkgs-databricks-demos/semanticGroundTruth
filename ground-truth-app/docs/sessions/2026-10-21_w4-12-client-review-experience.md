# Session 12: App Shell + Card-Swipe Review Experience

**Wave:** 4 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Rewrote the scaffold app shell into the Semantic Ground Truth review experience. Replaced the scaffold App.tsx (5 routes: Home, Agents, Analytics, Lakebase, Jobs) with a new router (7 routes: ReviewPage, Leaderboard, Steward, Admin, Executive, Assistant, 404). Built 3 layout components and 15 review components implementing the card-swipe UX with framer-motion drag, keyboard shortcuts, and always-visible accessible buttons. Added QueryClientProvider to main.tsx.

## Files Modified

| File | Action | Purpose |
|---|---|---|
| `client/src/main.tsx` | modified | Added QueryClientProvider with module-scope createQueryClient() |
| `client/src/App.tsx` | rewritten | createBrowserRouter with AppLayout + 7 routes; removed all scaffold pages |

## Files Created

| File | Key Exports |
|---|---|
| `client/src/components/layout/AppLayout.tsx` | `AppLayout` — header (app name, NavLinks, NotificationBell, theme toggle), Outlet, mobile bottom nav |
| `client/src/components/layout/NavLinks.tsx` | `NavLinks` — role-filtered links (Review, Leaderboard, Steward, Executive, Admin, Assistant); supports desktop, mobile sheet, and bottom-nav variants |
| `client/src/components/layout/NotificationBell.tsx` | `NotificationBell` — unread count badge, Sheet listing notifications, mark-all-read |
| `client/src/components/review/AssetTypeBadge.tsx` | `AssetTypeBadge` — Badge with variant per asset type |
| `client/src/components/review/AssetTypeFilter.tsx` | `AssetTypeFilter` — Select over ASSET_TYPES + "All" |
| `client/src/components/review/CampaignSelector.tsx` | `CampaignSelector` — Select from active campaigns |
| `client/src/components/review/ConfidenceMeter.tsx` | `ConfidenceMeter` — Progress bar + percentage + certified badge |
| `client/src/components/review/ProgressBar.tsx` | `ProgressBar` — reviewed/total progress indicator |
| `client/src/components/review/StreakBadge.tsx` | `StreakBadge` — flame icon + streak days from useUserStats |
| `client/src/components/review/SynonymChips.tsx` | `SynonymChips` — chips with approve/reject counts, thumbs actions, add input |
| `client/src/components/review/ExampleQuestions.tsx` | `ExampleQuestions` — list + approve/reject + add |
| `client/src/components/review/QueryPreview.tsx` | `QueryPreview` — useRunQuery, Table with max 20 rows, ApiError display |
| `client/src/components/review/SwipeActions.tsx` | `SwipeActions` — accessible Reject/Edit/Approve buttons with aria-labels |
| `client/src/components/review/EditSheet.tsx` | `EditSheet` — Sheet with Textareas for description/logic/displayName/feedback, submits voteType 'edit' |
| `client/src/components/review/RejectSheet.tsx` | `RejectSheet` — optional reason textarea before reject |
| `client/src/components/review/ReviewCard.tsx` | `ReviewCard` — full card layout: header, description, logic, confidence, progress, synonyms, examples, collapsible YAML, query preview, swipe actions |
| `client/src/components/review/CardStack.tsx` | `CardStack` — framer-motion drag (right>120px/velocity>600=approve, left=reject), tilt, AnimatePresence, keyboard (ArrowRight/ArrowLeft/E), prefers-reduced-motion |
| `client/src/components/review/EmptyState.tsx` | `EmptyState` — "All caught up" with party popper icon |
| `client/src/pages/review/ReviewPage.tsx` | `ReviewPage` — campaign/assetType URL search params, useNextCard, unified submit(), optimistic advance, EditSheet/RejectSheet integration, keyboard hint |

## Architecture Decisions

1. **Unified submit():** All vote paths (swipe gesture, button click, keyboard shortcut, edit sheet, reject sheet) converge on ReviewPage.submit(). Swipe and keyboard trigger submit directly for approve; reject opens RejectSheet for optional reason; edit opens EditSheet for edits — both sheets call the same submit().
2. **prefers-reduced-motion:** CardStack disables drag animations and spring transitions when the user's OS setting is active; buttons remain fully functional.
3. **URL search params for filters:** campaignId and assetType are stored in URL search params so the review state is shareable/bookmarkable.
4. **Session 13 assumption:** LeaderboardPage, StewardPage, AdminPage, ExecutivePage will be named exports at the paths imported in App.tsx. If session 13 hasn't run yet, those imports will fail at compile time (expected — they're parallel sessions in wave 4).
5. **next-themes:** Used for theme toggle; already installed in scaffold.
6. **No App.yaml changes:** No secrets or resource changes, per conventions.

## Checks

| Check | Result | Detail |
|---|---|---|
| `databricks bundle validate --strict --target dev` | **pass** | "Validation OK!" |
| Routes match Task 2 | **pass** | /, /leaderboard, /steward, /admin, /executive, /assistant, * — all present |
| No Analytics/Lakebase/Jobs imports in App.tsx | **pass** | Removed completely |
| All vote paths use same submit() | **pass** | Traced: ReviewPage.submit → CardStack.onVote → ReviewCard.onVote → SwipeActions; keyboard → swipeVote → submit; EditSheet/RejectSheet → onSubmit → submit |
| All interactive elements keyboard reachable with aria-labels | **pass** | All buttons have aria-label; swipe actions always visible; form inputs have labels |
| Only `import type` for type imports | **pass** | Verified across all 19 files |
| No direct fetch in components | **pass** | All data via hooks from client/src/lib/api |
| No enum/namespace | **pass** | Verified across all files |
| All relative imports resolve | **pass** | Python script verified all relative import paths resolve |
| TypeScript compilation (tsc -b) | **skipped** | No Node toolchain in session |

## Assumptions

1. Session 13 will create LeaderboardPage, StewardPage, AdminPage, ExecutivePage as named exports at `./pages/{leaderboard,steward,admin,executive}/{LeaderboardPage,StewardPage,AdminPage,ExecutivePage}.tsx`.
2. `@tanstack/react-query` is installed (session 02 added it to package.json).
3. `framer-motion` v12+ is installed (session 02 added it to package.json).
4. `next-themes` is already in the scaffold.

## Requests

None.
