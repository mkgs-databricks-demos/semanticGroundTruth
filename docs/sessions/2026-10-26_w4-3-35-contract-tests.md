# Session 35 (wave 4-3): contract tests for every REST route and MCP tool

* **Date:** 2026-10-26 (attempt 2 of job run `110489694161084`, task `w4-3_session`)
* **Mode:** edit · **Branch:** `mg-genie-build-4` (verified, read-only git)
* **Plan:** `docs/plans/35_app_contract_tests.md`
* **Status:** pass

## Problem

The first attempt (2026-10-25, ~23:11Z) wrote the in-process suite (8 files under `ground-truth-app/tests/contract/`) and then stopped, probably at the turn limit. It left the status file `in_progress`, no summary, no coverage test, no `manifest.json`, and no live job. The w4-3 integrator credited the 8 files to session 35 and left them uncommitted. This retry kept that work and finished the scope.

## Changes

### In-process suite (`ground-truth-app/tests/contract/`)

* Kept from attempt 1: `fakeStore.ts`, `fixtures.ts`, `harness.ts`, `routeCases.ts`, `toolCases.ts`, `routes.contract.test.ts`, `mcp.contract.test.ts`, `invariants.contract.test.ts`.
* **Fixed** `invariants.contract.test.ts` settings round-trip: it sent `reducedMotion` / `autoAdvance`, which are not `UpdateUserSettingsRequestSchema` fields (the schema is `.strict()`, so the route answered 400). It now sends `theme`, `motion`, `showKeyboardHints` and asserts the stored values. The test was wrong, not the server.
* **New** `coverage.contract.test.ts`. It fails when a `ROUTE_CONTRACTS` / `MCP_TOOL_CONTRACTS` entry has no case, when a case has no contract, when a listed error status has no case / generator / `na` reason, when an explicit error case uses an unlisted status, when a tool with `emptyText` has no empty case, when the tool count is not 13, and when `manifest.json` is stale. It also checks that the manifest's review card URI and MIME type match the server constants (`REVIEW_CARD_URI`, `RESOURCE_MIME_TYPE`).
* **New** `manifest.ts` + `generate-manifest.ts`. The manifest is built from `toJsonSchemas()`, the same generator plan 25 uses for `contracts.schema.json`. It lists, per route: key, method, path, role, success status, error statuses, request/query/params/response `$ref`. Per tool: role, `emptyText`, input/output `$ref`, `uiResourceUri` for the 4 card tools, and `knownDefects` keys. It also lists the MCP resource (`ui://ground-truth/review-card`, `text/html;profile=mcp-app`). There is one entry per line, the same layout as `contracts.schema.json`.
* **New** `manifest.json` (committed generator output: 50 routes, 13 tools, 1 resource). Regenerate with `pnpm exec tsx tests/contract/generate-manifest.ts > tests/contract/manifest.json`.
* `mcp.contract.test.ts` now imports `UI_TOOLS` from `manifest.ts`, so there is one source.

### Live job

* **New** `src/notebooks/api_contract_tests.ipynb` (9 cells). The first cell is "Install latest Databricks SDK" (`databricks-sdk jsonschema requests` + `dbutils.library.restartPython()`). The notebook loads `manifest.json` and `contracts.schema.json` from the bundle files (app root = notebook `parents[2]`) and builds an M2M session (secret scope keys, `WorkspaceClient(...).config.authenticate()` per request; a redirect is reported as missing `CAN_USE`).
  * It seeds 3 run-scoped assets (`contract_test_<run_id>_m1..m3`, domain `ContractTest`) and a campaign `contract-test-<run_id>` scoped to them, all through the API.
  * Every route check: status, JSON Schema (draft 2020-12, closed objects) and exact seeded values. Negative 400/404 cases (and one 409: reactivating an archived campaign). Error bodies must match `ErrorResponse` with the right `error.code`.
  * Live invariants: skip increments `skippedCount` by 1, skip is not a vote, skip leaves confidence unchanged, the cooldown hides the skipped asset, and settings round-trip.
  * MCP: `initialize`, `tools/list` (exactly the 13 manifest tools; `_meta.ui.resourceUri` only on the card tools), `resources/read` (MIME type, HTML > 1000 chars), and `tools/call` happy + invalid-args / NOT_FOUND per tool (JSON or SSE responses). `review_skip_card`'s extra `next` field is validated separately.
  * Rows recorded as `skipped_live` with a reason: 401 (Apps proxy), 403 (the SPN is admin), 500/502, unsafe 409s, and happy paths that create undeletable resources (`POST /api/sources`, `/api/assets/import`, feedback branches, freshness-check). Also the conflict resolve route (needs two identities), the seeded-asset run-query, and the metric view routes/tools when the schema has no metric view.
  * Cleanup: archives both campaigns, removes the test stewards member it added, and restores settings and notification preferences. Assets, votes, skips, synonyms and examples stay (there is no delete API).
  * Writes one row per check to `` `<catalog>`.`<schema>`.`api_contract_results` `` (CREATE TABLE IF NOT EXISTS; columns `run_id, check_id, kind, method, path_or_tool, expected, actual, status, duration_ms, ts`). It then fails on any `fail` row or coverage < 100% (every manifest route, tool and resource must have at least one row). Catalog and schema are validated against `[A-Za-z0-9_]+` before they go into SQL.
* **New** `resources/jobs/api_contract_tests.job.yml`: resource key `api_contract_tests`, name `${var.app_display_name}-api-contract-tests` (same pattern as `deploy_verification`; dev = `[dev matthew_giglia] dev-semantic-ground-truth-api-contract-tests`, as the plan requires). Job parameters `app_name, secret_scope, client_id_key, client_secret_key, catalog, schema`, plus task `base_parameters.run_id: {{job.run_id}}`. Serverless (no cluster spec), no schedule. `databricks.yml` already includes `resources/*/*.yml`, so it was not changed.

## Decisions

* The plan's name `${bundle.target}-semantic-ground-truth-api-contract-tests` resolves to the same dev name as `${var.app_display_name}-…`. I used the variable so the job follows `deploy_verification` on every target.
* `knownDefects` in the manifest are `KNOWN_DEFECTS` keys (not messages), to keep the file small and stable.
* Known server defects are not hidden live. The bare-array `structuredContent` tools (`review_add_synonym`, `review_add_example`, `campaign_list`, `metric_view_list`) will record `fail` rows until the server is fixed. Session 40 converges the job to 100%.

## Checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` in `/tmp/gt-35` | pass |
| `vitest run tests/contract` | 4 files, 312 passed, 7 expected fail (`it.fails` known defects) |
| `vitest run` (whole app) | 36 files, 911 passed, 7 expected fail |
| Manifest staleness (generator output vs committed `manifest.json`) | identical (`diff`) and the vitest staleness test passes |
| `tsc -b tsconfig.server.json` | exit 0 |
| `tsc` over `tests/contract/**` (temp tsconfig in `/tmp`, not committed) | exit 0 |
| `bundle validate --strict --target dev` (ground-truth-app) | Validation OK |
| Notebook: every code cell parses; all manifest `$ref`s resolve with jsonschema; closed objects reject extra keys | pass |
| Notebook static coverage: every manifest route and tool is referenced, no unknown keys | pass |
| Live job run | not run (edit session, `allow_execute` false); session 40 runs and converges it |

## Requests for other sessions

* `server/mcp/tools` (session 34 owner): `structuredContent` is a bare array for `review_add_synonym`, `review_add_example`, `campaign_list`, `metric_view_list`. MCP `CallToolResult` requires an object, so clients get JSON-RPC -32602. Wrap it as `{ items: [...] }`, update `MCP_TOOL_CONTRACTS` output, and remove `knownDefect` from `toolCases.ts`.
* `server/mcp/tools/metricView.ts`: `requireObo` throws a plain Error with code FORBIDDEN, which `toToolError` maps to INTERNAL. Throw `forbidden()` from `server/lib/errors`.

## Files

* `ground-truth-app/tests/contract/{fakeStore,fixtures,harness,routeCases,toolCases}.ts` (attempt 1)
* `ground-truth-app/tests/contract/{routes,mcp,invariants}.contract.test.ts` (attempt 1; mcp + invariants edited in attempt 2)
* `ground-truth-app/tests/contract/routes.contract.test.ts` (comment updated in attempt 2)
* `ground-truth-app/tests/contract/{coverage.contract.test,manifest,generate-manifest}.ts`, `manifest.json` (new)
* `ground-truth-app/src/notebooks/api_contract_tests.ipynb` (new)
* `ground-truth-app/resources/jobs/api_contract_tests.job.yml` (new)
