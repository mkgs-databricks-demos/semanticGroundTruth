# 09 — App: catalog browsing, source registration, import

**Wave 1 · edit · owns `ground-truth-app/server/services/sources/**`, `ground-truth-app/server/services/asset/**`, `ground-truth-app/server/services/metricView/**`, `ground-truth-app/server/routes/assets.ts`, `ground-truth-app/server/routes/metricViews.ts`, `ground-truth-app/server/seed/**`**

## Context
* Contract: build_conventions §4–§5 and plan 01 types. Existing: `MetricViewService` (OBO SQL Statement API, `DESCRIBE ... AS JSON`), `parseMetricViewYaml`, `AssetRegistry.register()` with `version_hash`.
* Do not edit `services/index.ts` or `server.ts` (owned by plan 08): construct `SourceService` inside `registerAssetRoutes` from `services.db`, `services.assets`, `services.metricViews`.
* Workspace reads use the app SPN (AppKit/SDK default credentials); catalog reads use the caller's OBO token.

## Steps
1. `metricViewService.ts`: `listCatalogs(token)`, `listSchemas(token, catalog)`, `listMetricViews(token, catalog, schema)` via `information_schema` with bound parameters (`:catalog`, `:schema`) — never string-concatenate identifiers into SQL; quote identifiers with backticks after validating `^[A-Za-z0-9_\-]+$`.
2. `services/sources/`: `glossaryParser.ts` (pure, exact rules in §5, unit-tested against fixtures copied from `docs/semantics/01_ground_truth_app_core_terms.md` and one wanderBricks glossary excerpt), `workspaceFiles.ts` (list recursively + export text via the workspace API; glob match with `picomatch`-style matcher already in deps or a small local matcher; map 403 to `SOURCE_ACCESS_DENIED` with the §4 message), `sourceService.ts` (`register`, `list`, `scan`, `importAssets`).
3. `importAssets`: metric views → measure/dimension assets (link `repo_url`/`fixture_path` when a matching YAML exists in the source); glossary terms → `page` assets with `source_id` + `source_metadata`; idempotent through the existing unique key and `version_hash` (re-import updates and records a new `asset_versions` row only when the hash changes).
4. Routes: catalogs/schemas/metric-views in `routes/metricViews.ts`; sources + import in `routes/assets.ts`; all steward-only, zod-validated using plan 01 schemas.
5. `seed/`: keep sample seeding dev-only; no change unless types break.

## Done when
* Server typecheck passes; `pnpm exec vitest run server/services/sources server/services/asset server/services/metricView` passes, including parser tests for both glossary formats.
* No SQL string in these folders interpolates a request value.
