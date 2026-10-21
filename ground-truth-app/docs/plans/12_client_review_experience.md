# Session 12: App Shell + Card-Swipe Review Experience (Phase I, part 1)

## Scope
Replace the scaffold shell with the Ground Truth app shell (router, layout, nav, notifications bell, React Query provider) and build the primary review experience at `/`: swipeable review cards with approve / reject / edit, synonyms and example-question actions, validation query preview, progress and streak indicators. Session 13 builds the secondary pages in parallel; this session wires their routes using the fixed page paths below.

## Context
* `../docs/design/L200-C3_card_ui.md` (component tree, gestures, mobile-first), `L300-13_frontend_implementation.md`, `L100_semantic_ground_truth_app.md` § UX + gamification.
* Hooks from `client/src/lib/api` (session 10) — read session 10's summary for the hook list. Never call `fetch` directly from components.
* `build_conventions.md` §2-3 (client TS rules, appkit-ui components). `framer-motion` ^12 (`motion.div`, `drag="x"`, `useMotionValue`, `useTransform`, `AnimatePresence`, `onDragEnd(_, info)` with `info.offset.x` / `info.velocity.x`).
* Brand: read `/Workspace/Users/matthew.giglia@databricks.com/.assistant/skills/databricks-brand-colors/SKILL.md` and `databricks-brand-accessibility/SKILL.md` (contrast >= 4.5:1; Lava 600 `#FF3621`, Navy 800 `#1B3139`). Respect `prefers-reduced-motion` (disable drag animations, keep buttons).
* Current scaffold: `client/src/App.tsx` routes Home/`/agents` (AgentChat)/Analytics/Lakebase/Jobs and defines its own inline `NavLinks` + `Layout` (replace them with the components below); `client/src/main.tsx` wraps `ResourceStatusProvider`.

## Tasks
1. `client/src/main.tsx` — keep `StrictMode`, `ErrorBoundary`, `ResourceStatusProvider`/`ResourceStatusIndicator`; add `QueryClientProvider` with `createQueryClient()` (create once at module scope).
2. `client/src/App.tsx` — `createBrowserRouter` with `AppLayout` and routes:
   * `/` -> `ReviewPage` (this session, `client/src/pages/review/ReviewPage.tsx`)
   * `/leaderboard` -> `LeaderboardPage` from `./pages/leaderboard/LeaderboardPage` (session 13)
   * `/steward` -> `StewardPage` from `./pages/steward/StewardPage` (session 13)
   * `/admin` -> `AdminPage` from `./pages/admin/AdminPage` (session 13)
   * `/executive` -> `ExecutivePage` from `./pages/executive/ExecutivePage` (session 13)
   * `/assistant` -> existing `AgentChat` (named export) from `./pages/agents/AgentChat` (keep that file untouched; session 15 updates its copy)
   * Remove the Analytics, Lakebase, Jobs routes and imports (session 15 deletes those files).
   * `*` -> a simple not-found element.
3. `client/src/components/layout/AppLayout.tsx` — header (app name "Semantic Ground Truth", `NavLinks`, `NotificationBell`, theme toggle via `next-themes`), `<Outlet />`, mobile bottom nav when `useIsMobile()`.
4. `client/src/components/layout/NavLinks.tsx` — links filtered by role (`hasRole(useMe().data, ...)`): Review, Leaderboard (all); Steward, Executive (steward); Admin (admin); Assistant (all).
5. `client/src/components/layout/NotificationBell.tsx` — `useUnreadCount` badge; `Sheet` listing `useNotifications({ limit: 20 })`; "Mark all read" via `useMarkNotificationsRead`.
6. `client/src/components/review/`:
   * `ReviewCard.tsx` — asset header (`AssetTypeBadge`, display name, domain/subdomain, status, version), description, plain-English logic, `ConfidenceMeter`, `SynonymChips`, `ExampleQuestions`, collapsible YAML, `QueryPreview` button.
   * `CardStack.tsx` — framer-motion drag: right > 120px or velocity > 600 = approve, left = reject; tilt via `useTransform`; `AnimatePresence` exit; keyboard shortcuts (`ArrowRight` approve, `ArrowLeft` reject, `e` edit).
   * `SwipeActions.tsx` — accessible buttons (Reject / Edit / Approve) with `aria-label`s; always visible (swipe is an enhancement).
   * `EditSheet.tsx` — `Sheet` with `Textarea`s for description / plain-English logic / display name + feedback; submits `voteType: 'edit'`.
   * `RejectSheet.tsx` — optional reason textarea before submitting a reject.
   * `SynonymChips.tsx` — chips with approve/reject counts, thumbs actions, add input (`useSynonymAction`).
   * `ExampleQuestions.tsx` — list + approve/reject + add (`useExampleAction`).
   * `ConfidenceMeter.tsx` — `Progress` + percentage + certified badge.
   * `QueryPreview.tsx` — `useRunQuery`; renders `QueryResult` in a `Table` (max 20 rows); shows `ApiError.message` on failure.
   * `AssetTypeBadge.tsx`, `AssetTypeFilter.tsx` (Select over `ASSET_TYPES` + "All"), `CampaignSelector.tsx` (`useCampaigns({ status: 'active' })`).
   * `ProgressBar.tsx` (card.progress), `StreakBadge.tsx` (`useUserStats().data.currentStreakDays` with flame icon).
   * `EmptyState.tsx` — "All caught up" when `useNextCard` returns `null`.
7. `client/src/pages/review/ReviewPage.tsx` — filters (campaign, asset type) in URL search params; `useNextCard(params)`; on vote -> `useSubmitVote`, optimistic advance to `result.next`; toast on milestone badge (compare stats before/after).

## Acceptance Criteria
- [ ] App routes exactly as in Task 2; no imports of Analytics/Lakebase/Jobs pages remain in `App.tsx`.
- [ ] Every vote path (swipe, button, keyboard) calls the same `submit()` function.
- [ ] All interactive elements are keyboard reachable with visible focus and `aria-label`s.
- [ ] Only `import type` for types; no direct `fetch` in components.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/components/layout/**`
- `client/src/components/review/**`
- `client/src/pages/review/**`

## Dependencies
- Waves 0-3 (01, 02, 10). Parallel with 11, 13, 14. Session 13 must export `LeaderboardPage`, `StewardPage`, `AdminPage`, `ExecutivePage` (named exports) from the paths in Task 2.
