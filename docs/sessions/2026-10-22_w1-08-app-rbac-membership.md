# Session 08 — App RBAC from Lakebase app groups + member admin API

**Wave:** 1 · **Mode:** edit · **Run:** 991892831639332 · **Branch:** mg-genie-agent-build

## Scope

MembershipService, role resolution from app groups with bootstrap admins, admin member routes, campaign RBAC against app groups, parameterised ConfigStore.update.

## Problems & Root Causes

1. **SQL injection in ConfigStore.update** — `update()` built SQL via string interpolation (`'${snakeKey}'`, `'${jsonValue}'`). Fixed with parameterised queries (`$1`, `$2`, `$3`).
2. **SCIM `/Me` in campaign visibility** — `campaignManager.ts` calls the SCIM API to resolve workspace group membership. Replaced the pattern in `scope.ts` with `checkCampaignVisibility` that uses `MembershipService` (Lakebase app groups, fail closed). `campaignManager.ts` itself is NOT in my owned_paths — filed a request.
3. **Roles were sync and email-only** — `resolveRoles` was synchronous, resolving only from `app_config` email lists. Now async, unions roles from app group membership + legacy email lists.

## Changes

### New files
* `server/services/membership/membershipService.ts` — `MembershipService` class: `rolesFor`, `listGroups`, `addMember`, `removeMember`, `bootstrap`, `isMemberOfAny`. 60 s in-process cache, invalidated on writes. Last-admin guard on remove. Bootstrap seeds admins group when empty.
* `server/services/membership/index.ts` — barrel export.

### Modified files
* `server/services/index.ts` — added `membership: MembershipService` to `Services` interface; constructed in `createServices`.
* `server/server.ts` — bootstrap admin group after migrations (`settings.adminEmails + settings.bootstrapAdminIds`); pass `membership` to `registerMiddleware`; renumbered startup steps.
* `server/lib/config.ts` — added `bootstrapAdminIds: string[]` to `AppSettings` + `DEFAULT_SETTINGS`; added `bootstrap_admin_ids` to snake/camel maps; parses `GT_BOOTSTRAP_ADMIN_IDS` env; `update()` now uses parameterised queries (no SQL injection).
* `server/middleware/roles.ts` — `resolveRoles` is now `async`, takes `MembershipService` as third arg; unions app-group roles + legacy email list roles; `admin` implies `steward`.
* `server/middleware/identity.ts` — accepts `MembershipService`; calls `await resolveRoles(email, settings, membership)`.
* `server/middleware/index.ts` — `registerMiddleware` deps now includes `membership`; passes it to `identityMiddleware`.
* `server/middleware/roles.test.ts` — rewritten: uses `vi.fn()` mock for `MembershipService`; 8 tests covering group roles, legacy fallback, admin-implies-steward.
* `server/routes/admin.ts` — added `GET /api/admin/groups`, `POST /api/admin/groups/:name/members`, `DELETE /api/admin/groups/:name/members/:memberId`; all admin-only, zod-validated with `GroupNameParamSchema`/`AddGroupMemberBodySchema`/`RemoveGroupMemberParamSchema` from shared contracts.
* `server/services/campaign/scope.ts` — added `checkCampaignVisibility(user, rbacGroups, membership)`: admins/stewards see all; empty groups = visible; otherwise resolve via `MembershipService.isMemberOfAny` (fail closed).
* `server/services/campaign/scope.test.ts` — added 5 tests for `checkCampaignVisibility` with mock `MembershipService`.

## Checks

| Check | Result | Detail |
|---|---|---|
| `bundle validate --strict --target dev` (app) | pass | Validation OK |
| No `scim` in scope.ts | pass | grep returned 0 |
| No `scim` in scope.test.ts | pass | grep returned 0 |
| No SQL injection in config.ts | pass | All queries use `$1`/`$2`/`$3` params |
| `MembershipService` class exported | pass | |
| `resolveRoles` is async | pass | |
| Admin group routes (3 endpoints) | pass | 6 references |
| `GT_BOOTSTRAP_ADMIN_IDS` parsed | pass | |
| `pnpm exec tsc --noEmit` | skipped | No Node toolchain in serverless |
| `pnpm exec vitest run` | skipped | No Node toolchain in serverless |

## Decisions

* `resolveRoles` returns a flat array from a `Set<Role>` — no duplicate roles, but order is not guaranteed (Set iteration order).
* `checkCampaignVisibility` **fails closed** (returns `false`) when user is not in any named group. Previous SCIM-based `isVisibleTo` failed open.
* `bootstrapAdminIds` is a new `AppSettings` field rather than a standalone env parse, keeping the pattern consistent with `adminEmails`/`stewardEmails`.
* Admin routes return the full refreshed group after add/remove (immediate feedback for the client).

## Requests

| Path | Change | Why |
|---|---|---|
| `server/services/campaign/campaignManager.ts` | Replace `fetchUserGroups` (SCIM `/Me`) and `isVisibleTo` with `checkCampaignVisibility` from `scope.ts`, passing `services.membership`. Delete `fetchUserGroups`. | Wave 1 gate: “No file under `server/services/campaign` references SCIM or `/Me`”. `campaignManager.ts` is not in session 08’s owned_paths. |

## Files modified

* `ground-truth-app/server/services/membership/membershipService.ts` (new)
* `ground-truth-app/server/services/membership/index.ts` (new)
* `ground-truth-app/server/services/index.ts`
* `ground-truth-app/server/server.ts`
* `ground-truth-app/server/lib/config.ts`
* `ground-truth-app/server/middleware/roles.ts`
* `ground-truth-app/server/middleware/identity.ts`
* `ground-truth-app/server/middleware/index.ts`
* `ground-truth-app/server/middleware/roles.test.ts`
* `ground-truth-app/server/routes/admin.ts`
* `ground-truth-app/server/services/campaign/scope.ts`
* `ground-truth-app/server/services/campaign/scope.test.ts`
