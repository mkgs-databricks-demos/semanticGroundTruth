# Session 10 — App client: import wizard + members page

**Wave:** 1 · **Mode:** edit · **Run:** 991892831639332 · **Branch:** mg-genie-agent-build

## Scope

Steward campaign-from-assets wizard (metric views, Git folder source, glossary terms) and admin Members page using shared contracts.

## Changes

### API layer (`client/src/lib/api/`)

#### `http.ts`
* Added `apiDelete<T = void>(path: string): Promise<T>` for DELETE requests.

#### `endpoints.ts`
New endpoints matching conventions §4 and §3:
* `getCatalogs(): Promise<CatalogsResponse>` — `GET /api/catalog/catalogs`
* `getCatalogSchemas(query): Promise<SchemasResponse>` — `GET /api/catalog/schemas`
* `getCatalogMetricViews(query): Promise<CatalogMetricViewsResponse>` — `GET /api/catalog/metric-views`
* `getSources(): Promise<SourcesResponse>` — `GET /api/sources`
* `registerSource(body): Promise<RegisterSourceResponse>` — `POST /api/sources`
* `scanSource(sourceId): Promise<ScanSourceResponse>` — `POST /api/sources/:id/scan`
* `importAssets(body): Promise<ImportAssetsResponse>` — `POST /api/assets/import`
* `getAdminGroups(): Promise<AdminGroupsResponse>` — `GET /api/admin/groups`
* `addGroupMember(groupName, body): Promise<void>` — `POST /api/admin/groups/:name/members`
* `removeGroupMember(groupName, memberId): Promise<void>` — `DELETE /api/admin/groups/:name/members/:memberId`

#### `keys.ts`
New query keys: `catalogs`, `catalogSchemas(catalog)`, `catalogMetricViews(catalog, schema)`, `sources`, `adminGroups`.

#### `hooks.ts`
New hooks:
* Queries: `useCatalogs()`, `useCatalogSchemas(query)`, `useCatalogMetricViews(query)`, `useSources()`, `useAdminGroups()`
* Mutations: `useRegisterSource()`, `useScanSource()`, `useImportAssets()`, `useAddGroupMember()`, `useRemoveGroupMember()`

#### `index.ts`
Added `apiDelete` to barrel re-export.

### Import wizard (`client/src/components/steward/ImportWizard.tsx`)

5-step wizard as a `Sheet` component:
1. **Metric Views**: Catalog → schema → multi-select metric views (OBO-backed listing).
2. **Git Source**: Browse existing sources or register new one; auto-scans for YAML files.
3. **Glossary Terms**: Checkbox list of scanned terms with definition preview.
4. **Import**: Calls `POST /api/assets/import`, shows loading spinner.
5. **Campaign**: Shows import summary (created/updated/skipped counts), offers campaign creation pre-filled with imported asset IDs.

Exports: `ImportWizard`, `ImportWizardProps`.

### Members panel (`client/src/components/admin/MembersPanel.tsx`)

Card component showing the three app groups (`semantic-ground-truth-admins`, `-stewards`, `-users`) with:
* Member table per group (member ID, added by, date).
* Add member form (email or SPN application ID) with Enter-key support.
* Remove member with confirm step (shows 409 last-admin message from the API).
* Role badge per group using `APP_GROUP_ROLE` from shared contracts.

Exports: `MembersPanel`.

### Page integration

#### `StewardPage.tsx`
* Added "Import Assets" button next to "New Campaign" in header.
* Renders `ImportWizard` sheet.

#### `AdminPage.tsx`
* Added `MembersPanel` at the top of the admin settings stack (above ScoringConfigForm).

### Navigation (already done)

`NavLinks.tsx` already gates `/steward` behind `hasRole(me, 'steward')` and `/admin` behind `hasRole(me, 'admin')` — no changes needed.

## Checks

| Check | Result | Detail |
|---|---|---|
| No client file imports from `server/` | pass | grep returned 0 matches |
| No `enum` / `namespace` in changed files | pass | grep returned 0 matches |
| No default exports in new files | pass | Only `App.tsx` has `export default` (unchanged) |
| `import type` for type-only imports | pass | All entity/API types use `import type`; runtime values use `import` |
| `bundle validate --strict --target dev` (app) | pass | Validation OK |
| `pnpm exec tsc --noEmit` | skipped | No Node toolchain in serverless |
| `pnpm run build:client` | skipped | No Node toolchain in serverless |

## Decisions

* Import wizard opens as a right-side `Sheet` (matches `CreateCampaignSheet` pattern) rather than a separate page.
* `apiDelete` is a standalone function (not merged into `apiSend`) for type clarity—`DELETE` has no request body.
* `MembersPanel` placed first in the admin page to surface the new RBAC management prominently.
* Source registration accepts only the workspace path (server hard-codes `sourceType = 'git_folder'` per §4).

## Files modified

* `ground-truth-app/client/src/lib/api/http.ts`
* `ground-truth-app/client/src/lib/api/endpoints.ts`
* `ground-truth-app/client/src/lib/api/keys.ts`
* `ground-truth-app/client/src/lib/api/hooks.ts`
* `ground-truth-app/client/src/lib/api/index.ts`
* `ground-truth-app/client/src/components/steward/ImportWizard.tsx` (new)
* `ground-truth-app/client/src/components/admin/MembersPanel.tsx` (new)
* `ground-truth-app/client/src/pages/steward/StewardPage.tsx`
* `ground-truth-app/client/src/pages/admin/AdminPage.tsx`
