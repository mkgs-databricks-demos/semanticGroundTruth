# Session 07: Campaign Manager (Phase F)

## Scope
Implement `CampaignManager`: create/list/get/update-status campaigns, materialise campaign asset pools, RBAC visibility, automatic campaigns on new asset versions, freshness campaigns, and completion checks driven by domain events. No routes (session 09) and no notifications delivery (session 08 subscribes to `campaign.*` events).

## Context
* `../docs/design/L200-C5_campaign_manager.md` (types, lifecycle, resolved questions: assets may be in many campaigns; default completion = all reviewed once; freshness default 180 days).
* Contracts: `build_conventions.md` §5 decision 2, §7 (`ServiceDeps`, `EventBus`, `DomainEvent`, `currentUserFromToken`). DTOs: `Campaign`, `CampaignAsset`, `CreateCampaignBody`, `UpdateCampaignStatusBody` (session 01).
* Tables `app.campaigns`, `app.campaign_assignments`, `app.campaign_assets`, `app.assets` (session 03).

## Tasks
1. `server/services/campaign/lifecycle.ts` (pure): `ALLOWED_TRANSITIONS` (`active -> paused|completed|archived`, `paused -> active|archived`, `completed -> archived`, `archived -> none`) and `assertTransition(from, to)` (throws `conflict`).
2. `server/services/campaign/scope.ts` (pure): `buildScopeFilter(c: { scopeDomain?; scopeSubdomain?; scopeAssetType?; scopeAssetIds? }, startIndex: number): { where: string; params: unknown[] }` producing `$n`-parameterised SQL against `app.assets` (always `is_active = TRUE` if that column exists in L200-C1; otherwise omit) — exported for tests.
3. `server/services/campaign/campaignManager.ts` — `class CampaignManager { constructor(deps: ServiceDeps) }`:
   * `create(body: CreateCampaignBody, createdBy: string): Promise<Campaign>` — insert campaign, assignments (one row per `rbacGroups` entry, else one default row with `rbac_group NULL, is_default TRUE`), then `INSERT INTO app.campaign_assets SELECT ... FROM app.assets WHERE <scope> ON CONFLICT DO NOTHING`; emit `campaign.created`.
   * `list(user: UserContext, opts?: { status?: CampaignStatus }): Promise<Campaign[]>` — includes progress (`totalAssets`, `reviewedAssets`) and filters by visibility (`isVisibleTo`).
   * `get(user, campaignId)`, `updateStatus(campaignId, status, userId)` (uses `assertTransition`; sets `completed_at` when completing).
   * `isVisibleTo(user, campaign): Promise<boolean>` — admins/stewards see all; default assignment -> all; else intersect `currentUserFromToken(user.accessToken).groups` with assignment groups. **If group lookup fails or no token, fail open and log `warn`** (V1 decision; record as assumption).
   * `createAutomaticForAsset(assetId): Promise<Campaign>` — name `Re-review: <display_name or name>`, `campaign_type = 'automatic'`, scope = that asset, `created_by = 'system'`.
   * `runFreshnessCheck(now = new Date()): Promise<{ campaignId: string | null; added: number }>` — find or create the single active `freshness` campaign; add assets with `last_reviewed_at` older than `settings.freshnessIntervalDays` (or never reviewed and older than that since `created_at`).
   * `checkCompletion(campaignId): Promise<boolean>` — `reviewed_once`: all `campaign_assets` are `reviewed`; `certified`: all assets `status = 'CERTIFIED'`. On completion set status `completed` and emit `campaign.completed`.
   * `subscribe(): void` — `events.on('asset.registered', e => e.isNewVersion && createAutomaticForAsset(e.assetId))`; `events.on('vote.recorded', e => e.campaignIds.forEach(checkCompletion))`.
4. `server/services/campaign/index.ts` — barrel.
5. Vitest tests (written, not run): `lifecycle.test.ts`, `scope.test.ts` (parameter numbering, empty scope = all assets).

## Acceptance Criteria
- [ ] Exports: `CampaignManager`, `ALLOWED_TRANSITIONS`, `assertTransition`, `buildScopeFilter`.
- [ ] `campaign_type` values only `automatic|manual|freshness`; column names match plan 03.
- [ ] No user input string-interpolated into SQL.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/services/campaign/**`

## Dependencies
- Sessions 01, 02 (wave 0); 03 (wave 1). Parallel with 06 and 08 — do not import from `server/services/review` or `server/services/notification`.
