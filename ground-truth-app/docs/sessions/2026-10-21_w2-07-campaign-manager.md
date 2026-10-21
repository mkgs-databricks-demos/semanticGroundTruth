# Session 07: Campaign Manager

**Wave:** 2 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `server/services/campaign/` with 6 files: lifecycle state machine, scope filter builder, CampaignManager service class, barrel index, and two vitest test files. Implements the full plan scope: create, list, get, updateStatus, scope materialisation, RBAC visibility with fail-open, automatic campaigns on new asset versions, freshness campaigns, completion checks, and domain event subscriptions.

## Files Created

| File | Exports | Description |
|---|---|---|
| `server/services/campaign/lifecycle.ts` | `ALLOWED_TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>>`, `assertTransition(from, to): void` | Pure campaign state machine. Throws `conflict` on invalid transitions. |
| `server/services/campaign/scope.ts` | `ScopeInput` (interface), `buildScopeFilter(c, startIndex): { where, params }` | Pure `$n`-parameterised WHERE clause builder against `app.assets`. Empty scope = `TRUE`. No `is_active` (column absent per L200-C1 migration). |
| `server/services/campaign/campaignManager.ts` | `class CampaignManager` | Main service class. Constructor `(deps: ServiceDeps)`. Methods: `create`, `list`, `get`, `updateStatus`, `isVisibleTo`, `createAutomaticForAsset`, `runFreshnessCheck`, `checkCompletion`, `subscribe`. |
| `server/services/campaign/index.ts` | Re-exports `ALLOWED_TRANSITIONS`, `assertTransition`, `buildScopeFilter`, `ScopeInput`, `CampaignManager` | Barrel. |
| `server/services/campaign/lifecycle.test.ts` | — | 10 vitest tests: valid transitions, invalid transitions, self-transitions. Written, not run. |
| `server/services/campaign/scope.test.ts` | — | 8 vitest tests: empty scope, null scope, single-field, multi-field numbering, startIndex offset, ANY(), empty array, all four fields. Written, not run. |

## Method Signatures

```ts
class CampaignManager {
  constructor(deps: ServiceDeps);
  create(body: CreateCampaignBody, createdBy: string): Promise<Campaign>;
  list(user: UserContext, opts?: { status?: CampaignStatus }): Promise<Campaign[]>;
  get(user: UserContext, campaignId: string): Promise<Campaign>;
  updateStatus(campaignId: string, status: CampaignStatus, userId: string): Promise<Campaign>;
  isVisibleTo(user: UserContext, campaign: Campaign): Promise<boolean>;
  createAutomaticForAsset(assetId: string): Promise<Campaign>;
  runFreshnessCheck(now?: Date): Promise<FreshnessCheckResult>;
  checkCompletion(campaignId: string): Promise<boolean>;
  subscribe(): void;
}
```

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| Exports: CampaignManager, ALLOWED_TRANSITIONS, assertTransition, buildScopeFilter | pass |
| campaign_type values only automatic\|manual\|freshness | pass |
| No SQL string interpolation (all $n params) | pass |
| Column names match migration 003 | pass |
| All relative imports resolve to existing files | pass |
| No imports from server/services/review or notification | pass |
| TypeScript compilation | skipped (no Node toolchain) |
| Vitest tests | skipped (no Node toolchain) |

## Decisions

* **RBAC via campaigns.rbac_groups:** Migration 003 stores RBAC groups as `TEXT[]` directly on `app.campaigns` rather than in `campaign_assignments` (which has `(campaign_id, user_id)` PK for individual user assignments). Plan’s description of inserting one assignment row per group doesn’t match the migration schema. Implemented visibility check against `campaigns.rbac_groups` column.
* **fetchUserGroups helper:** Plan references `currentUserFromToken(user.accessToken).groups` but no such function exists in cross-module contracts (§7). Implemented as a private `fetchUserGroups()` calling SCIM `/Me` API. Fail-open on error per V1 decision.
* **No completed_at:** Plan says `updateStatus` sets `completed_at` on completion, but migration 003 lacks this column. Using `updated_at` as proxy. Recorded as a request.
* **Completion event:** `checkCompletion` both calls `updateStatus('completed')` and emits `campaign.completed`. The event is only emitted on automatic completion (not manual status changes via `updateStatus` directly).

## Assumptions

* Session 02’s `EventBus.on()` is generic-typed (confirmed by reading `server/lib/events.ts`): handler receives the narrowed event type, so event handlers don’t need explicit type assertions.
* `Db.query()` returns the full result set (not just `{ rows }`) matching the contract `Promise<T[]>`.
* `fetchUserGroups` uses the SCIM v2 `/Me` endpoint which returns `groups[].display`. If the endpoint changes, the function degrades to fail-open (no breakage).

## Requests

| Path | Change | Why |
|---|---|---|
| `server/migrations/003_campaigns.ts` | Add `completed_at TIMESTAMPTZ` column to `app.campaigns` | Plan 07 task 3 specifies setting `completed_at` on completion. Column is absent from migration. |
