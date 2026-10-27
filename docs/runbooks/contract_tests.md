# Contract tests (REST routes + MCP tools)

How to run the app's contract tests, read the live results, and add a route or tool. Built in build 4 (sessions 35 and 40, gap G17).

## Two layers

| Layer | Where | What it checks | When it runs |
| --- | --- | --- | --- |
| In-process | `ground-truth-app/tests/contract/**` (vitest) | Every `ROUTE_CONTRACTS` route and every `MCP_TOOL_CONTRACTS` tool against in-process fakes (`fakeStore.ts`, `harness.ts`): success status, response schema, each listed error status (400/401/403/404/409/500/502), MCP `structuredContent`, empty-queue text, the review card resource. `coverage.contract.test.ts` fails when a contract has no case, a case has no contract, the tool count is not 13, or `manifest.json` is stale. | Every `pnpm test`, and every Apps build (`prebuild` runs `vitest run`, so a failing test fails the deploy) |
| Live | Job `api_contract_tests` (`ground-truth-app/resources/jobs/api_contract_tests.job.yml`, notebook `ground-truth-app/src/notebooks/api_contract_tests.ipynb`) | Calls the deployed app as the M2M SPN for every route and tool in `tests/contract/manifest.json`: status, JSON Schema (draft 2020-12, closed objects), exact seeded values, `ErrorResponse` codes, live invariants (skip is not a vote, cooldown, settings round-trip), MCP `initialize` / `tools/list` / `resources/read` / `tools/call` | On demand after a deploy (no schedule) |

Dev job: `[dev matthew_giglia] dev-semantic-ground-truth-api-contract-tests` (job id `443124502254957`). Run of record for build 4: `687515436484443` = 147 pass, 0 fail, 176 `skipped_live`, coverage 100%.

## Run the in-process suite

The Genie Code serverless image has no working npm, so use the toolchain from [`node_toolchain_genie_code.md`](node_toolchain_genie_code.md) (Node 22.16.0, pnpm 11.0.8) in a `/tmp` copy of `ground-truth-app`:

```bash
pnpm install --frozen-lockfile
pnpm test                        # vitest run (node + client projects)
pnpm exec vitest run tests/contract   # contract suite only
pnpm run typecheck               # tsc -b for server and client
```

`vitest.config.ts` sets `silent: 'passed-only'`: passing error-path tests log `"level":"error"` on purpose, and the build-waves gate would count those lines in the Apps BUILD logs. Failing tests still print their output.

## Run the live job

Deploy the app first (`./deploy.sh --target dev --app`, or `bundle run app --target dev` from `ground-truth-app/`), then:

```bash
cd ground-truth-app
databricks bundle run api_contract_tests --target dev
```

Job parameters (defaults from bundle variables): `app_name`, `secret_scope`, `client_id_key`, `client_secret_key`, `catalog`, `schema`. The task passes `run_id = {{job.run_id}}`. The M2M SPN needs `CAN_USE` on the app and `READ` on the scope; a redirect to sign-in is reported as missing `CAN_USE`.

The job seeds run-scoped data through the API (assets `contract_test_<run_id>_m1..m3`, domain `ContractTest`, campaign `contract-test-<run_id>`), archives both campaigns and restores settings at the end. Assets, votes, skips, synonyms and examples stay, because there is no delete API. It fails on any `fail` row or coverage below 100%.

The task sets `max_retries: 0` (since 2026-10-27). A serverless retry of a failed run reuses the same `run_id` and seeds on top of the first attempt, which doubles fail rows (seen in run `3631302379538`). Re-run the job instead of retrying; for runs before 2026-10-27, read the first attempt's rows.

## Read `api_contract_results`

Table: `<catalog>.<schema>.api_contract_results` (dev: `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results`). One row per check: `run_id, check_id, kind, method, path_or_tool, expected, actual, status, duration_ms, ts`. `status` is `pass`, `fail` or `skipped_live`.

```sql
-- Summary of the latest run
SELECT status, count(*) AS checks
FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results
WHERE run_id = (SELECT max_by(run_id, ts) FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results)
GROUP BY status;

-- Failures with expected vs actual
SELECT check_id, method, path_or_tool, expected, actual
FROM hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.api_contract_results
WHERE run_id = '<run_id>' AND status = 'fail'
ORDER BY check_id;
```

`skipped_live` rows carry the reason in `actual`. Expected reasons: 401 (Apps proxy answers before the app), 403 (the SPN is admin), 500/502 failure injection, unsafe 409s, happy paths that create undeletable resources (`POST /api/sources`, `/api/assets/import`, feedback branches, freshness-check), the two-identity conflict resolve, and non-executable seeded SQL. Each is covered by the in-process suite.

## Add a route or tool

1. Add the contract to `ground-truth-app/shared/contracts/schemas.ts`: a `ROUTE_CONTRACTS` entry (method, path, role, success status, error statuses, request/query/params/response zod schemas) or an `MCP_TOOL_CONTRACTS` entry (input, output; `structuredContent` must be an object, e.g. `{ items: [...] }`, never a bare array).
2. Implement it. Routes use `validate(spec)` from `server/lib/validate.ts`; tools use `registerContractTool` from `server/mcp/tools/define.ts`.
3. Add cases to `tests/contract/routeCases.ts` or `toolCases.ts`: a happy case and one case (or a generator, or an `na` reason) per listed error status.
4. Regenerate the committed generator outputs and check they are byte-identical:
   ```bash
   pnpm exec tsx tests/contract/generate-manifest.ts > tests/contract/manifest.json
   pnpm exec tsx shared/contracts/generate-schemas.ts > shared/contracts/generated/contracts.schema.json
   ```
5. If the tool count changes, update the expected count in `coverage.contract.test.ts` (today 13).
6. Run `pnpm test`, deploy, run `api_contract_tests`, and confirm 0 `fail` and coverage 100%. The live notebook needs a check for the new route only when the generic manifest-driven checks cannot seed it.

A known defect can be recorded with `KNOWN_DEFECTS` / `it.fails` in `toolCases.ts` (empty since session 36). Remove the entry when the defect is fixed.
