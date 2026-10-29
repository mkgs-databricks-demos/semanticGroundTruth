# Session 45 (build 5, wave 5-0): app dependencies, MLflow agent traces, bundle-size script

* **Run:** build job `884230801831394`, run `229891579528310`, branch `mg-genie-build-5`, mode `edit`.
* **Plan:** [docs/plans/build-5/45_app_deps_and_mlflow_traces.md](../plans/build-5/45_app_deps_and_mlflow_traces.md)
* **Status:** pass

## What I found

* AppKit 0.84.0 already has MLflow agent tracing built in (`dist/plugins/agents/mlflow.js`). It needs the optional peer `@mlflow/core` (exact pin `0.4.0`) and `MLFLOW_EXPERIMENT_ID`, which `app.yaml` already binds from the `agents-mlflow-experiment` resource (infra experiment `app_agents_experiment`, `1698842789305538` in dev). Without the package it logs `MLflow agent tracing requires the optional @mlflow/core package` (the runtime warning noted in the app PROJECT_MEMORY).
* With the package, AppKit records each chat turn as an AGENT span and each tool call as a TOOL span. It registers the MLflow span processor on its own single OTel provider. So the app must not call `mlflow.init()` or start a second tracer, or the two providers race.
* Auth: `@mlflow/core` delegates `databricks` tracking URIs to the Databricks SDK, which supports OAuth M2M (`DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET`, injected by Apps). The app SPN should therefore authenticate, so the `GT_MLFLOW_TRACES=false` default fallback in the plan was not needed. Tracing is on whenever an experiment is bound. Not proven at runtime yet (edit session, no deploy): session 60 confirms it.

## Changes

* `ground-truth-app/package.json`: `@mlflow/core` `0.4.0` (exact, matches AppKit's peer pin) and the script `check:bundle`. No other change. `lucide-react` stays.
* `ground-truth-app/pnpm-lock.yaml`: regenerated with `pnpm install --lockfile-only` in the repo (no `node_modules` in the Git folder). It is byte-identical to the lockfile from `pnpm add @mlflow/core@0.4.0 --save-exact` in `/tmp/gt-45`. 76 packages were added (the `@mlflow/core` tree: `@opentelemetry/sdk-node` 0.205, `@databricks/sdk-experimental` 0.15.0, `@kubernetes/client-node`, ...), and AppKit's peer resolution now includes `@mlflow/core@0.4.0`.
* `ground-truth-app/server/lib/tracing/mlflowTraces.ts` (new): app-level trace enrichment on top of AppKit's spans.
  * `initMlflowTraces()` loads `@mlflow/core` once (dynamic import) and never rejects.
  * `traceAgentTool(meta, fn)` runs the tool, then sets attributes on the active span (AppKit's TOOL span): `gt.agent`, `gt.tool`, `gt.input_chars`, `gt.latency_ms`, `gt.output_chars`, `gt.output_items`, `gt.error`, `gt.error_message`. It also sets trace tags `gt.agent`, `gt.app`, and `gt.user_hash` (plus trace `user`), where the user hash is sha256/16 hex of `getCurrentActorId()`. Raw user ids never go on the trace.
  * `withToolTracing(agent, tools)` wraps a keyed tool record.
  * Every tracing call is in try/catch. A failure logs one warning, and the tool's own result or error passes through unchanged.
  * `GT_MLFLOW_TRACES=false` (or `0`/`off`) turns the enrichment off. AppKit's own spans follow `MLFLOW_EXPERIMENT_ID` only.
* `ground-truth-app/server/lib/tracing/mlflowTraces.test.ts` (new, 14 tests):
  * span attributes and trace tags are recorded
  * the raw user id is never traced
  * the client throwing (`getCurrentActiveSpan`, `setAttributes`, `updateCurrentTrace`) still returns the result, with only one warning
  * `@mlflow/core` failing to load still runs the tool
  * a tool error is rethrown unchanged and recorded
  * `GT_MLFLOW_TRACES=false` never loads the module
  * no active span means no enrichment
  * concurrent init loads once
  * `withToolTracing` keeps tool metadata
  * a tripwire checks that the real `@mlflow/core` still exports `getCurrentActiveSpan` / `updateCurrentTrace`
* `ground-truth-app/server/agents/review-worker/agent.ts`: the tool record is wrapped in `withToolTracing('review-worker', {...})`, and `void initMlflowTraces()` runs at module load (startup, when the agents plugin loads the agent). The tool bodies are unchanged. `review-assistant/agent.md` is markdown (no code) and is traced by AppKit's AGENT span.
* `ground-truth-app/scripts/check-bundle-size.mjs` (new):
  * reads `client/dist/assets/*.js` and prints the raw and gzip size of every chunk
  * finds the entry chunk from `dist/index.html` (fallback: the largest `index-*.js`)
  * exits 1 above 350 kB gzip (`--budget-kb` / `BUNDLE_BUDGET_KB` override), and 2 when there is no build output
  * not wired into `prebuild` (session 60 decides)

## Decisions

* **Enrich, do not duplicate.** The plan asked to "wrap the agent chat handler in a trace span". The `/api/agents/*` handler is AppKit's, and it already opens the AGENT root span, with the full messages as inputs and the reply as outputs. A second span or `init()` would race AppKit's provider. So the app adds attributes to AppKit's spans from the one entry it owns (`server/agents/review-worker`).
* **Token counts:** these are not visible at the tool level. AppKit's adapter does not expose usage to app code in 0.84.0, so they are not recorded. Latency, error, and input/output sizes are.
* **Privacy:** AppKit's own AGENT span records the full chat messages as inputs. That is AppKit behavior and outside this session; flagged in requests.
* **gzip level:** default zlib (matches Vite's report within about 1%: 249.46 vs 251.57 kB on the current entry chunk).

## Checks

The shared working tree has uncommitted work from other wave 5-0 sessions. Session 44 is mid-edit on `shared/contracts` (`slackShareEnabled`, `htmlUrl`), and session 43 has an untracked `client/src/test/keyboard.ts`. Those break `tsc` and 2 tests in a copy of the live tree. So the authoritative check is HEAD (`08766ac`) plus only this session's 6 files, in `/tmp/gt-45h`:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass (lockfile consistent) |
| `pnpm exec vitest run` | pass: 38 files, 946 tests |
| `vitest run server/lib/tracing` | pass: 14 tests |
| `tsc -b tsconfig.server.json` | exit 0 |
| `tsc -b tsconfig.client.json` | exit 0 |
| `eslint server/lib/tracing/mlflowTraces.ts server/agents` | exit 0 |
| `vite build` + `pnpm run check:bundle` | OK: entry `index-*.js` 249.46 kB gzip (budget 350), exit 0; `--budget-kb 10` exits 1; no dist exits 2 |
| `git diff package.json` | only `check:bundle` and `@mlflow/core` lines |

Not run: a deploy (edit session). eslint on the test file reports `require-await` / `unbound-method`, the same patterns as the existing server tests (`eslint server` has 71 errors at baseline). eslint is not a gate.

## Requests

* Session 60 (app converge deploy): after deploy, confirm that the app logs `MLflow agent tracing enabled (experiment 1698842789305538)` and `MLflow trace enrichment on`, and that an agent chat creates a trace in experiment `1698842789305538` with `gt.*` attributes on its TOOL spans. If the app SPN cannot write traces (403 on the experiment), the experiment resource needs `CAN_EDIT` / `CAN_MANAGE` for the SPN, or set `GT_MLFLOW_TRACES=false` and unset the experiment binding.
* Session 63 (docs): app PROJECT_MEMORY. `@mlflow/core` 0.4.0 is installed (pinned to AppKit's peer; bump together with AppKit). `GT_MLFLOW_TRACES` flag. `pnpm run check:bundle`.
* Owner (optional): AppKit's AGENT span records the full chat messages. If that is not wanted, it needs an AppKit option or upstream change (not app code).
