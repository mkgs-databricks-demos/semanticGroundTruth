# Session 01 — App shared contracts: RBAC groups, sources, import

**Wave:** 0 · **Mode:** edit · **Run:** 991892831639332 · **Branch:** mg-genie-agent-build

## Scope

Add app-group, asset-source and import DTOs + zod schemas to `ground-truth-app/shared/contracts` per root build_conventions §3–§5.

## Changes

### `values.ts`

* `APP_GROUP_NAMES = ['semantic-ground-truth-admins', 'semantic-ground-truth-stewards', 'semantic-ground-truth-users'] as const`
* `AppGroupName` type (union of the three group names)
* `APP_GROUP_ROLE: Record<AppGroupName, Role>` (admins→admin, stewards→steward, users→reviewer)
* `SOURCE_TYPES = ['git_folder'] as const` + `SourceType`
* `DEFAULT_METRIC_VIEW_GLOB = '**/*.metric_view.yml'`
* `DEFAULT_GLOSSARY_GLOB = '**/semantics/**/*.md'`

### `entities.ts`

* `AppGroup { name: AppGroupName, role: Role, description, members: AppGroupMember[], createdAt }`
* `AppGroupMember { groupName: AppGroupName, memberId, addedBy, addedAt }`
* `AssetSource { id, sourceType: SourceType, workspacePath, displayName, metricViewGlob, glossaryGlob, createdBy, createdAt, lastScannedAt }`
* Extended `Asset` with `sourceId: string | null` and `sourceMetadata: Record<string, unknown> | null`
* Added `AppGroupName`, `Role`, `SourceType` to type imports from `./values`

### `errors.ts`

* Added `SOURCE_ACCESS_DENIED` to `ERROR_CODES` array and `ERROR_STATUS` map (HTTP 403)
* `CONFLICT` was already present (confirmed)

### `api.ts`

Catalog browse:
* `CatalogEntry { name, comment }`, `CatalogsResponse`
* `CatalogSchemasQuerySchema` + `CatalogSchemasQuery`, `SchemaEntry { name, fullName, comment }`, `SchemasResponse`
* `CatalogMetricViewsQuerySchema` + `CatalogMetricViewsQuery`, `CatalogMetricViewsResponse`

Asset sources:
* `SourcesResponse`
* `noTraversalGlob` (rejects `..` in globs)
* `RegisterSourceBodySchema` + `RegisterSourceBody`, `RegisterSourceResponse`
* `ScanMetricViewFile`, `ScanGlossaryTerm`, `ScanSourceResponse`

Import:
* `fqn` regex validator: `^[^.\s]+\.[^.\s]+\.[^.\s]+$`
* `ImportGlossaryTermSchema` + `ImportGlossaryTerm`
* `ImportAssetsBodySchema` (refine: at least one of metricViews or glossaryTerms) + `ImportAssetsBody`, `ImportAssetsResponse { created, updated, skipped: {ref, reason}[] }`

Admin groups:
* `AdminGroupsResponse`
* `AddGroupMemberBodySchema` + `AddGroupMemberBody`
* `GroupNameParamSchema` + `GroupNameParam`
* `RemoveGroupMemberParamSchema` + `RemoveGroupMemberParam`

Import additions: `AppGroup`, `AssetSource`, `MetricViewSummary` (type), `APP_GROUP_NAMES` (runtime value).

### `index.ts`

No change needed — existing barrel re-exports (`export * from './values'`, `export type * from './entities'`, `export * from './api'`, `export * from './errors'`) already surface all new exports.

## Checks

| Check | Result | Detail |
|---|---|---|
| No `enum` / `namespace` under `shared/` | pass | grep returned 0 matches |
| Every §4 route has request/response type | pass | 11 routes verified |
| `APP_GROUP_NAMES` exact values | pass | admins, stewards, users |
| `verbatimModuleSyntax` compliance | pass | entities uses `import type`, api.ts splits runtime vs type imports |
| `bundle validate --strict --target dev` (app) | pass | Validation OK |
| `pnpm exec tsc --noEmit` | skipped | No Node toolchain in serverless |

## Decisions

* `AppGroup.name` and `AppGroupMember.groupName` typed as `AppGroupName` (not plain string) — downstream sessions can rely on the literal type.
* `RegisterSourceBodySchema` does not include `sourceType` — server hard-codes `git_folder` per §4.
* `noTraversalGlob` rejects `..` anywhere in the string (conservative; actual path traversal is `../`).
* `fqn` regex requires exactly 3 dot-separated, non-empty, no-whitespace segments.

## Files modified

* `ground-truth-app/shared/contracts/values.ts`
* `ground-truth-app/shared/contracts/entities.ts`
* `ground-truth-app/shared/contracts/errors.ts`
* `ground-truth-app/shared/contracts/api.ts`
