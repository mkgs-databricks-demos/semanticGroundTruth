# Session 13: Leaderboard, Steward, Admin, Executive Pages (Phase I, part 2)

## Scope
Build the four secondary pages and their components. Session 12 (parallel) owns `App.tsx` and imports these pages by fixed path and **named export**. Pages must render inside session 12's `AppLayout` (no own header/nav).

## Context
* `../docs/design/L200-C3_card_ui.md`, `L200-C5_campaign_manager.md` (steward campaign UI), `L200-C8_executive_dashboard.md` (exec KPIs; the full dashboard is an AI/BI dashboard — the React page shows summary cards and a link), `L300-13_frontend_implementation.md`.
* Hooks from `client/src/lib/api` (session 10); `hasRole` for gating. Client TS rules: `build_conventions.md` §2.
* Brand + accessibility skills at `/Workspace/Users/matthew.giglia@databricks.com/.assistant/skills/databricks-brand-{colors,components,accessibility}/SKILL.md`.

## Tasks
1. `client/src/pages/leaderboard/LeaderboardPage.tsx` — `export function LeaderboardPage()`: period `Tabs` (7d / 30d / all) -> `useLeaderboard`; `client/src/components/leaderboard/LeaderboardTable.tsx` (rank, name, votes, streak, badges; highlight current user); `client/src/components/leaderboard/MyStatsCard.tsx` (`useUserStats`); `client/src/components/leaderboard/BadgeList.tsx` (labels for `first_vote`, `ten_votes`, `fifty_votes`, `hundred_votes`, `streak_7`, `streak_30`).
2. `client/src/pages/steward/StewardPage.tsx` — `export function StewardPage()` (steward-gated; non-stewards see a friendly 403 card):
   * `client/src/components/steward/CampaignList.tsx` (`useCampaigns`, progress bars, status actions via `useUpdateCampaignStatus` respecting allowed transitions: active->paused/completed/archived, paused->active/archived, completed->archived).
   * `client/src/components/steward/CreateCampaignSheet.tsx` (name, type manual/freshness, scope domain/subdomain/asset type, rbac groups CSV, freshness days, completion rule) -> `useCreateCampaign`.
   * `client/src/components/steward/AssetBrowser.tsx` (`useAssets` with type/status filters + paging; row opens `AssetDetailSheet.tsx` with `useAsset`, `useAssetVersions`).
   * `client/src/components/steward/MetricViewPanel.tsx` (`useMetricViews`, `useMetricView`, `useValidateMetricView`).
3. `client/src/pages/admin/AdminPage.tsx` — `export function AdminPage()` (admin-gated):
   * `client/src/components/admin/ScoringConfigForm.tsx` (`useAdminConfig` / `useUpdateAdminConfig`: wilsonZ, industryPrior, priorWeight, priorDecayThreshold, certificationThreshold, minVotesForCertification, stalenessDays, freshnessIntervalDays; numeric validation).
   * `client/src/components/admin/RoleListsForm.tsx` (adminEmails, stewardEmails as textarea lists).
   * `client/src/components/admin/MaintenanceActions.tsx` (run freshness check, recompute by asset id).
   * `client/src/components/admin/NotificationPrefsForm.tsx` (`useNotificationPreferences` / update) — also linked from the bell for all users if convenient, but lives here.
4. `client/src/pages/executive/ExecutivePage.tsx` — `export function ExecutivePage()` (steward-gated): `client/src/components/executive/KpiCards.tsx` (`useExecutiveSummary`: coverage %, certification %, active reviewers 7d, votes 7d, active campaigns, totals) and `client/src/components/executive/DashboardLink.tsx` (button opening `import.meta.env.VITE_EXEC_DASHBOARD_URL` in a new tab; hidden when unset, with a note).
5. Loading (`Skeleton`), empty and error states (`ApiError.message`) on every data component.

## Acceptance Criteria
- [ ] The four pages exist at exactly these paths with these named exports: `LeaderboardPage`, `StewardPage`, `AdminPage`, `ExecutivePage`.
- [ ] Role gating uses `hasRole(useMe().data, ...)`; the server still enforces roles (UI gating is cosmetic).
- [ ] Only `import type` for types; no direct `fetch`; no `enum`.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `client/src/components/leaderboard/**`
- `client/src/components/steward/**`
- `client/src/components/admin/**`
- `client/src/components/executive/**`
- `client/src/pages/leaderboard/**`
- `client/src/pages/steward/**`
- `client/src/pages/admin/**`
- `client/src/pages/executive/**`

## Dependencies
- Waves 0-3 (01, 10). Parallel with 11, 12, 14.
