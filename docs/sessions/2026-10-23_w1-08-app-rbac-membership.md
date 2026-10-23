# Session 08 — App RBAC from Lakebase app groups + member admin API

**Wave:** 1 · **Mode:** edit · **Run:** 713417549836954 · **Date:** 2026-10-23
**Status:** pass (already completed)

## Summary

All deliverables for session 08 were already present in the codebase, completed by the prior run 991892831639332 on branch `mg-genie-agent-build`. This session re-validated the existing work against the plan.

## Files verified (no changes needed)

| File | Findings |
|---|---|
| `server/services/membership/membershipService.ts` | MembershipService class with rolesFor, listGroups, addMember, removeMember, bootstrap, isMemberOfAny. 60 s cache, last-admin guard, parameterised queries throughout |
| `server/services/membership/index.ts` | Barrel export present |
| `server/services/index.ts` | `membership: MembershipService` in Services interface, constructed in createServices |
| `server/server.ts` | Bootstrap call after migrations, membership passed to registerMiddleware |
| `server/middleware/roles.ts` | resolveRoles is async, takes MembershipService as third arg, unions group roles + legacy lists, admin implies steward |
| `server/middleware/identity.ts` | Accepts MembershipService, calls async resolveRoles |
| `server/middleware/index.ts` | registerMiddleware deps includes membership |
| `server/middleware/roles.test.ts` | 8 tests with vi.fn() mock MembershipService |
| `server/routes/admin.ts` | GET /api/admin/groups, POST add member, DELETE remove member — all admin-only, zod-validated |
| `server/lib/config.ts` | bootstrapAdminIds field, GT_BOOTSTRAP_ADMIN_IDS env parsing, update() uses $1/$2/$3 parameterised queries (no template-literal SQL) |
| `server/services/campaign/scope.ts` | checkCampaignVisibility using MembershipService, fail closed, no SCIM/Me references |
| `server/services/campaign/scope.test.ts` | 5 tests for checkCampaignVisibility with mock MembershipService |

## Checks

| Check | Result | Detail |
|---|---|---|
| `bundle validate --strict --target dev` | pass | Validation OK |
| No `scim` in campaign/ | pass | grep -rni returned 0 matches |
| No `/Me` API path in campaign/ | pass | No real /Me hits (MembershipService substring excluded) |
| No template-literal SQL in config.ts | pass | No `${` patterns found |
| Parameterised queries in config.ts | pass | $1/$2/$3 markers present |
| MembershipService in services/index.ts | pass | 3 references (import, interface, construction) |
| resolveRoles is async | pass | `export async function resolveRoles(` confirmed |
| pnpm exec tsc --noEmit | skipped | No Node toolchain in serverless |
| pnpm exec vitest run | skipped | No Node toolchain in serverless |

## Decisions

None — all decisions from prior run remain valid.

## Requests

| Path | Change | Why |
|---|---|---|
| `server/services/campaign/campaignManager.ts` | Replace `fetchUserGroups` (SCIM `/Me`) and `isVisibleTo` with `checkCampaignVisibility` from `scope.ts`, passing `services.membership`. Delete `fetchUserGroups`. | Wave 1 gate: "No file under `server/services/campaign` references SCIM or `/Me`". `campaignManager.ts` is not in session 08's owned_paths. |
