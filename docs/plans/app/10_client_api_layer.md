# Session 10: Client API Layer (React Query)

## Scope
Create `client/src/lib/api/` — a typed fetch client and React Query hooks for every route in plan 09's route table, plus the shared `QueryClient` factory and query keys. No components or pages (sessions 12-13 consume these hooks). Runs in parallel with session 09, coding against the route table, not against server code.

## Context
* `docs/plans/09_rest_routes_wiring.md` § Route table (paths, methods, DTOs) — the contract.
* DTO types from `shared/contracts` (session 01). Client rules in `build_conventions.md` §2: `import type`, no enums, relative import to `../../../../shared/contracts` from `client/src/lib/api/*.ts` (verify depth: `client/src/lib/api/` -> 4 levels up to build root).
* `@tanstack/react-query` v5 is added to `package.json` by session 02. v5 API: `useQuery({ queryKey, queryFn })`, `useMutation({ mutationFn, onSuccess })`, `queryClient.invalidateQueries({ queryKey })`, `isPending` (not `isLoading` for mutations).
* Requests are same-origin; the Apps proxy adds identity. Use `credentials: 'same-origin'`.

## Tasks
1. `client/src/lib/api/http.ts` — `class ApiError extends Error` with `code`, `status`, `details` fields declared as normal class fields (no parameter properties — `erasableSyntaxOnly`); `apiGet<T>(path, query?)`, `apiSend<T>(method: 'POST'|'PUT'|'PATCH', path, body?)`. Parse `ErrorResponse` on non-2xx. Serialize query objects, skipping `undefined`. `encodeURIComponent` path params.
2. `client/src/lib/api/keys.ts` — `queryKeys` object (`me`, `nextCard(params)`, `userStats`, `leaderboard(params)`, `assets(params)`, `asset(id)`, `assetVersions(id)`, `campaigns(params)`, `campaign(id)`, `notifications(params)`, `unreadCount`, `preferences`, `adminConfig`, `executiveSummary`, `metricViews(params)`, `metricView(name)`), all `as const` tuples.
3. `client/src/lib/api/endpoints.ts` — one plain async function per route-table row (e.g. `getNextCard(q: GetNextQuery): Promise<ReviewCard | null>`, `submitVote(body: VoteBody): Promise<VoteResult>`), excluding `/health`.
4. `client/src/lib/api/hooks.ts` — hooks:
   * Queries: `useMe`, `useNextCard(params)` (`staleTime: 0`, `refetchOnWindowFocus: false`), `useUserStats`, `useLeaderboard(params)`, `useAssets(params)`, `useAsset(id)`, `useAssetVersions(id)`, `useCampaigns(params)`, `useCampaign(id)`, `useNotifications(params)`, `useUnreadCount` (`refetchInterval: 30_000`), `useNotificationPreferences`, `useAdminConfig`, `useExecutiveSummary`, `useMetricViews(params)`, `useMetricView(name)`.
   * Mutations: `useSubmitVote` (on success: `setQueryData(nextCard, result.next ?? null)` when `next` is present, invalidate `userStats`, `leaderboard`, `campaigns`), `useSynonymAction`, `useExampleAction`, `useRunQuery`, `useRegisterAsset`, `useCreateCampaign`, `useUpdateCampaignStatus`, `useRunFreshnessCheck`, `useMarkNotificationsRead`, `useUpdateNotificationPreferences`, `useUpdateAdminConfig`, `useRecomputeAsset`, `useValidateMetricView`.
5. `client/src/lib/api/queryClient.ts` — `createQueryClient(): QueryClient` (`retry`: no retry for 4xx `ApiError`, up to 2 otherwise; `staleTime: 30_000`).
6. `client/src/lib/api/roles.ts` — `hasRole(me: MeResponse | undefined, role: Role): boolean` with admin > steward > reviewer.
7. `client/src/lib/api/index.ts` — barrel.

## Acceptance Criteria
- [ ] One endpoint function and one hook for every non-health row in plan 09's route table (list them in your summary as a table).
- [ ] Paths and methods match the route table character-for-character.
- [ ] Only `import type` for DTOs; no `enum`; no parameter properties.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `client/src/lib/api/**`

## Dependencies
- Session 01 (DTOs), session 02 (`package.json` deps). Parallel with session 09.
