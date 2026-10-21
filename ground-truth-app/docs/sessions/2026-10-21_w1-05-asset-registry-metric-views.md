# Session 05: Asset Registry, Metric View Reader, Dev Seed

**Wave:** 1 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created 10 files across `server/services/asset/`, `server/services/metricView/`, and `server/seed/`. The AssetRegistry provides full CRUD for assets, versions, synonyms, and example questions using `$n` parameterized queries against Lakebase. MetricViewService reads metric views via the SQL Statement API with the user's OBO token. An idempotent dev seed of 12 sample assets (6 measures, 4 dimensions, 1 page, 1 domain across sales/operations) is included.

## Files Created

| File | Exports |
|---|---|
| `server/services/asset/mappers.ts` | `rowToAsset`, `rowToAssetVersion`, `rowToSynonym`, `rowToExampleQuestion` |
| `server/services/asset/versionHash.ts` | `computeVersionHash(yamlContent): string` (sha256 hex) |
| `server/services/asset/assetRegistry.ts` | `class AssetRegistry` (constructor `ServiceDeps`): register, get, list, listVersions, listSynonyms, listExamples, addSynonym, voteSynonym, removeSynonym, addExample, voteExample, updateStatus, touchReviewed, applyEdits |
| `server/services/asset/index.ts` | Barrel: re-exports AssetRegistry, computeVersionHash, mappers |
| `server/services/metricView/metricViewService.ts` | `class MetricViewService` (no-arg constructor): list, get, validate, runAssetQuery |
| `server/services/metricView/parseMetricViewYaml.ts` | `parseMetricViewYaml(yaml): { measures, dimensions }` |
| `server/services/metricView/index.ts` | Barrel: re-exports MetricViewService, parseMetricViewYaml |
| `server/seed/sampleAssets.ts` | `SAMPLE_ASSETS: RegisterAssetBody[]` (12 items) |
| `server/seed/seed.ts` | `seedSampleAssets(registry, db, settings): Promise<number>` |
| `server/seed/index.ts` | Barrel: re-exports seedSampleAssets, SAMPLE_ASSETS |

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| AssetRegistry, computeVersionHash, MetricViewService, parseMetricViewYaml, seedSampleAssets, SAMPLE_ASSETS exported | pass |
| SQL uses $n placeholders (Lakebase) or :param (Statement API) | pass |
| No string-interpolated user input in SQL | pass |
| Back-quoted identifiers pass /^[A-Za-z0-9_]+/ regex first | pass |
| No snake_case keys in return types | pass |
| All relative imports resolve | pass |
| TypeScript compilation | skipped (no Node toolchain) |

## Assumptions

* Session 03 (parallel) owns table/column names. Column names used here are from plan 03 Tasks 4–9 and match entities.ts (snake_case in DB → camelCase in DTOs via mappers).
* `DESCRIBE TABLE EXTENDED ... AS JSON` returns JSON rows with `view_text` containing the YAML — to be verified after deploy.
* `parseMetricViewYaml` is a dependency-free line-based parser that tolerates unknown YAML keys. Not a full YAML parser — metric view YAML is simple enough.
* `applyEdits` stores proposed edits as feedback only (log line); mutations flow through the feedback pipeline per plan scope.

## Requests

None.
