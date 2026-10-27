# Session 05: Asset Registry, Metric View Reader, Dev Seed

## Scope
Implement the asset data-access service (`AssetRegistry`), a read-only metric view reader over UC (`MetricViewService`, OBO via the SQL Statement API), and an idempotent dev seed of sample assets. These are the data sources the Review Engine (06), Campaign Manager (07), REST routes (09) and MCP tools (11) use.

## Context
* `../docs/design/L200-C1_asset_registry.md` (registration flow, version hashing, synonyms, example questions).
* `../docs/design/L200-C9_metric_view_generator.md` and `L300-11_metric_views_and_dashboard.md` for metric view shape (YAML with `measures:` / `dimensions:`).
* Contracts: `build_conventions.md` §7 (`ServiceDeps`, `Db`, `EventBus`, `executeStatement`, `UserContext`); DTOs in `shared/contracts/entities.ts` + `api.ts` (session 01). Map snake_case rows to camelCase DTOs in one `rowToAsset()` etc. per file.
* Tables from session 03 migrations (`app.assets`, `app.asset_versions`, `app.asset_synonyms`, `app.synonym_votes`, `app.example_questions`, `app.example_question_votes`).

## Tasks
1. `server/services/asset/mappers.ts` — `rowToAsset`, `rowToAssetVersion`, `rowToSynonym`, `rowToExampleQuestion` (Date -> ISO string, numeric strings -> numbers).
2. `server/services/asset/versionHash.ts` — `computeVersionHash(yamlContent: string): string` (sha256 hex via `node:crypto`, after normalising line endings and trimming trailing whitespace per line).
3. `server/services/asset/assetRegistry.ts` — `class AssetRegistry { constructor(deps: ServiceDeps) }` with:
   * `register(input: RegisterAssetBody, registeredBy: string): Promise<RegisterAssetResult>` — identity = (`asset_type`, `name`, `repo_url`, `fixture_path`); new -> insert asset + version 1 + synonyms + example questions (`source = 'registration'`); same hash -> `created: false, newVersion: false`; different hash -> insert `asset_versions` row (`change_type = 'modified'`), update asset `version_hash`, set `status = 'PENDING'` and emit `asset.registered { isNewVersion: true }`. Use CTE statements; no client-side transactions.
   * `get(assetId): Promise<Asset>` (throws `notFound`), `list(q: ReviewableQuery): Promise<Paged<Asset>>`, `listVersions(assetId)`, `listSynonyms(assetId)` (with approve/reject counts from `synonym_votes`), `listExamples(assetId)`.
   * `addSynonym(assetId, synonym, userId)`, `voteSynonym(assetId, synonym, userId, action: 'approve'|'reject')` (upsert on the user's vote), `removeSynonym` (sets `is_active = false`; steward only — the route enforces role).
   * `addExample(assetId, questionText, userId)`, `voteExample(questionId, userId, action)`.
   * `updateStatus(assetId, status: AssetStatus)` and `touchReviewed(assetId)` (sets `last_reviewed_at = NOW()`).
   * `applyEdits(assetId, edits, userId)` — stores proposed edits only as feedback (do NOT mutate the asset's description; edits flow through the feedback pipeline); returns void.
4. `server/services/metricView/metricViewService.ts` — `class MetricViewService` (no-arg constructor), all methods take `user: UserContext` and require `user.accessToken` (else throw `forbidden('OBO token required')`):
   * `list(user, opts?: { catalog?: string; schema?: string }): Promise<MetricViewSummary[]>` — `SELECT table_catalog, table_schema, table_name, comment FROM system.information_schema.tables WHERE table_type = 'METRIC_VIEW' AND table_catalog = :catalog AND table_schema = :schema` (named parameters). Defaults: `process.env.GT_METRIC_VIEW_CATALOG ?? 'hls_fde_dev'`, `process.env.GT_METRIC_VIEW_SCHEMA ?? 'dev_matthew_giglia_semantic_ground_truth'`.
   * `get(user, fullName): Promise<MetricViewDetail>` — validate `fullName` against `/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/` (prevents injection; identifiers are back-quoted), run `DESCRIBE TABLE EXTENDED \`c\`.\`s\`.\`t\` AS JSON`, read `view_text` as `yaml`, and extract measures/dimensions with `parseMetricViewYaml(yaml)`.
   * `validate(user, fullName): Promise<{ valid: boolean; error?: string }>` — `DESCRIBE TABLE` succeeds -> valid.
   * `runAssetQuery(user, sql: string, rowLimit = 100): Promise<QueryResult>` — only allows statements starting with `SELECT` or `WITH` (case-insensitive, after comments stripped) and containing no `;` beyond a trailing one; else `badRequest`.
5. `server/services/metricView/parseMetricViewYaml.ts` — dependency-free, line-based extraction of `measures:` and `dimensions:` list items (`- name:`, `expr:`, `comment:`, `display_name:`, `synonyms:` inline list). Pure function, exported for tests. Tolerates unknown keys.
6. `server/seed/sampleAssets.ts` — `SAMPLE_ASSETS: RegisterAssetBody[]` with 12 realistic assets across 2 domains (`sales`, `operations`): 6 measures, 4 dimensions, 1 page, 1 domain; each with `description`, `plainEnglishLogic`, `yamlContent`, 2-3 synonyms, 1-2 example questions; `repoUrl: 'seed://ground-truth-app'`, `environment: 'dev'`.
7. `server/seed/seed.ts` — `seedSampleAssets(registry: AssetRegistry, db: Db, settings: AppSettings): Promise<number>` — runs only when `settings.seedSampleAssets === true` or `NODE_ENV === 'development'`, and only if `app.assets` has zero rows; returns the number registered (`registeredBy = 'seed'`).
8. `server/services/asset/index.ts`, `server/services/metricView/index.ts` — barrels.

## Acceptance Criteria
- [ ] `AssetRegistry`, `computeVersionHash`, `MetricViewService`, `parseMetricViewYaml`, `seedSampleAssets`, `SAMPLE_ASSETS` exported with the signatures above.
- [ ] Every SQL string uses `$n` placeholders (Lakebase) or named `:param` parameters (Statement API) — no string-interpolated user input, except back-quoted identifiers that passed the regex.
- [ ] No method returns snake_case keys.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/services/asset/**`
- `server/services/metricView/**`
- `server/seed/**`

## Dependencies
- Session 01: DTOs. Session 02: `server/lib/*`. Session 03 (parallel, same wave): table/column names — read plan 03 Tasks 4-9 for the exact columns.
