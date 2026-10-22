# Session 18: Campaign completed_at + RBAC consistency (Wave 6)

## Scope
Wire the `completed_at` column (already in migration 003) through the Campaign entity, mapper, and manager so completing a campaign sets the timestamp. Audit RBAC visibility across campaign services and routes for consistency.

## Context
* Migration 003 (`server/migrations/003_campaigns.ts`) already defines `completed_at TIMESTAMPTZ` on `app.campaigns` (line 24, added in commit `6bac839`).
* `shared/contracts/entities.ts` `Campaign` interface (lines 111–128) does NOT include `completedAt`.
* `server/services/campaign/campaignManager.ts` `updateStatus()` has a stale comment (lines ~229–234): *"Using updated_at as proxy until a migration adds the column."* It does `SET status = $1, updated_at = NOW()` but never sets `completed_at`.
* The `toCampaign` mapper (inside `campaignManager.ts`) does not map `completed_at`.
* RBAC design: `campaigns.rbac_groups TEXT[]` column with SCIM `/Me` group lookup, fail-open at `warn` level. This is the intended V1 design — not `campaign_assignments` rows. Verify routes pass `UserContext` through to `CampaignManager.list()` / `CampaignManager.get()` so `isVisibleTo` is exercised.

## Known issues
* `Campaign` entity type missing `completedAt: string | null`.
* `toCampaign` mapper missing `completed_at` → `completedAt` mapping.
* `updateStatus('completed', ...)` does not SET `completed_at = NOW()`.
* `updateStatus('active', ...)` (reopen) should SET `completed_at = NULL`.
* Routes at `server/routes/campaigns.ts` must pass `getUser(res)` to campaign methods that do RBAC checks.

## Tasks
1. Read `shared/contracts/entities.ts` — add `completedAt: string | null` to the `Campaign` interface after `updatedAt`.
2. Read `server/services/campaign/campaignManager.ts`:
   a. Update `toCampaign` mapper to include `completedAt: row.completed_at ? String(row.completed_at) : null`.
   b. Update `updateStatus()`: when status transitions to `'completed'`, SET `completed_at = NOW()`. When transitioning to `'active'` (reopen), SET `completed_at = NULL`. Remove the stale proxy comment.
3. Read `server/routes/campaigns.ts` — verify every call to `CampaignManager.list()` and `CampaignManager.get()` passes the user context from `getUser(res)` so RBAC visibility is applied. Fix if not.
4. Grep for any other reference to `campaigns.rbac_groups` or `isVisibleTo` outside `server/services/campaign/` — confirm consistency.
5. Run `bundle validate --strict --target dev`.

## Acceptance Criteria
- [ ] `Campaign` interface in `shared/contracts/entities.ts` includes `completedAt: string | null`.
- [ ] `toCampaign` maps `completed_at` to `completedAt`.
- [ ] `updateStatus('completed', ...)` sets `completed_at = NOW()`.
- [ ] `updateStatus('active', ...)` sets `completed_at = NULL`.
- [ ] No stale "proxy" comment remains.
- [ ] Campaign routes pass `UserContext` to RBAC-aware methods.
- [ ] `bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `shared/contracts/entities.ts`
- `server/services/campaign/**`
- `server/routes/campaigns.ts`

## Dependencies
- Session 01 (shared/contracts/entities.ts — already on main).
- Session 03 (migration 003 with completed_at — already on main).
- Session 07 (campaignManager.ts — already on main).
- Session 09 (routes/campaigns.ts — already on main).
