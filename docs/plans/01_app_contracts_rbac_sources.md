# 01 — App shared contracts: RBAC groups, asset sources, import

**Wave 0 · edit · owns `ground-truth-app/shared/contracts/**`**

## Context
* Read `docs/plans/build_conventions.md` §3–§5 (root) and `docs/plans/app/build_conventions.md` (moved from `ground-truth-app/docs/plans/` on 2026-10-24; app contract style: `as const` arrays, zod schemas next to DTOs, no `enum`/`namespace`).
* Existing files: `shared/contracts/{values,entities,review,api,mcp,errors,index}.ts`. `ASSET_TYPES` already contains `page`; `ROLES = ['reviewer','steward','admin']`.

## Steps
1. `values.ts`: add `APP_GROUP_NAMES = ['semantic-ground-truth-admins','semantic-ground-truth-stewards','semantic-ground-truth-users'] as const`, `APP_GROUP_ROLE: Record<AppGroupName, Role>` (admins→admin, stewards→steward, users→reviewer), `SOURCE_TYPES = ['git_folder'] as const`, `DEFAULT_METRIC_VIEW_GLOB = '**/*.metric_view.yml'`, `DEFAULT_GLOSSARY_GLOB = '**/semantics/**/*.md'`.
2. `entities.ts`: `AppGroup {name, role, description, members: AppGroupMember[]}`, `AppGroupMember {groupName, memberId, addedBy, addedAt}`, `AssetSource {id, sourceType, workspacePath, displayName, metricViewGlob, glossaryGlob, createdBy, createdAt, lastScannedAt}`; extend `Asset` with optional `sourceId` and `sourceMetadata` (record).
3. `api.ts`: request/response DTOs + zod schemas for every route in build_conventions §4: catalogs/schemas/metric-views list responses, `RegisterSourceRequest`, `ScanSourceResponse {metricViewFiles: {filePath, viewName}[], glossaryTerms: {filePath, term, domain?, subdomain?, definition}[]}`, `ImportAssetsRequest`, `ImportAssetsResponse {created: string[], updated: string[], skipped: {ref, reason}[]}`, `AddGroupMemberRequest {memberId}`. Validate fqn with `^[^.\s]+\.[^.\s]+\.[^.\s]+$`; reject globs containing `..`.
4. `errors.ts`: add `CONFLICT` if missing (last-admin guard) and `SOURCE_ACCESS_DENIED`.
5. Re-export from `index.ts`.

## Done when
* `pnpm exec tsc -p tsconfig.shared.json --noEmit` (or the repo's typecheck script) passes.
* No `enum ` / `namespace ` keywords under `shared/`.
* Every route in build_conventions §4 has a request and/or response type exported from `shared/contracts/index.ts`.
