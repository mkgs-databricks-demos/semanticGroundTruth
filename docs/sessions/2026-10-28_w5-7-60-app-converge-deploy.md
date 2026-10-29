# Session 60: Converge app: deploy build 5 (wave 5-7)

* **Date:** 2026-10-28
* **Build run:** `229891579528310` · branch `mg-genie-build-5` · mode `converge` · target `app` (`dev-semantic-ground-truth`)
* **Status:** `blocked`. Every check passes except one runtime log line that comes from AppKit 0.84.0. Fixing it needs a dependency upgrade, and only session 45 may make that change (build-5 conventions §4).

## Steps and results

| Step | Result |
| --- | --- |
| 1. `/tmp/gt-60`: frozen install, vitest, both `tsc -b`, build, bundle budget | Baseline: 60 files, 1854 pass / 2 skipped; both tsc exit 0; `build:server` + `build:client` OK; entry chunk `index-vwIvCviP.js` **235.18 kB gzip** (budget 350 kB) |
| 2. Strict-marker coverage | 13 files under `components/**` had no `// @a11y-strict` on line 1 (no pages). I added the marker to all 13. In `/tmp` they pass d1 (no lucide) and d2 (test id naming); none has a `data-testid` or a lucide import. Test (e) in `a11y-static.test.ts` is now a hard check: the missing list must be empty |
| 3. `lucide-react` | No import was left in `client/src` (only comments), so I ran `pnpm remove lucide-react` in `/tmp` and applied the same `package.json` / `pnpm-lock.yaml` diff to the repo. The files are byte-identical to the `/tmp` result. `lucide-react@0.554.0` stays in the tree as a dependency of `@databricks/appkit-ui` |
| Step 1 re-run (fresh copy `/tmp/gt-60b`) | frozen install OK; **1880 pass** / 2 skipped (26 new strict cases); both tsc exit 0; build OK; entry 235.18 kB gzip |
| 4. Deploy | `bundle deploy --target dev` failed: `Invalid delegation claim present in Ctx` on `POST /api/2.0/apps/.../update` (follow-up 10, see below). `bundle run app --target dev` worked: attempt 1 `01f1d2ef7e041c00a3c13bab4f40a7c0`, attempt 2 `01f1d2f1428d1094b285b0e724ecfa7a` (created 17:01:47Z), both `SUCCEEDED` |
| 5. Probes (gate module `app_probes.py`, M2M SPN from `semantic_ground_truth_credentials/m2m_client_id_dev`) | **12/12 pass** on both deployments (incl. `/settings`, `/steward/feedback-branches`, `"slackShareEnabled"`, MCP `initialize`) |
| 6. `bundle run deploy_verification --target dev` | run `985961210161524` (job `359858966042356`): **SUCCESS** |
| 7. Soak | 8 min self-soak (17:08-17:15Z), same deployment, `RUNNING` / `ACTIVE`. Spans since the probes: 17 traces (14 SERVER), 0 error traces. `listening on` marker present. **Error lines: 1** (max 0): the AppKit line below |
| `bundle validate --strict --target dev` | Validation OK |

## Attempts

1. `01f1d2ef…` **unhealthy**. 2 error lines by the gate's rules: (a) a BUILD line from the Apps build's `prebuild` vitest run, tagged `ERROR`; (b) the AppKit MLflow line.
   * Root cause (a): the Apps log pipeline tags a line `ERROR` when it contains `error:`. The vitest reporter prints a slow test's title, and `AppLayout.test.tsx` has the title `error: bell stays focusable…`. It was the only `error:` line out of 802 rows, and the only `ERROR` row, in this deployment and in `01f1d2a5…`/`01f1d297…`. Fix: renamed the 4 test titles that start with `error:` to `error state, …` (AppLayout, ConflictsPage, FeedbackBranchesPage, FeedbackQueuePage). Assertions are unchanged; 87/87 pass in those 4 files.
2. `01f1d2f1…` **unhealthy** (1 line). The BUILD false positive is gone. What remains:
   * `[appkit:agents] MLflow UC trace-location auto-detect failed; using classic experiment storage: Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/@mlflow/core/dist/core/destination'`. It matches the manifest pattern `Cannot find module`. The next line is `MLflow agent tracing requires the optional @mlflow/core package`.
   * Root cause: `@databricks/appkit` 0.84.0 `dist/plugins/agents/mlflow.js` deep-imports `@mlflow/core/dist/core/destination`, `dist/exporters/uc_table` and `dist/exporters/mlflow` **without `.js`**. `@mlflow/core` 0.4.0 has no `exports` map, so Node's ESM resolver rejects all three. As a result **AppKit's MLflow agent tracing is off in production** (session 45 depends on it). It works in vitest because Vite resolves imports without an extension. The same line appears in every build-5 deployment since `01f1d2a3…`. Earlier waves had no app runtime gate, so nothing caught it.
   * I checked the published packages: 0.85.0 through 0.88.1 still have imports without an extension. **0.89.0** adds `.js` to all three. Its `zod` pin is 4.3.6 (unchanged) and its `@mlflow/core` peer is 0.4.0.
   * This is outside the changes this session may make: a `package.json` / lockfile change other than removing lucide belongs to session 45 (conventions §4). An in-app ESM resolve hook would only work around a dependency bug. So I stopped `blocked` instead of starting attempt 3.

3. **Owner attempt 3** (2026-10-28, npm download approved): `01f1d3029bf11f6ba728ead47406d68a` **stable**.
   * `@databricks/appkit` + `@databricks/appkit-ui` 0.84.0 -> 0.89.0 (`package.json`, `pnpm-lock.yaml`). New transitive deps: the split `@databricks/sdk-*` packages (Node >= 22), `@databricks/lakebase` 0.7.0. `zod` stays 4.3.6.
   * 0.89.0 makes `appkit generate-types --wait` (in `prebuild`) fatal when the warehouse is unreachable and `shared/appkit-types/analytics.d.ts` is missing. Committed the generated `analytics.d.ts` and `metric-views.d.ts`; an offline `pnpm run build` then passes with a warning.
   * Fresh `/tmp` copy: frozen install OK, lockfile stable under `--lockfile-only`, vitest 1880 pass / 2 skipped, both tsc exit 0, entry 235.18 kB gzip.
   * `bundle run app --target dev`; 12/12 probes; `deploy_verification` run `263699809540741` SUCCESS; 10 min soak (19:24-19:34Z): 883 log rows, 0 error lines, `listening on` present, no `Cannot find module` / `auto-detect failed`; 19 traces, 0 errors.
   * Incident: an earlier owner deploy through the raw SDK (`01f1d301…`) sent no `command`/`env`, so it failed and the app was `UNAVAILABLE` for about 6 minutes until the bundle deployment replaced it. Always deploy with `bundle run app`, which sends the `app.app.yml` config.

## Follow-up 10 (Invalid delegation claim), one investigation

`bundle plan --target dev -o json` plans `update` for `resources.apps.app` because:

* `GET /api/2.0/apps/<name>` returns `config.env` entries with **names only** (values and `value_from` are redacted). So every `config.env[i].value` / `value_from` (12 entries) is planned as a change, even though local and state agree (old == new).
* The local state still has `source_code_path` `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth-deploy/ground-truth-app`. Config and remote use `…/semanticGroundTruth/ground-truth-app`.

Neither is a config difference in `resources/app.app.yml`. The update fails because the Genie Code task's credentials cannot call `apps/update` ("Invalid delegation claim"). The other resources deployed, and `app_post_deploy_setup` run `859333631626613` returned SUCCESS. The fallback `bundle run app` works. A deploy from the owner's own terminal should clear the stale `source_code_path` in state.

## Files changed (all under `ground-truth-app/`, uncommitted)

* `client/src/components/{admin/NotificationPrefsForm,leaderboard/BadgeList,ui/Badge,ui/DiffText,ui/EmptyPanel,ui/Icon,ui/InlineAlert,ui/KeyHint,ui/RadioCardGroup,ui/Sheet,ui/Skeleton,ui/StatusBadge,ui/Toast}.tsx`: line 1 `// @a11y-strict`
* `client/src/theme/a11y-static.test.ts`: (e) is now a hard coverage check
* `package.json`, `pnpm-lock.yaml`: `lucide-react` removed
* `client/src/components/layout/AppLayout.test.tsx`, `client/src/components/steward-triage/{ConflictsPage,FeedbackBranchesPage,FeedbackQueuePage}.test.tsx`: test titles `error:` -> `error state,`

## Requests

1. **Owner / session-45 scope:** upgrade `@databricks/appkit` (and `@databricks/appkit-ui` to match) from 0.84.0 to **0.89.0** in `ground-truth-app/package.json` and regenerate `pnpm-lock.yaml`. Then run frozen install, vitest, both tsc and the build, deploy, and confirm the logs show no `auto-detect failed` / `requires the optional @mlflow/core` line. Spans should show AGENT/TOOL traces in experiment `1698842789305538` after a chat turn. Then set `.build-status/229891579528310/60.json` to pass with a new stable attempt, and repair from `w5-7_integrate`.
2. Owner: run `bundle deploy --target dev` once from a terminal, to refresh the app's state `source_code_path` (follow-up 10).

## Gotchas

* Apps log ingestion tags any line that contains `error:` as `ERROR`, including passing vitest output from `prebuild`. Do not start test titles with `error:`.
* `runDatabricksCli bundle run app` hits the 300 s cap, but the deployment continues. Poll `w.apps.get` instead.
* Never deploy with `w.apps.deploy(source_code_path=...)` alone: with `app.yaml` a comment stub, the deployment has no command and fails, and it takes the running app down.
* AppKit >= 0.89.0: keep `shared/appkit-types/analytics.d.ts` committed (regenerate with `appkit generate-types --wait` when `config/queries/*.sql` changes).
