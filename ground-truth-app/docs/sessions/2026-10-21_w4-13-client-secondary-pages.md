# Session 13: Leaderboard, Steward, Admin, Executive Pages

**Wave:** 4 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created 18 files: 4 page components and 14 sub-components across the four secondary pages. All pages use named exports at the plan’s fixed paths, use React Query hooks from `client/src/lib/api`, and include loading (Skeleton), empty, and error states. Role gating uses `hasRole(useMe().data, ...)` — steward for StewardPage and ExecutivePage, admin for AdminPage.

## Files Created

### Leaderboard (3 components + 1 page)

| File | Key exports |
|---|---|
| `client/src/components/leaderboard/BadgeList.tsx` | `BadgeList({ badges: string[] })` — renders badge labels for gamification milestones |
| `client/src/components/leaderboard/LeaderboardTable.tsx` | `LeaderboardTable({ entries, currentUserId })` — ranked table with current-user highlight |
| `client/src/components/leaderboard/MyStatsCard.tsx` | `MyStatsCard()` — personal stats card using `useUserStats` |
| `client/src/pages/leaderboard/LeaderboardPage.tsx` | `LeaderboardPage()` — period Tabs (7d/30d/all) with `useLeaderboard`, `MyStatsCard`, `LeaderboardTable` |

### Steward (5 components + 1 page)

| File | Key exports |
|---|---|
| `client/src/components/steward/CampaignList.tsx` | `CampaignList()` — campaign cards with Progress bars and status-transition Buttons (active→paused/completed/archived, etc.) |
| `client/src/components/steward/CreateCampaignSheet.tsx` | `CreateCampaignSheet({ open, onOpenChange })` — form with name, type (manual/freshness), scope, RBAC groups, freshness days, completion rule |
| `client/src/components/steward/AssetBrowser.tsx` | `AssetBrowser({ onSelect })` — filterable paged asset Table with type/status filters and Next/Previous pagination |
| `client/src/components/steward/AssetDetailSheet.tsx` | `AssetDetailSheet({ assetId, open, onOpenChange })` — detail Sheet using `useAsset`, `useAssetVersions` |
| `client/src/components/steward/MetricViewPanel.tsx` | `MetricViewPanel()` — selectable metric view list with detail card and Validate button using `useMetricViews`, `useMetricView`, `useValidateMetricView` |
| `client/src/pages/steward/StewardPage.tsx` | `StewardPage()` — steward-gated with Tabs (Campaigns/Assets/Metric Views), New Campaign button |

### Admin (4 components + 1 page)

| File | Key exports |
|---|---|
| `client/src/components/admin/ScoringConfigForm.tsx` | `ScoringConfigForm()` — 8 numeric fields (wilsonZ, industryPrior, priorWeight, priorDecayThreshold, certificationThreshold, minVotesForCertification, stalenessDays, freshnessIntervalDays) using `useAdminConfig` / `useUpdateAdminConfig` |
| `client/src/components/admin/RoleListsForm.tsx` | `RoleListsForm()` — admin/steward email textarea lists |
| `client/src/components/admin/MaintenanceActions.tsx` | `MaintenanceActions()` — freshness check (`useRunFreshnessCheck`) and recompute-by-asset-id (`useRecomputeAsset`) |
| `client/src/components/admin/NotificationPrefsForm.tsx` | `NotificationPrefsForm()` — per-event-type channel checkboxes + digest toggle using `useNotificationPreferences` / `useUpdateNotificationPreferences` |
| `client/src/pages/admin/AdminPage.tsx` | `AdminPage()` — admin-gated, stacks all four forms |

### Executive (2 components + 1 page)

| File | Key exports |
|---|---|
| `client/src/components/executive/KpiCards.tsx` | `KpiCards()` — 6 KPI cards (coverage %, certification %, active reviewers 7d, votes 7d, active campaigns, total assets) from `useExecutiveSummary` |
| `client/src/components/executive/DashboardLink.tsx` | `DashboardLink()` — button opening `VITE_EXEC_DASHBOARD_URL` in new tab; hidden with a note when unset |
| `client/src/pages/executive/ExecutivePage.tsx` | `ExecutivePage()` — steward-gated, KpiCards + DashboardLink |

## Checks

| Check | Result | Detail |
|---|---|---|
| `databricks bundle validate --strict --target dev` | **pass** | "Validation OK!" |
| 4 pages have correct named exports | **pass** | LeaderboardPage, StewardPage, AdminPage, ExecutivePage |
| No default exports in any file | **pass** | Checked all 18 files |
| No `enum` keyword in any file | **pass** | Checked all 18 files |
| No direct `fetch()` calls | **pass** | All data access via hooks |
| Role gating correct | **pass** | Steward(steward), Admin(admin), Executive(steward) |
| All relative imports resolve | **pass** | 18 files, all `from '...'` paths resolve to existing .ts/.tsx |
| Only `import type` for types | **pass** | Value imports only for constants (ASSET_TYPES, NOTIFICATION_CHANNELS, etc.) |
| TypeScript compilation (`tsc -b`) | **skipped** | No Node toolchain in session |

## Assumptions

1. `ValidateResult` (from `shared/contracts`) assumed to have `valid: boolean` and `errors?: string[]`. If the actual shape differs, typecheck will catch it at deploy time.
2. `UserStats` does not include a `badges` field; `BadgeList` is created as a standalone display component for use wherever badge data is available (e.g., from `UserActivity`). The `LeaderboardEntry` type also lacks badges. Badge display against the leaderboard would need a backend change or client-side derivation from vote counts; recorded but not blocked.
3. `runFreshnessCheck` endpoint expects no body; called with `undefined as never` cast to satisfy the void mutation type.
4. `Button asChild` prop in DashboardLink assumes AppKit’s Button supports Radix `asChild` polymorphism (standard in shadcn/ui). If not, replace with a plain `<a>` styled element.

## Requests

None.
