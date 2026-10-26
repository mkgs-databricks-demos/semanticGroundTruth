# Session 40 (wave 4-8): converge app, live contract tests at 100%

* **Date:** 2026-10-26
* **Job run:** `655172288447819`, task `w4-8_session`
* **Mode:** converge, runtime target `api_contract_tests` (job `443124502254957`, `[dev matthew_giglia] dev-semantic-ground-truth-api-contract-tests`)
* **Branch:** `mg-genie-build-4` (HEAD `6d26b3f`, tree clean at start; read-only git)
* **Plan:** `docs/plans/40_app_converge_contract_tests.md`
* **Status:** pass. 3 attempts; the last one is `stable`.

## Result

The final job run `687515436484443` had **147 pass, 0 fail, 176 skipped_live, 100.0% coverage**. Its rows are in `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results`. The app (`dev-semantic-ground-truth`, deployment `01f1d180ccfa147db429fdda372aea06`) is RUNNING/ACTIVE. Its logs show 0 error lines (1133 rows, gate `error_patterns`/`ignore_patterns`) and the `listening on` marker. The probes pass 8/8, and there are 869 spans since the deploy with 0 `STATUS_CODE_ERROR`. No `contract-test-*` campaign is active or paused.

## Attempts

| n | Job run | App deployment | Result | Notes |
| --- | --- | --- | --- | --- |
| 1 | `3631302379538` | `01f1d13e...` (session 36, pre-`e7c8736` code) | unhealthy | 18 fail rows, coverage 100%. A serverless task retry (attempt 1 of the task, same `run_id`) re-seeded on top and added 35 more fails, because the assets already existed. |
| 2 | `670565504854214` | `01f1d180ccfa147db429fdda372aea06` (`bundle run app`) | stable (0 fail) | After the server fixes and the first harness fixes. |
| 3 | `687515436484443` | same | **stable** | Final code: the SSE decoding fix was refined after attempt 2, and this is the run of record. |

In every attempt, `bundle deploy --target dev` updated all jobs and then failed only on the known no-op `apps update` (`400 Invalid delegation claim present in Ctx`, redacted `config.env`; see session 36). App code was redeployed with `bundle run app --target dev`.

## Attempt 1 failures, root causes, fixes

### Server (fixed)

| Check | Live behaviour | Root cause | Fix |
| --- | --- | --- | --- |
| `GET /health` happy | `{status:"ok"}` with no `db`/`migrations`/`version` | AppKit's server plugin registers its own `GET /health` in `extendRoutes()`, before `appkit.server.extend()` callbacks run. Express serves the first match, so the contract route never answered. | `server/routes/health.ts`: new `removeEarlierHealthRoutes(app)` drops earlier `GET /health` layers from the Express 4 stack before registering the contract handler. New `server/routes/health.test.ts`. Also checked with real express 4.22.2 (AppKit's copy): it removed 1 layer, and the body has all 4 fields. Live: `{"status":"ok","db":true,"migrations":9,"version":"0.0.0"}`. |
| `POST /api/assets/register` happy m1..m3 | `displayName: ""` | The insert stored `displayName ?? null`, and the mapper turned NULL into `''`. The spec (fake + `routeCases.ts`) defaults it to `name`. | `assetRegistry.register`: the insert uses `displayName ?? name`, and the new-version update uses `COALESCE($5, display_name, name)`, so an existing display name is kept. `mappers.rowToAsset` falls back to `name` for legacy NULL rows. |
| `GET /api/assets/:id/versions` 404 | 200 `[]` | No existence check | `AssetRegistry.requireAsset()` (404) in `listVersions`, `listExamples`, `addSynonym`, `removeSynonym`, `addExample` |
| `POST /api/review/synonym` / `example` 404 | 400 (FK violation) | Same | Same |
| `POST /api/admin/recompute/:id` 404 | 400 (FK violation on `confidence_scores`) | `recompute` used `hashRow?.version_hash ?? ''` | `ReviewEngine.recompute` throws `notFound` when the asset row is missing |
| `GET /api/review/next?campaignId=<unknown>` 404 | 200 `null` | Unknown campaign gave an empty queue | `ReviewEngine.getNextWithMeta` checks the campaign first (404) |
| `GET /api/catalog/schemas` 404 | 502 `TABLE_OR_VIEW_NOT_FOUND` | Warehouse "does not exist" errors surfaced as UPSTREAM_ERROR | `metricViewService.orNotFound()` maps `[TABLE_OR_VIEW_NOT_FOUND|SCHEMA_NOT_FOUND|NO_SUCH_CATALOG_EXCEPTION|CATALOG_NOT_FOUND]` to 404 (other upstream errors stay 502) |
| `GET /api/catalog/metric-views` 404 | 200 `[]` for a missing schema | The query only filtered `tables` | The query now reads `schemata LEFT JOIN tables` in one round trip: no row means 404, a NULL table means `[]` |
| `GET /api/metric-views/:fullName` 404 | 502 | As for schemas | `get()` wraps DESCRIBE in `orNotFound` |
| `POST /api/metric-views/:fullName/validate` 400 / 404 | 200 `{valid:false}` | `validate()` swallowed every error | `validate()` rethrows request errors (400/403/404/502). It returns `{valid:false, error}` only for a statement that ran and failed with a SQL error class (`[...]` prefix). |
| `POST /api/assets/import` 404 (with a valid body, see below) | would have been 200 with a per-term skip | Glossary terms with an unknown `sourceId` were caught per term | `SourceService.importAssets` resolves every referenced `sourceId` (top level and per glossary term) before any write, so an unknown one is a 404 |

### Live harness defects (fixed, no check loosened)

These were notebook bugs, not contract or server issues. Every check still asserts the same status, schema and error code.

* **SSE decoding** (`resource:ui://ground-truth/review-card:read`, `tool:metric_view_validate:happy`, `JSONDecodeError`). The MCP response is `text/event-stream` with no charset, so `requests` decoded `r.text` as ISO-8859-1. UTF-8 continuation bytes `0x85` became NEL (U+0085), and `str.splitlines()` split `data:` lines on them. Evidence: the review card HTML has 275 characters whose UTF-8 encoding contains `0x85`. Fix: `rpc()` decodes `r.content` as UTF-8 and splits only on CRLF/LF/CR (the SSE line endings).
* **`POST /api/assets/import` error_404** sent `{sourceId}` only. That is a 400 by contract (the schema requires `metricViews` or `glossaryTerms`). It now sends the same case as `tests/contract/routeCases.ts`: one glossary term with an unknown `sourceId`.
* **`POST /api/steward/feedback-branches` error_404** sent `{batchId}` only (400 by contract). It now sends a valid `UpsertFeedbackBranchRequest` with an unknown `batchId`, the same as `routeCases.ts`. The 404 is raised before any write.

## Decisions

* The contract was not changed, and no check was removed or loosened. I added no `skipped_live` rows.
* **Plan conflict, noted, not changed:** plan 40 says `skipped_live` is allowed only for 403 role checks. Session 35's harness, unchanged here, also records `skipped_live` for 401 (Apps proxy, 49 rows), 500/502 failure injection (60), unsafe 409s (4), undeletable or real-resource happy paths, two-identity conflict resolve, and non-executable seeded SQL. Those reasons are in the rows and match session 35's documented design: every one is covered in-process. The job's own gate (0 fail and 100% coverage) and the plan's "Stable when" both pass. If the owner wants fewer live skips, that is a harness change for a later session.
* The `/health` fix edits the Express route stack (`app._router.stack`). The alternative was to drop AppKit's `server()` plugin, which is a much bigger change. The helper is a no-op when the router is absent, and a unit test covers it.

## Checks

| Check | Result |
| --- | --- |
| `bundle validate --strict --target dev` (final code) | pass |
| `pnpm install --frozen-lockfile` in `/tmp/gt-40` (runbook toolchain, Node 22.16.0, pnpm 11.0.8) | pass |
| `pnpm exec vitest run` (final tree, identical to the repo) | 37 files, 932 passed |
| `pnpm exec tsc -b tsconfig.server.json` / `tsconfig.client.json` | exit 0 / exit 0 |
| `api_contract_tests` run `687515436484443` | SUCCESS: 147 pass, 0 fail, 176 skipped_live, coverage 100.0% |
| Previously failing 18 check ids | all `pass` in runs `670565504854214` and `687515436484443` |
| App runtime (deployment `01f1d180...`) | RUNNING/ACTIVE; 0 error lines; `listening on` present; probes 8/8; 869 spans, 0 errors; same deployment after a ~3 min soak |
| Cleanup | no active or paused `contract-test-*` campaign (`GET /api/campaigns`) |

## Files

* `ground-truth-app/server/routes/health.ts`
* `ground-truth-app/server/routes/health.test.ts` (new)
* `ground-truth-app/server/services/asset/assetRegistry.ts`
* `ground-truth-app/server/services/asset/mappers.ts`
* `ground-truth-app/server/services/review/reviewEngine.ts`
* `ground-truth-app/server/services/metricView/metricViewService.ts`
* `ground-truth-app/server/services/sources/sourceService.ts`
* `ground-truth-app/src/notebooks/api_contract_tests.ipynb`

## Requests

* None blocking. Optional for the owner: the job task has no `max_retries: 0`. A serverless retry of a failed run reuses the same `run_id` and seeds on top of the first attempt, which doubles fail rows. That is harmless when the run passes.
