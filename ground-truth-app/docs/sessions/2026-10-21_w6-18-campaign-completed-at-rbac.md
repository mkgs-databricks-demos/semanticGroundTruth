# Session 18 — Campaign completed_at + RBAC consistency (Wave 6)

**Date:** 2026-10-21  
**Run ID:** 294202284707072  
**Mode:** edit  
**Status:** pass  

## Problems Found

1. `Campaign` interface in `shared/contracts/entities.ts` was missing `completedAt` field despite migration 003 already defining `completed_at TIMESTAMPTZ` on `app.campaigns`.
2. `toCampaign` mapper in `campaignManager.ts` did not map the `completed_at` column.
3. `updateStatus()` had a stale comment claiming the column didn't exist and used `updated_at` as a proxy — never setting `completed_at`.
4. On status transition to `'active'` (reopen), `completed_at` was not reset to `NULL`.

## Root Causes

Session 07 (wave 2) wrote `campaignManager.ts` before migration 003 was finalised. The stale comment was left over from that ordering.

## Changes Made

### `shared/contracts/entities.ts`
- Added `completedAt: string | null` to `Campaign` interface after `updatedAt` (line 128).

### `server/services/campaign/campaignManager.ts`
- `toCampaign` mapper: added `completedAt: row.completed_at ? String(row.completed_at) : null`.
- `updateStatus()`: removed 3-line stale proxy comment. Added `completedAtClause` that sets `completed_at = NOW()` on transition to `'completed'`, `completed_at = NULL` on transition to `'active'`, and empty string otherwise. Interpolated into the existing UPDATE query.

### `server/routes/campaigns.ts`
- **No changes needed.** RBAC audit confirmed: `list()` (line 22) and `get()` (line 44) both pass `UserContext` from `getUser(res)`. `updateStatus` and `create` are steward-gated. `runFreshnessCheck` is admin-gated. `isVisibleTo` and `rbacGroups` references are confined to `campaignManager.ts`.

## Decisions

- Used template-literal interpolation for the `completed_at` clause rather than branching into separate SQL strings, keeping the single UPDATE statement pattern consistent with the rest of the file.
- Did not change `updateStatus` signature (still takes `_userId: string`, not `UserContext`) because the route already gates on `steward` role and stewards see all campaigns in `isVisibleTo`.

## Files Modified

| File | Action |
| --- | --- |
| `shared/contracts/entities.ts` | edited |
| `server/services/campaign/campaignManager.ts` | edited |

## Checks

| Check | Result |
| --- | --- |
| Campaign interface has `completedAt: string \| null` | pass |
| `toCampaign` maps `completed_at` → `completedAt` | pass |
| `updateStatus('completed')` sets `completed_at = NOW()` | pass |
| `updateStatus('active')` sets `completed_at = NULL` | pass |
| No stale proxy comment | pass |
| Routes pass `UserContext` to RBAC-aware methods | pass |
| `bundle validate --strict --target dev` | pass |

## Re-validation (run 963652240700815)

All 7 acceptance criteria re-verified against the current code on branch `mg-genie-app-first-deploy`. No changes needed — prior run 294202284707072 already applied all fixes. `bundle validate --strict --target dev` = Validation OK. RBAC grep confirmed `isVisibleTo` and `rbacGroups` references are consistent across codebase.
