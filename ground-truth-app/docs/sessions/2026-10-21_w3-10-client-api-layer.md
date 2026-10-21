# Session 10: Client API Layer (React Query)

**Wave:** 3 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `client/src/lib/api/` with 7 files: typed fetch client, query key factory, 29 endpoint functions, 16 query hooks + 13 mutation hooks (React Query v5), QueryClient factory, role helper, and barrel. Every non-health row of plan 09's route table has one endpoint function and one hook.

## Files Created

| File | Purpose | Key exports |
|---|---|---|
| `client/src/lib/api/http.ts` | Typed fetch client with error parsing | `ApiError`, `apiGet<T>(path, query?)`, `apiSend<T>(method, path, body?)` |
| `client/src/lib/api/keys.ts` | Query key factory | `queryKeys` (16 entries: me, nextCard, userStats, leaderboard, assets, asset, assetVersions, campaigns, campaign, notifications, unreadCount, preferences, adminConfig, executiveSummary, metricViews, metricView) |
| `client/src/lib/api/endpoints.ts` | One async function per route | 29 functions (see route coverage below) |
| `client/src/lib/api/hooks.ts` | React Query v5 hooks | 16 query hooks + 13 mutation hooks (see hook list below) |
| `client/src/lib/api/queryClient.ts` | QueryClient factory | `createQueryClient()` — no retry on 4xx, up to 2 retries otherwise, staleTime 30s |
| `client/src/lib/api/roles.ts` | Client-side role check | `hasRole(me, role)` with admin > steward > reviewer hierarchy |
| `client/src/lib/api/index.ts` | Barrel re-export | Re-exports all modules |

## Route Coverage (29 non-health routes)

| Method + Path | Endpoint fn | Hook |
|---|---|---|
| GET /api/me | `getMe` | `useMe` |
| GET /api/review/next | `getNextCard` | `useNextCard` |
| POST /api/review/vote | `submitVote` | `useSubmitVote` |
| POST /api/review/synonym | `synonymAction` | `useSynonymAction` |
| POST /api/review/example | `exampleAction` | `useExampleAction` |
| POST /api/review/run-query | `runQuery` | `useRunQuery` |
| GET /api/review/stats/me | `getUserStats` | `useUserStats` |
| GET /api/leaderboard | `getLeaderboard` | `useLeaderboard` |
| GET /api/assets | `getAssets` | `useAssets` |
| GET /api/assets/:assetId | `getAsset` | `useAsset` |
| GET /api/assets/:assetId/versions | `getAssetVersions` | `useAssetVersions` |
| POST /api/assets/register | `registerAsset` | `useRegisterAsset` |
| GET /api/campaigns | `getCampaigns` | `useCampaigns` |
| POST /api/campaigns | `createCampaign` | `useCreateCampaign` |
| GET /api/campaigns/:campaignId | `getCampaign` | `useCampaign` |
| PATCH /api/campaigns/:campaignId/status | `updateCampaignStatus` | `useUpdateCampaignStatus` |
| POST /api/campaigns/freshness-check | `runFreshnessCheck` | `useRunFreshnessCheck` |
| GET /api/notifications | `getNotifications` | `useNotifications` |
| GET /api/notifications/unread-count | `getUnreadCount` | `useUnreadCount` |
| POST /api/notifications/read | `markNotificationsRead` | `useMarkNotificationsRead` |
| GET /api/notifications/preferences | `getNotificationPreferences` | `useNotificationPreferences` |
| PUT /api/notifications/preferences | `updateNotificationPreferences` | `useUpdateNotificationPreferences` |
| GET /api/admin/config | `getAdminConfig` | `useAdminConfig` |
| PUT /api/admin/config | `updateAdminConfig` | `useUpdateAdminConfig` |
| GET /api/admin/summary | `getExecutiveSummary` | `useExecutiveSummary` |
| POST /api/admin/recompute/:assetId | `recomputeAsset` | `useRecomputeAsset` |
| GET /api/metric-views | `getMetricViews` | `useMetricViews` |
| GET /api/metric-views/:fullName | `getMetricView` | `useMetricView` |
| POST /api/metric-views/:fullName/validate | `validateMetricView` | `useValidateMetricView` |

## Hook Behavior Notes

- `useNextCard`: `staleTime: 0`, `refetchOnWindowFocus: false`
- `useUnreadCount`: `refetchInterval: 30_000`
- `useSubmitVote` onSuccess: `setQueryData(nextCard, result.next ?? null)` when `next` is present; invalidates `userStats`, `leaderboard`, `campaigns`
- `useUpdateCampaignStatus` accepts `{ campaignId, body }` as variables (wraps 2-arg endpoint)
- All mutation hooks with side effects use `void queryClient.invalidateQueries(...)` to fire-and-forget

## Checks

| Check | Result | Detail |
|---|---|---|
| `databricks bundle validate --strict --target dev` | **pass** | "Validation OK!" |
| One endpoint + one hook per non-health route | **pass** | 29 endpoints, 29 hooks |
| Paths and methods match route table | **pass** | Static comparison, character-for-character |
| Only `import type` for DTOs | **pass** | All DTO imports use `import type` |
| No `enum`, no `namespace`, no parameter properties | **pass** | `ApiError` uses normal class fields |
| All relative imports resolve | **pass** | Static check: all ./module and ../../../../shared/contracts paths point to existing files |
| TypeScript compilation (`tsc -b`) | **skipped** | No Node toolchain in session |

## Decisions / Assumptions

1. `queryKeys` uses `as const` on both the outer object and each tuple/function return for narrow literal types.
2. `handleResponse` parses the error body inline rather than importing `ErrorResponse` at runtime (uses a structural type to avoid needing `ErrorResponse` as a value).
3. `useSubmitVote.setQueryData` targets `queryKeys.nextCard()` (no params). If the active `useNextCard` was called with specific params (e.g. a campaign filter), the optimistic update may not match the exact query key; the UI will still get correct data via the next refetch or navigation.
4. `useUpdateCampaignStatus` wraps the 2-argument endpoint (`campaignId`, `body`) into a single-argument mutation via `{ campaignId, body }` variables.
5. Query hooks that accept params cast them to `Record<string, unknown>` when passing to `queryKeys` factories — safe because the factory only uses them as reference-equality parts of the key tuple.

## Requests

None.
