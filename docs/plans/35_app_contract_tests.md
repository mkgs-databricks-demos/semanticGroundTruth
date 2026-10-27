# Session 35: Contract tests for every REST route and MCP tool (in-process + live job)

**Build 4 · wave `4-3` · edit · app**

## Scope

The owner wants each API and MCP tool tested to return exactly what is expected. Build two layers from one source of truth (plan 25 `ROUTE_CONTRACTS`, `MCP_TOOL_CONTRACTS`, `generated/contracts.schema.json`):

1. **In-process contract tests** (vitest, every Apps build): each route and tool against a seeded in-memory fake of the data layer, asserting status, response schema and exact values.
2. **Live contract job** `api_contract_tests` (app bundle job): calls the deployed app as the M2M SPN, seeds its own data, asserts exact values, cleans up, writes results to a Delta table, and fails on any miss. Session 40 converges it to 100%.

## Context

* Routes: 49 (41 existing incl. `/health`, `/api/config`; 8 from session 33). MCP: 13 tools + `ui://ground-truth/review-card` (session 34), stateless StreamableHTTP at `POST /mcp`.
* Live auth pattern: `ground-truth-app/src/notebooks/deploy_verification.ipynb` (M2M SPN `semantic-ground-truth-m2m-dev`, scope `semantic_ground_truth_credentials`, keys `m2m_client_id_dev` / `m2m_client_secret_dev`, `WorkspaceClient(host, client_id, client_secret).config.authenticate()` headers; plain PAT gets 302/403 from the Apps proxy). The SPN is an app `admin`.
* Job pattern: `ground-truth-app/resources/jobs/deploy_verification.job.yml` (serverless, notebook `.ipynb`, parameters).
* App URL: `https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com`. Results table: `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results`.

## Tasks

1. **In-process** (`ground-truth-app/tests/contract/`): a fake repository layer seeded with fixed fixtures (2 campaigns, 5 assets incl. one with synonyms, 3 users with reviewer/steward/admin roles, votes incl. conflicting edits, 1 feedback batch). For every `ROUTE_CONTRACTS` entry: happy path (status + `response.parse` + exact field values from fixtures), each listed error status (400 invalid body, 403 wrong role, 404 unknown id), and a coverage test that fails if any contract entry has no test. Same for `MCP_TOOL_CONTRACTS` through an in-memory MCP client (`tools/call`, `resources/read`). Include the behavioural invariants: skip leaves confidence score and vote count unchanged and increments `skippedCount` by 1; vote with `skip` returns 400; settings round-trip; cooldown hides a skipped asset.
2. **Route manifest:** export `ROUTE_CONTRACTS` + `MCP_TOOL_CONTRACTS` metadata (method, path, role, expected statuses, schema `$ref`) to `tests/contract/manifest.json` from the same generator as plan 25 (commit output; staleness test).
3. **Live job notebook** `src/notebooks/api_contract_tests.ipynb` (first cell: Install latest Databricks SDK + `jsonschema`; `dbutils.library.restartPython()`): load `manifest.json` and `contracts.schema.json` from the bundle files; create a run-scoped campaign `contract-test-<run_id>` and assets/votes through the API; for each route and tool assert status, JSON Schema validity and exact seeded values; negative cases that the M2M identity can exercise (400, 404; 403 is covered in-process because the SPN is admin, record it as `skipped_live` with reason); MCP `initialize`, `tools/list` (13 tools, `_meta.ui.resourceUri` on the design's tools), `resources/read` (MIME type, non-empty HTML), `tools/call` per tool; clean up (archive the campaign, delete seeded data via admin APIs where they exist). Write one row per check to `api_contract_results` (`run_id`, `check_id`, `kind` route|tool|resource|invariant, `method`, `path_or_tool`, `expected`, `actual`, `status` pass|fail|skipped_live, `duration_ms`, `ts`). Fail the task if any `fail`, or if any manifest entry has no row (coverage < 100%).
4. **Job** `resources/jobs/api_contract_tests.job.yml`: resource key `api_contract_tests`, name `${bundle.target}-semantic-ground-truth-api-contract-tests` matching the existing naming (dev name becomes `[dev matthew_giglia] dev-semantic-ground-truth-api-contract-tests`), parameters `app_name`, `secret_scope`, `client_id_key`, `client_secret_key`, `catalog`, `schema`; serverless environment; no schedule. Include it from `databricks.yml` if the bundle does not glob `resources/jobs/*.yml`.
5. Run vitest in `/tmp/gt-35/`; `bundle validate --strict --target dev` for the app bundle.

## Acceptance Criteria

- [ ] In-process coverage test proves every route and tool has a contract test; `vitest run` passes.
- [ ] Live notebook covers every manifest entry and writes one row per check; coverage check is in the notebook.
- [ ] Job validates; notebook path extension matches the file on disk.

## Owned Paths

- `ground-truth-app/tests/contract/**`
- `ground-truth-app/src/notebooks/api_contract_tests.ipynb`
- `ground-truth-app/resources/jobs/api_contract_tests.job.yml`
- `ground-truth-app/databricks.yml`

## Dependencies

- 25, 33, 34
