# Dependabot triage follow-ups

**Source:** the Dependabot triage on branch `mg-genie-dependabot-triage` (commits `e33b1d8`, `f66faae`), report [`../sessions/2026-10-29_dependabot-triage.md`](../sessions/2026-10-29_dependabot-triage.md), `ground-truth-app/PROJECT_MEMORY.md` Finding 17.

**Closed:** 4 (10 not-reachable OTel alerts dismissed by the owner 2026-10-30; only #23 open); 7 (GitHub shows 11 on `main` after the merge: 3 high, 8 moderate, matching `pnpm audit`); 1 (PR #11 merged 2026-10-30 04:59Z, merge commit `b8672f5`); 5 (zod 4.6.7 + card locale trim, deployment `01f1d3f6e512`, card rendered and used in Genie One 2026-10-30); 2 (dev deployment `01f1d3976c2d` verified: probes 12/12, `deploy_verification` 9/0, soak clean, `api_contract_tests` run `1079527457244820` 153 / 0); 3 (OTel env check: deployed line shows neither component enabled; commit `31b1b85`, deployment `01f1d3976c2d12cf810f52e0f5d24bb5`).

Priority: **P1** = fix before the next build, **P2** = next build, **P3** = when convenient.

| # | P | Bundle | Item |
|---|---|--------|------|
| 1 | P1 | root / owner | ~~Open and merge the PR for `mg-genie-dependabot-triage`~~ closed |
| 2 | P2 | app | ~~Deploy the override set to dev and verify it~~ closed |
| 3 | P2 | app | ~~Confirm the deployed app has no platform-injected `OTEL_METRICS_EXPORTER` or `OTEL_PROPAGATORS`~~ closed |
| 4 | P2 | root / owner | ~~Dismiss the 10 not-reachable OTel alerts on GitHub~~ closed |
| 5 | P2 | app | ~~zod GHSA-mrhx (high)~~ closed |
| 6 | P3 | app (upstream) | `@opentelemetry/instrumentation-pg` GHSA-qqmp: needs an AppKit with auto-instrumentations that has `instrumentation-pg` >= 0.73.0 |
| 7 | P3 | root | ~~Reconcile the GitHub alert count with `pnpm audit` after the merge~~ closed |
| 8 | P3 | app | Drop each security override once AppKit ships the patched version |
| 9 | P3 | design / owner | Keep the Figma Make export's `package.json` / lockfile out of the repo |
| 10 | P3 | root / owner | Dependabot API access from Genie Code |

## 1. Open and merge the PR (P1, root / owner)

* **State:** branch pushed; nothing is on `main`. The 19 Figma alerts and the 30 fixed app rows only close when the branch merges.
* **Scope:** the Figma export manifest removal, the 7 overrides + `vitest` 4.1.12, and the docs; checks are listed in the triage report's Results section.
* **Done when:** merged; the Dependabot page for `main` drops the Figma and fixed app alerts.
* **Closed (2026-10-30):** [PR #11](https://github.com/mkgs-databricks-demos/semanticGroundTruth/pull/11) merged by the owner at 04:59:10Z, merge commit `b8672f5` (12 commits, head `5fe8efe`). CodeQL, Analyze (javascript-typescript) and Analyze (python) all passed; no new code-scanning alerts. The merged tree equals `5fe8efe`, the tree deployed to dev as `01f1d3f6e512`. The branch was deleted on merge. The Dependabot page count is follow-up 7.
* **Follow-up 7 closed (2026-10-30):** the push of `mg-genie-dependabot-post-merge` reported "GitHub found 11 vulnerabilities on ... default branch (3 high, 8 moderate)", down from 63 (1 critical, 23 high, 31 moderate, 8 low). That equals the `pnpm audit` result on the merged lockfile (0 C / 3 H / 8 M / 0 L): the 10 alerts in item 4 plus `instrumentation-pg` (item 6).

## 2. Deploy the override set to dev (P2, app)

* **Why:** the checks ran on a `/tmp` copy only. The runtime overrides (`qs`, `yaml`, `js-yaml`, `fast-uri`, `systeminformation`) are on the server path; `dompurify` and `echarts` are not in the client bundle.
* **Change:** after item 1, deploy the app with `bundle run app` (not raw `apps deploy`; see the 2026-10-29 AppKit session), then run the post-deploy probes and `deploy_verification`.
* **Done when:** deployment id recorded, probes 12/12, `deploy_verification` SUCCESS, 10 min soak with 0 error lines; `api_contract_tests` still 153 / 0.
* **Status (2026-10-29):** `bundle run app --target dev` from the Git folder at `31b1b85` -> deployment `01f1d3976c2d12cf810f52e0f5d24bb5` SUCCEEDED, app RUNNING (about 3 min UNAVAILABLE during the build). First startup minute in the OTel logs table: 847 lines, 0 error lines, one `listening on port 8000`, no `Cannot find module` / `package`.
* **Verified (2026-10-29, deployment `01f1d3976c2d`):** probes 12/12 as the M2M SPN (the 12 `runtime_targets.app.probes` in `docs/plans/build-5/waves.json`: `/health`, `/api/me` admin, `/api/campaigns`, `/api/config` x2, `/api/me/settings`, `/api/review/stats/me`, `/settings`, `/steward/feedback-branches`, `icons.manifest.json`, `dm-sans-regular.ttf`, MCP initialize `semantic-ground-truth` 0.1.0). `deploy_verification` (job `359858966042356`) run `92961586664054` SUCCESS, 9 passed / 0 failed, the same checks as the previous baseline run `263699809540741`. Soak 12:56-13:07Z: 144 log rows, 0 error and 0 warn lines, 1 start (no restarts), no missing module/package; 27 traces, 0 error spans. `api_contract_tests` (job `443124502254957`) run `1079527457244820` SUCCESS: 153 pass / 0 fail / 201 `skipped_live` / 100% coverage, the same as build 5's run `281019161761628`. **Closed.**

## 3. Check for platform-injected OTel env (P2, app)

* **Why:** the dismissals in item 4 rely on the Prometheus exporter and Jaeger propagator never loading. They load only if `OTEL_METRICS_EXPORTER` includes `prometheus` or `OTEL_PROPAGATORS` includes `jaeger`. `resources/app.app.yml` sets neither, but the Apps platform injects its own OTel env.
* **Confirmed in code (2026-10-29):** `@mlflow/core` 0.4.0 is the only `NodeSDK` caller and passes only `spanProcessors`, so `sdk-node` 0.205.0 reads both settings from env: `PrometheusExporter` only when `OTEL_METRICS_EXPORTER` lists `prometheus` (unset means otlp), `JaegerPropagator` only when `OTEL_PROPAGATORS` lists `jaeger`.
* **Change (done, branch `mg-genie-dependabot-triage`):** `server/lib/otelEnvCheck.ts` logs one line right after `listening on port`: `info` "OTel env check: Prometheus exporter and Jaeger propagator not enabled", or `warn` if either is enabled. The JSON fields are `check: "otel_env"`, `metricsExporters`, `propagators`, `prometheusExporter`, `jaegerPropagator`, and `otelVarNames` (names only; OTLP headers can carry credentials). 8 tests in `server/lib/otelEnvCheck.test.ts`.
* **Done when:** the deployed line shows `prometheusExporter: false` and `jaegerPropagator: false`, and it is recorded in the triage report. If either is `true`, item 4 becomes a fix instead of a dismissal.
* **Closed (2026-10-29):** deployment `01f1d3976c2d12cf810f52e0f5d24bb5` logged it at 12:56:24Z (`hls_fde_dev.dev_matthew_giglia_semantic_ground_truth.semantic_ground_truth_otel_logs`, `body` contains `otel_env`): `metricsExporters: []`, `propagators: []`, `prometheusExporter: false`, `jaegerPropagator: false`. The platform injects 12 `OTEL_*` variables (`OTEL_BLRP_*` x3, `OTEL_BSP_*` x3, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_PROFILE_ID`, `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER`), and neither of the two is among them. So `sdk-node` uses its default otlp metrics exporter and tracecontext/baggage propagators. Recheck after any change to OTel env or AppKit / `@mlflow/core`: `SELECT time, body FROM <otel_logs> WHERE CAST(body AS STRING) ILIKE '%otel_env%' ORDER BY time DESC LIMIT 1`.

## 4. Dismiss the not-reachable alerts (P2, root / owner, after 3)

Owner-approved 2026-10-29; Genie Code cannot dismiss on GitHub (item 10). Reason "Vulnerable code is not actually used", with a link to the triage report.

| Package | Version | Advisory | Patched | Why not reachable |
| --- | --- | --- | --- | --- |
| `@opentelemetry/exporter-prometheus` | 0.205.0 | GHSA-q7rr-3cgh-j5r3 (high) | >= 0.217.0 | Loaded only with `OTEL_METRICS_EXPORTER=prometheus` |
| `@opentelemetry/sdk-node` | 0.205.0 | GHSA-q7rr-3cgh-j5r3 (high) | >= 0.217.0 | Same advisory, same condition |
| `@opentelemetry/propagator-jaeger` | 2.1.0, 2.8.0 | GHSA-45rx-2jwx-cxfr (high) | >= 2.9.0 | Used only with `OTEL_PROPAGATORS=jaeger` |
| `@opentelemetry/instrumentation-mysql` / `mysql2` / `knex` / `mongoose` / `oracledb` / `tedious` / `cassandra-driver` | various | GHSA-qqmp-wf37-98f9 (moderate) | various | No driver installed; the instrumentations never activate |

The fixes need `@mlflow/core` / AppKit to move to `sdk-node` >= 0.217 and `@opentelemetry/core` 2.9 (which conflicts with our 2.8.0 override), so dismissal is the right action until then.

**Alert numbers (GitHub, `main` @ `b8672f5`, 2026-10-30: 11 open, 59 closed).** GitHub shows Jaeger as one alert, so 10 to dismiss:

| Batch | Alerts | Comment |
| --- | --- | --- |
| A (high) | #5 `propagator-jaeger`, #65 `exporter-prometheus`, #66 `sdk-node` | Not reachable: Prometheus exporter and Jaeger propagator load only via OTEL_METRICS_EXPORTER=prometheus / OTEL_PROPAGATORS=jaeger. Neither is set; the deployed otel_env check confirms. See docs/sessions/2026-10-29_dependabot-triage.md |
| B (moderate) | #16 `cassandra-driver`, #17 `tedious`, #18 `oracledb`, #19 `mongoose`, #20 `mysql`, #21 `knex`, #22 `mysql2` | Not reachable: these instrumentations activate only when their DB driver is loaded. None of these drivers is installed (pnpm-lock.yaml). See docs/sessions/2026-10-29_dependabot-triage.md |

Keep #23 (`instrumentation-pg`) open: `pg` is installed (follow-up 6).

**Done when:** #5, #16-#22, #65 and #66 are dismissed with the reason above, and only #23 stays open.

**Closed (2026-10-30, owner):** the owner dismissed the 10 alerts in two batches with the comments above. The Dependabot page (`is:open ecosystem:npm`) shows Open 1 (#23 `instrumentation-pg`, moderate) and Closed 69 (59 + 10).

## 5. zod GHSA-mrhx (P2, app / owner)

* **Evidence:** high, memory exhaustion validating oversized constrained collections; reachable through `validate(spec)` on JSON bodies up to 1 mb. Patched >= 4.6.6. A global `zod` 4.6.7 override passes `tsc` (one copy), but the MCP App review card grows from 82,280 to 113,476 bytes gzip (budget 100 KB gzip / 400 KB raw, L300-17, `server/mcp/views/app/build.ts`), and `shared/contracts/generated/contracts.schema.json` changes (36 nullable fields `anyOf` -> `type: [T, "null"]`, 2 email patterns; equivalent).
* **Options:** (a) keep 4.3.6 until AppKit drops its exact `zod` pin (current); (b) raise the card budget to about 120 KB gzip / 480 KB raw in `build.ts` and L300-17, add `zod: 4.6.7` to `pnpm-workspace.yaml` overrides and `package.json`, regenerate the card and `contracts.schema.json`, and rerun `api_contract_tests`; (c) as a stopgap, cap array / record sizes in the contract schemas so oversized collections are rejected early.
* **Done when:** an owner decision is recorded; for (b), audit shows no zod row and every check in the triage report passes.
* **Decision (owner, 2026-10-29):** none of (a)-(c). Keep the 100 KB budget and remove the card's dead weight instead. Measured on ext-apps 1.7.5 + SDK 1.32.1: `main.ts` imports the lean `app.js` (33 KB), not `app-with-deps.js`; MCP SDK v1 needs zod at runtime, but 51 zod locale files (~185 KB minified) ride along through `export * as locales` (colinhacks/zod#6050). MCP Apps guidance ([quickstart](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/quickstart.md), [2026-01-26 spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)): single-file inline HTML is the baseline, no size limit, hosts may prefetch and cache.
* **Change (applied on the branch):** `build.ts` plugin `zodEnglishOnlyLocales` keeps only zod's English locale (and corrects the `app-with-deps` comment); `zod: 4.6.7` in `pnpm-workspace.yaml` overrides and `package.json` (dependency + inert overrides copy); lockfile, `reviewCardApp.generated.ts` and `contracts.schema.json` regenerated (36 nullable `anyOf` -> `type: [T, "null"]`, 2 email patterns; nothing else).
* **Checks (exact rsync, Node 22.16.0, pnpm 11.0.8):** frozen install; lockfile-only byte-identical; one zod copy (4.6.7); card **75,467 B gzip / 273,447 raw** (was 82,280 / 344,467); English zod messages at runtime (classic and mini), no other locales in the card; both `tsc -b` 0 errors; vitest 62 files, 1891 pass / 2 skipped; `pnpm run build` OK and leaves the 3 generated files unchanged; entry chunk **242.90 kB** gzip (was 302.56; zod 4.6.7 also drops unused locales from the client); audit 0 C / 3 H / 8 M / 0 L (11; zod row gone).
* **Deployed (2026-10-30, `32dc3da`):** `bundle run app --target dev` -> deployment `01f1d3f6e51219888b03876091d84598` SUCCEEDED, app RUNNING. Probes 12/12 (M2M SPN). The live `resources/read` of `ui://ground-truth/review-card` (`text/html;profile=mcp-app`) is byte-identical to the committed card (273,447 B, same sha256; decode the event stream as UTF-8, `requests` defaults to Latin-1). `deploy_verification` run `712371650173866` 9 / 0. `api_contract_tests` run `284479630574228` 153 pass / 0 fail / 201 `skipped_live` / 100%. Soak 00:16-00:33Z: 1,620 log rows, 0 error lines, 1 start, no missing module/package, 177 traces, 0 error spans; one warn, "Lakebase plugin exposes no pool.end()/close(); skipping" (`server/server.ts:53`, the old process shutting down, logged on every redeploy since 10-28). `otel_env` unchanged (`prometheusExporter: false`, `jaegerPropagator: false`).
* **Genie One (owner, 2026-10-30):** "give me a new card" -> `review_get_next` rendered the interactive card (Members with Gaps, measure, PENDING; Approve / Reject / Edit / Skip with A / R / E / S shortcuts, skip-reason select, logic, Add synonym, "29 / 151 reviewed"; dark host theme applied). The owner approved a card from the card itself: `lb_votes_history` has `vote_type = approve`, `source = mcp` at 04:19:21Z; 22 `POST /mcp` spans 04:14-04:20Z, 0 error spans; 0 error log lines since 04:10Z; deployment `01f1d3f6e512` still active. Reject / Edit / Skip were not clicked in Genie One; they go through the same `app.callServerTool` path and are covered by `main.test.ts` / `view.test.ts` and the live contract tests. **Closed.**

## 6. `instrumentation-pg` GHSA-qqmp (P3, upstream)

* **Evidence:** `@opentelemetry/instrumentation-pg` 0.71.0 (patched >= 0.73.0), through AppKit -> `@opentelemetry/auto-instrumentations-node`. Active (Lakebase uses `pg`); the DB user lands in span attributes, which go to the project's own UC OTel tables.
* **Change:** upgrade AppKit when a release carries the fix (stay >= 0.89.0, Findings 15 and 16), or override `@opentelemetry/auto-instrumentations-node` if a compatible version exists.
* **Done when:** audit shows no `instrumentation-pg` row.

## 7. Reconcile alert counts (P3, root)

* **Evidence:** GitHub showed 57 alerts on `main` at the start of triage and 63 (1 C / 23 H / 31 M / 8 L) after the push; `pnpm audit` found 61 rows (42 app + 19 Figma). New advisories were probably published during the day.
* **Change:** after items 1 and 4, rerun `pnpm audit` and compare it with the Dependabot list; triage any new row.
* **Done when:** the open GitHub alerts are exactly items 5 and 6 (plus any new triaged rows).

## 8. Retire the overrides (P3, app)

* **Change:** on each AppKit upgrade, check whether it ships `dompurify` >= 3.4.17, `echarts` >= 6.1.0, `js-yaml` >= 4.3.2, and whether `yaml`, `qs`, `fast-uri` and `systeminformation` resolve to patched versions without the override; remove the ones that do, and regenerate the lockfile from `main`'s (runbook `node_toolchain_genie_code.md`).
* **Done when:** `pnpm-workspace.yaml` overrides list only what is still needed.

## 9. Figma Make export manifest (P3, design / owner)

* **Change:** `figma_make_brief.md` §3 step 2 now says not to commit the export's `package.json` / lockfile. On each new Figma Make push or PR (including bot PRs), check that `docs/design/ui/figma/_code/package.json` and `pnpm-lock.yaml` are not re-added.
* **Done when:** the next export lands without them.

## 10. Dependabot API access (P3, root / owner, optional)

* **Evidence:** Genie Code could not read the Dependabot API (no `gh` CLI or token, unauthenticated 401, no Dependabot tool in the GitHub connector), so triage fell back to `pnpm audit` and could not dismiss alerts.
* **Change:** optional: a fine-grained token with `security_events` / Dependabot alerts read (and write, for dismissals) in a secret scope, used only from a notebook.
* **Done when:** decided; if adopted, alert numbers can be added to the triage table.
