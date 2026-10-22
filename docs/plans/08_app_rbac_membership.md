# 08 — App: Lakebase-backed RBAC + member administration

**Wave 1 · edit · owns `ground-truth-app/server/middleware/**`, `ground-truth-app/server/services/membership/**`, `ground-truth-app/server/services/index.ts`, `ground-truth-app/server/server.ts`, `ground-truth-app/server/routes/admin.ts`, `ground-truth-app/server/lib/config.ts`, `ground-truth-app/server/services/campaign/scope.ts`, `ground-truth-app/server/services/campaign/scope.test.ts`**

## Context
* Model: build_conventions §3. Today `identity.ts` calls `resolveRoles(email, settings)` from `app_config` email lists (both empty in dev) so everyone is `reviewer`.
* `/api/me` for the M2M SPN returns `email` = its application id; treat that as `member_id`.
* `ConfigStore.update` builds SQL by string interpolation — replace with parameterised queries (security fix).

## Steps
1. `services/membership/membershipService.ts`: `class MembershipService { constructor(deps: ServiceDeps); rolesFor(memberId): Promise<Role[]>; listGroups(): Promise<AppGroup[]>; addMember(group, memberId, addedBy); removeMember(group, memberId); bootstrap(ids: string[]): Promise<number> }` with a 60 s in-process cache invalidated on writes; last-admin removal throws `CONFLICT`. Export from `services/membership/index.ts`.
2. `services/index.ts`: add `membership` to `Services`, construct it. `server.ts`: after migrations, `await services.membership.bootstrap([...GT_ADMIN_EMAILS, ...GT_BOOTSTRAP_ADMIN_IDS])` (no-op when admins already has members); pass `membership` to `registerMiddleware(app, { config, membership })`.
3. `middleware/identity.ts` + `roles.ts`: roles = `reviewer` ∪ group roles ∪ legacy `app_config` lists; `admin` implies `steward`. Keep the dev-mode fallback. Update `roles.test.ts`.
4. `routes/admin.ts`: `GET /api/admin/groups`, `POST /api/admin/groups/:name/members`, `DELETE /api/admin/groups/:name/members/:memberId` (admin only, zod-validated, group name must be one of `APP_GROUP_NAMES`).
5. `services/campaign/scope.ts`: resolve `rbac_groups` against app group membership (via `MembershipService`), remove any SCIM `/Me` lookup; fail closed when membership cannot be read.
6. `lib/config.ts`: parameterise `update()`; keep `GT_ADMIN_EMAILS` parsing; add `GT_BOOTSTRAP_ADMIN_IDS`.

## Done when
* `pnpm exec tsc --noEmit -p tsconfig.server.json` and `pnpm exec vitest run server/middleware server/services/membership server/services/campaign` pass.
* `grep -n "scim\|/Me" server/services/campaign` returns nothing; `config.ts` contains no SQL built with template-literal values.
