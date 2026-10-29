# Build 5 owner session: AppKit 0.89.0 unblocks wave 5-7, waves 5-7..5-10 pass

* **Date:** 2026-10-28 to 2026-10-29 (UTC)
* **Build run:** `229891579528310` (job `884230801831394`) · branch `mg-genie-build-5`
* **Mode:** owner, interactive (Genie Code)
* **Outcome:** waves 5-0..5-10 pass. Wave 5-11 fails by design on `M5` (manual checks not recorded), so `build_verdict` is `FAILED` until the owner fills `docs/sessions/build-5_manual_checks.md` and starts a new run with `only = w5-11_*`.

## Timeline

| Step | Result |
| --- | --- |
| Babysit task paused | `Babysit sGt build 5 run` (`06c6bc1b8eac4c54a6802d4066168858`) paused during owner work, resumed for waves 5-8..5-10, paused again at the end |
| Wave 5-7 (session 60) | `blocked`: one error line per deployment, `[appkit:agents] MLflow UC trace-location auto-detect failed ... Cannot find module '@mlflow/core/dist/core/destination'` |
| AppKit upgrade (owner, npm download approved) | `@databricks/appkit` + `@databricks/appkit-ui` 0.84.0 -> 0.89.0 |
| Deploy | `bundle run app --target dev` -> `01f1d3029bf11f6ba728ead47406d68a` `SUCCEEDED` |
| Probes / verification / soak | 12/12 probes (M2M SPN); `deploy_verification` run `263699809540741` SUCCESS; 10 min soak: 883 log rows, 0 error lines, 19 traces, 0 errors |
| `60.json` | owner attempt 3 `stable`, status `pass`; integrator `check_files_changed` 0 problems |
| Repair `820282825386912` from `w5-7_integrate` | waves 5-7, 5-8 (61), 5-9 (62), 5-10 (63) pass; 5-11 (64) blocked on `M5` |

## Problems and root causes

### 1. AppKit 0.84.0 MLflow tracing off in production

* `@databricks/appkit` 0.84.0 to 0.88.1 import `@mlflow/core/dist/core/destination`, `dist/exporters/uc_table` and `dist/exporters/mlflow` **without `.js`**. `@mlflow/core` 0.4.0 has no `exports` map, so Node's ESM resolver rejects them. AppKit then disables MLflow agent tracing and logs `Cannot find module`, which the wave gate counts as an error.
* vitest hides it because Vite resolves imports without an extension.
* Fix: 0.89.0 adds `.js` to all three. Reproduced both ways in `/tmp`: the extensionless import fails with `ERR_MODULE_NOT_FOUND`, the `.js` import loads.

### 2. AppKit 0.89.0 typegen is fatal offline

* `prebuild` runs `appkit generate-types --wait`. In 0.89.0 blocking mode, if the warehouse cannot describe a query **and** `shared/appkit-types/analytics.d.ts` is not committed, it throws `TypegenFatalError` and the build fails (`dist/type-generator/index.js`). With the file committed it only warns.
* Fix: generated `analytics.d.ts` (`hello_world`, `mocked_sales`) and `metric-views.d.ts` (empty `MetricRegistry`) against warehouse `0ea84986a23a47c3` and committed them. A `pnpm run build` with no credentials then passes.

### 3. Owner-caused outage (about 6 minutes)

* I first deployed with `w.apps.deploy(source_code_path=...)`. With `app.yaml` a comment stub and no bundle config sent, deployment `01f1d301c7d1162ea8deff35893ccefe` failed (`No command to run`) and became the active deployment, so the app went `UNAVAILABLE`.
* A retry that copied `command` / `env_vars` from the last good deployment was rejected: `GET` on a deployment redacts env values.
* Recovered with `bundle run app --target dev`, which sends `resources/app.app.yml` `config`. App `PROJECT_MEMORY.md` gotcha 13 already warned about this.

## Changes

| File | Change |
| --- | --- |
| `ground-truth-app/package.json` | `@databricks/appkit`, `@databricks/appkit-ui` 0.84.0 -> 0.89.0 |
| `ground-truth-app/pnpm-lock.yaml` | 0.89.0 resolution; new split `@databricks/sdk-*` packages (Node >= 22), `@databricks/lakebase` 0.7.0, `@js-temporal/polyfill`, `jsbi`, `json-bigint`; `qs` 6.16.1 under `body-parser`. `zod` stays 4.3.6 |
| `ground-truth-app/shared/appkit-types/analytics.d.ts` | new, generated query types (committed typegen artifact) |
| `ground-truth-app/shared/appkit-types/metric-views.d.ts` | new, generated metric types |
| `.build-status/229891579528310/60.json` | owner attempt 3 `stable`, `pass`, `blocking: null` |
| `docs/sessions/2026-10-28_w5-7-60-app-converge-deploy.md` | attempt 3 + outage + gotchas |
| `PROJECT_MEMORY.md`, `ground-truth-app/PROJECT_MEMORY.md` | AppKit 0.89.0, typegen artifact rule, status rows |

All four `ground-truth-app` files landed in integrator commit `952669a` (`wave(5-7): 60`).

## Verification

* Lockfile edits were applied as patches and then checked on a fresh `/tmp` copy: `pnpm install --frozen-lockfile` OK, and `pnpm install --lockfile-only` leaves the lockfile byte-identical.
* vitest 60 files, 1880 pass / 2 skipped; `tsc -b` server and client exit 0; build OK; entry chunk 235.18 kB gzip (budget 350 kB).
* `bundle validate --strict --target dev` (ground-truth-app) OK.
* After the repair: wave 5-8 `api_contract_tests` run `281019161761628` 153 pass / 0 fail / 100% coverage on `01f1d3029bf1`; wave 5-9 `ui_visual_checks` 44/44 on `01f1d3145f05`.

## Decisions

* The AppKit upgrade was done by the owner. Build-5 conventions §4 reserve package changes for session 45, which had already run.
* Committing the typegen artifacts is preferred over relying on the app SPN reaching the warehouse during the Apps build.

## Open items (owner)

1. Fill all 47 `result` cells and the live deployment id in `docs/sessions/build-5_manual_checks.md`, push, then start a **new** build run with `only = w5-11_*` (resume the babysit task first if wanted).
2. Run `./deploy.sh --target dev --app` once from a terminal to refresh the stale bundle-state `source_code_path` (`semanticGroundTruth-deploy`, follow-up 10).
3. After a chat turn, confirm AGENT/TOOL traces in experiment `1698842789305538` (tracing now loads; first real agent trace not yet observed).
4. Regenerate `shared/appkit-types/*.d.ts` with `appkit generate-types --wait` whenever `config/queries/*.sql` changes.
