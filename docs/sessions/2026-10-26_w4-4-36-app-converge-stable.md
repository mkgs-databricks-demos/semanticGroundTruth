# Session 36: Converge app (build 4, wave 4-4), second run: STABLE

* **Date:** 2026-10-26
* **Job run:** `655172288447819`, task `w4-4_session` (the first run, `110489694161084`, ended `blocked`: see `2026-10-26_w4-4-36-app-converge.md`)
* **Branch:** `mg-genie-build-4` (HEAD `1155545`, tree clean at start)
* **Mode:** converge, runtime target `app` (`dev-semantic-ground-truth`)
* **Status:** pass. 1 attempt, classified `stable`.

## Summary

The owner's fixes (`d634f99`, `dca8dc0`) cleared both earlier blockers: OTel rows flow again, and agent skills load from the UC volume. This run did plan step 0 (session 35's two requests), fixed one new gate blocker (test log lines in the BUILD logs), then deployed. Attempt 1 was stable.

## Step 0: session 35 requests

* **MCP `structuredContent` must be an object.** `review_add_synonym`, `review_add_example`, `campaign_list` and `metric_view_list` now return `{ items: [...] }` (`server/mcp/tools/review.ts`, `campaign.ts`, `metricView.ts`). Their `MCP_TOOL_CONTRACTS` output in `shared/contracts/schemas.ts` is now `z.object({ items: z.array(...) })`. The text content did not change. The review card view (`server/mcp/views/app/view.ts`) already accepted the `{ items }` envelope (its test covers both shapes), so it was not changed.
* **`requireObo`** (`server/mcp/tools/metricView.ts`) now throws `forbidden()` from `server/lib/errors`, so `toToolError` maps it to `Error [FORBIDDEN]: ...` and no longer to `INTERNAL`.
* **Tests:** `tests/contract/toolCases.ts` has no `knownDefect` left (there were 7). `KNOWN_DEFECTS` is now an empty record, and the `it.fails` mechanism stays for future defects. In `tests/contract/mcp.contract.test.ts`, the raw JSON-RPC `-32602` defect test is replaced by a positive check: the raw `tools/call` result has no error, and `structuredContent` is an object, not an array.
* **Regenerated:** `shared/contracts/generated/contracts.schema.json` (4 `mcp_out_*` defs) and `tests/contract/manifest.json` (`knownDefects` removed). Both are byte-identical to the generator output (`cmp`).

## New blocker found and fixed: test log lines in the BUILD logs

With the owner deployment `01f1d103...`, the gate's log scan would count **57 error lines**, all from the BUILD phase. They were the `stderr` output of passing tests that run in `prebuild` (`vitest run`): error-path tests log `{"level":"error",...}` on purpose. They match `severity_text = ERROR` or the `"level":"error"` pattern. The gate counts BUILD rows too (`wave_gate_check` `check_app_logs`), and `max_errors` is 0.

Fix: `vitest.config.ts` sets `silent: 'passed-only'`. Vitest now prints console output only for failing tests, so a real test failure still shows its logs in the build. Local run: 0 `stderr` blocks, and no gate error pattern in the output. Deployed BUILD logs: 0 error lines. This is listed under `suppressions` (kind `other`) because it changes what the build prints. No error is hidden: the lines came from expected-error tests that pass.

## Attempt 1

| Step | Result |
| --- | --- |
| `/tmp/gt-36` (runbook toolchain, Node 22.16.0, pnpm 11.0.8), tree identical to the repo (`diff -rq`) | `pnpm install --frozen-lockfile` pass |
| `vitest run` | 36 files, **927 passed, 0 expected fail** (was 911 + 7 `it.fails`) |
| `tsc -b tsconfig.server.json` / `tsconfig.client.json` | exit 0 / exit 0 |
| `bundle validate --strict --target dev` | pass |
| `bundle deploy --target dev` | known limit: `apps update` 400 `Invalid delegation claim present in Ctx`. `bundle plan -o json` shows that the only remaining change is `config.env[0].value` / `config.env[1].value`, with old == new (the API returns env entries without values). Per the plan, I continued. |
| `bundle run app --target dev` | deployment **`01f1d13ea26115a4ae46210fb7055d1c`** SUCCEEDED (created 13:10:36Z). App RUNNING, compute ACTIVE, no pending deployment |
| BUILD prebuild tests (from logs) | `Test Files 36 passed`, `Tests 927 passed` |
| Log scan (gate logic, manifest `error_patterns` / `ignore_patterns`) | 542 rows, **0 error lines**. `listening on port 8000` present |
| Probes (genie-build-waves `app_probes`, M2M SPN) | **8/8 pass**: `/health`, `/api/me` (admin), `/api/campaigns`, `/api/config`, `/api/me/settings`, `/api/review/stats/me`, `/fonts/dm-sans-regular.ttf`, MCP initialize |
| Live MCP `tools/call campaign_list` | `structuredContent` = `{ items: [5 campaigns] }`, no JSON-RPC error |
| Traces (`semantic_ground_truth_otel_spans`) | 26 spans after the deploy, 0 `STATUS_CODE_ERROR` |
| Self-soak (3 min) | same deployment, RUNNING / ACTIVE. 565 rows, 0 errors, 8/8 probes again, 38 spans, 0 error spans |

Classification: **stable**.

**Migration 009:** this deployment does not log it (it was already applied, so nothing to do). It is confirmed in the Lakehouse Sync table `hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.lb__migrations_history`: `009_skips_settings_triage`, applied 2026-10-26 03:55:18 UTC, during the first run's deploy while OTel was down.

## Notes

* Runtime log line: `MLflow agent tracing requires the optional @mlflow/core package`. It is INFO, not an error, and not in this scope. If MLflow agent traces are wanted, the owner of `package.json` should add `@mlflow/core`.
* `bundle run deploy_verification` was not run. It is not a runtime target of this session (only `app` is), so the wave gate checks `app_deploy_verification`.
* The view comment in `server/mcp/views/app/view.ts` ("returns a bare array today") is now out of date. I left it as is: changing it means regenerating `reviewCardApp.generated.ts`, and the code already handles both shapes.

## Manual checks for the owner (plan step 5, not done)

* In Genie One / Genie Code with the MCP Apps preview, call `review_get_next` and confirm the card renders and Approve/Skip work. Add a synonym from the card: it now gets `{ items }`.
* Review with the keyboard only in the web UI. Check light and dark mode.

## Requests

* genie-build-waves (tooling, carried over from the first run): document that `app_probes.probe_client` returns `(client, label)` and `run_app_probes` returns `(results, problems)`.

## Files modified

* `ground-truth-app/server/mcp/tools/campaign.ts`, `metricView.ts`, `review.ts`
* `ground-truth-app/shared/contracts/schemas.ts`, `ground-truth-app/shared/contracts/generated/contracts.schema.json`
* `ground-truth-app/tests/contract/toolCases.ts`, `mcp.contract.test.ts`, `manifest.json`
* `ground-truth-app/vitest.config.ts`

Assets: app deployment `01f1d13ea26115a4ae46210fb7055d1c` (`dev-semantic-ground-truth`).
