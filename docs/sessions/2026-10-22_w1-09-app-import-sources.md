# Session 09 — App catalog browsing, source registration, import

**Wave:** 1  
**Mode:** edit  
**Run:** 991892831639332  
**Date:** 2026-10-22  
**Branch:** mg-genie-agent-build  

## Summary

Implemented OBO catalog/schema/metric-view listing, Git folder source registration with recursive scan, glossary markdown parser (both formats), and asset import (metric views → measure/dimension, glossary terms → page). All new routes are steward-only and zod-validated per conventions §4.

## Changes

### New files (5)

| File | Purpose |
| --- | --- |
| `ground-truth-app/server/services/sources/glossaryParser.ts` | Pure markdown glossary parser supporting both docs/semantics and wanderBricks formats. Extracts domain, subdomain, definition, business context, data usage, related terms, source. Computes version_hash per term block. |
| `ground-truth-app/server/services/sources/glossaryParser.test.ts` | Unit tests covering both glossary formats plus edge cases (missing definition, empty input, non-glossary markdown). |
| `ground-truth-app/server/services/sources/workspaceFiles.ts` | Workspace REST API client for recursive file listing and text export using app SPN credentials. Returns SOURCE_ACCESS_DENIED with §4 message on 403. Includes a zero-dependency glob matcher. |
| `ground-truth-app/server/services/sources/sourceService.ts` | SourceService class: register (upsert), list, scan (workspace files → metric view YAML + glossary candidates), importAssets (metric views → measure/dimension via existing AssetRegistry, glossary terms → page with source_metadata). |
| `ground-truth-app/server/services/sources/index.ts` | Barrel re-export for the sources module. |

### Modified files (4)

| File | Change |
| --- | --- |
| `ground-truth-app/server/services/metricView/metricViewService.ts` | Added `listCatalogs(token)`, `listSchemas(token, catalog)`, `listMetricViews(token, catalog, schema)` using information_schema with bound parameters. Identifiers validated with `^[A-Za-z0-9_-]+$` before backtick quoting. |
| `ground-truth-app/server/services/asset/mappers.ts` | Added `sourceId` and `sourceMetadata` (handles JSON string or object) to `rowToAsset` mapper so the Asset entity includes the new columns from migration 007. |
| `ground-truth-app/server/routes/metricViews.ts` | Added `/api/catalog/catalogs`, `/api/catalog/schemas`, `/api/catalog/metric-views` routes, all steward-only + OBO. |
| `ground-truth-app/server/routes/assets.ts` | Added `/api/sources` (GET, POST), `/api/sources/:id/scan` (POST), `/api/assets/import` (POST). SourceService constructed inside registerAssetRoutes from services.db, services.assets, services.metricViews (does not edit services/index.ts). |

## Decisions

* SourceService is constructed inside `registerAssetRoutes` (not in the services composition root) because plan 09 says not to edit `services/index.ts` (owned by session 08).
* The glob matcher is a zero-dependency local implementation rather than adding picomatch as a new dependency.
* Metric view import creates one asset per measure and one per dimension, named `<catalog.schema.view>/<column_name>`.
* Glossary import re-reads and re-parses the file for each imported term to guarantee fresh content. The scan result is a preview; the import does the authoritative parse.

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` (app) | pass |
| No SQL interpolation of request values | pass — all SQL uses bound parameters; catalog/schema in `information_schema` queries are validated by regex before backtick-quoting |
| All import paths resolve to existing files | pass |
| `pnpm exec tsc --noEmit` | skipped — no Node toolchain in serverless |
| `pnpm exec vitest run` | skipped — no Node toolchain in serverless |
