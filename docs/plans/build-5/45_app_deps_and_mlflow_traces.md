# Session 45: App dependencies + MLflow agent traces

**Build 5 · wave `5-0` · edit (parallel)** · the only build-5 session that changes `package.json` / `pnpm-lock.yaml`.

## Steps

1. Toolchain per `docs/runbooks/node_toolchain_genie_code.md` (Node 22.16.0 + pnpm 11.0.8 in `/tmp/node2216`).
2. **`@mlflow/core`** (follow-up 12, gap G-mlflow): add the current release. Create `server/lib/tracing/mlflowTraces.ts`: initialise once at startup with the app experiment (`app_agents_experiment` from the infra bundle; experiment id from the existing app env/config, otherwise no-op) and wrap the agent chat handler (`server/agents/**` entry used by `/api/agents/*`) in a trace span: inputs (prompt length, agent name, user id hash), outputs (token counts if present, latency, error). Tracing failures log a warning and never fail the request. If `@mlflow/core` cannot authenticate with the app SPN in the Apps runtime, keep the code behind `GT_MLFLOW_TRACES=false` default and record a `request`.
3. **`lucide-react` stays installed** in this build (removed per file by the UI sessions; session 60 removes the dependency only if no import remains, by request to the owner otherwise).
4. **Bundle-size check script:** add `scripts/check-bundle-size.mjs` (reads `client/dist/assets/*.js`, gzips the entry chunk, fails above 350 kB; prints all chunk sizes) and a `check:bundle` package script. Not wired into `prebuild` (session 60 decides after measuring).
5. `pnpm install` to update the lockfile; then `pnpm install --frozen-lockfile` in a clean `/tmp/gt-45/` copy, vitest + both `tsc -b`.
6. Unit test for `mlflowTraces.ts` (mocked client: span recorded; client throws → request still succeeds).

## Acceptance

Lockfile consistent (`--frozen-lockfile` passes); tests pass; no other `package.json` change.

## Owned paths

* `ground-truth-app/package.json`, `ground-truth-app/pnpm-lock.yaml`
* `ground-truth-app/server/lib/tracing/**`
* `ground-truth-app/server/agents/**`
* `ground-truth-app/scripts/check-bundle-size.mjs`

## Dependencies

None.
