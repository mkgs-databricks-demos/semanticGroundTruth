# Dependabot triage: 57 alerts on `main` @ `9198d2d` (2026-10-29)

**Status:** merged to `main` 2026-10-30 ([PR #11](https://github.com/mkgs-databricks-demos/semanticGroundTruth/pull/11), merge commit `b8672f5`; CodeQL checks passed). **Done (owner-approved 2026-10-29):** removed the Figma export's `_code/package.json` and `_code/pnpm-lock.yaml` (19 Figma rows), and applied the app change set (30 rows; `pnpm audit` 42 -> 12). **zod 4.6.7 applied (owner, 2026-10-29)** with a card locale trim that keeps the MCP App card under its 100 KB budget (75,467 B gzip; see Results); `pnpm audit` 12 -> 11. **Waiting for the owner:** dismissing the 10 not-reachable app alerts on GitHub. Follow-ups: [`../requests/2026-10-29_dependabot-follow-ups.md`](../requests/2026-10-29_dependabot-follow-ups.md).

## Source and method

* GitHub reported 57 alerts on `main` after the build-5 merge (PR #10): 1 critical, 20 high, 29 moderate, 7 low.
* The Dependabot API could not be read from Genie Code (no `gh` CLI, no token; the unauthenticated API returns 401; the GitHub connector has no Dependabot tool). The Databricks npm proxy (`npm-proxy.cloud.databricks.com`) needs a login from serverless (every path 303/404).
* **Fallback (owner choice): `pnpm audit --json`** on `/tmp` rsync copies of both lockfiles, using the toolchain in [`../runbooks/node_toolchain_genie_code.md`](../runbooks/node_toolchain_genie_code.md) (nodeenv Node 22.16.0, npm 10.9.2, pnpm 11.0.8). Dependency chains come from `pnpm why` and a walk of the `pnpm-lock.yaml` snapshot graph. Rows are keyed by GHSA id, because pnpm audit has no Dependabot alert numbers.
* pnpm audit lists **61 package/advisory rows (1 critical, 22 high, 30 moderate, 8 low)**, 4 more than Dependabot. Dependabot matches advisories to manifests a little differently. Match the alert numbers on the Security tab by GHSA id when dismissing.
* Reachability checks:
  * Client bundle: `vite build --config client/vite.config.ts` in `/tmp/gt-dep`, then a string scan of `client/dist`. Positive controls: `sgt-theme` and zod `too_big` are present. Negative: DOMPurify (`ALLOWED_TAGS`) and echarts (`zrender`) are absent, although both strings exist in the library sources.
  * Server: source reads of AppKit 0.89.0 `dist` and the app `server/`.

## Manifests

| Manifest / lockfile | What it is | Rows |
| --- | --- | --- |
| `ground-truth-app/package.json` + `pnpm-lock.yaml` (overrides in `pnpm-workspace.yaml`) | Production app | 42 (1 C, 15 H, 20 M, 6 L) |
| `docs/design/ui/figma/_code/package.json` + `pnpm-lock.yaml` (**removed 2026-10-29**) | Figma Make reference export. Not deployed and not imported by production code. Nothing used the two files. The parts still used are kept: the screenshots (`ui_visual_checks` `figma_dir`, `figma_similarity`), `design-system/variables.json` (`tokens-parity.test.ts`) and `_code/src`/`_code/public` (build-5 port references, `icons.manifest.json` provenance). `figma_make_brief.md` §3 step 2 now says not to commit the export manifest | 19 (0 C, 7 H, 10 M, 2 L) |
| Python (infra, agent, app notebooks) | No requirements/pyproject files, and job YAML has no `environments` dependencies. Notebooks run `%pip install --upgrade databricks-sdk` (+ `requests`, `pyyaml`, `jsonschema`, `playwright`, `axe-playwright-python`, `pillow`, `numpy`), unpinned, so they get the latest version on each run. Dependabot does not scan these | 0 |

`@databricks/appkit` / `appkit-ui` 0.89.0 and `@mlflow/core` 0.4.0 are the latest releases, so no parent bump is available. AppKit pins `zod` 4.3.6, `js-yaml` 4.3.1, `dompurify` 3.4.11, `echarts` 6.0.0, `express` 4.22.2 and `@opentelemetry/auto-instrumentations-node` 0.77.0 exactly. The `pnpm-workspace.yaml` overrides `fast-uri` 3.1.0, `systeminformation` 5.31.7 and `@opentelemetry/core` 2.8.0 came from the AppKit scaffold template (`652463e`, 2026-10-14), not from a project decision.

## Critical and high summary (app)

* **Critical, `dompurify` 3.4.11 (GHSA-cg2g, plus 1 high, 1 moderate and 3 low).** Only `appkit-ui` `genie-chat-message` uses it. The app imports no Genie or chart component, and DOMPurify is not in the client bundle. AppKit calls `sanitize()` with the default config, so the `SAFE_FOR_TEMPLATES`, `IN_PLACE` and `CUSTOM_ELEMENT_HANDLING` bypasses would not apply even if it were bundled. **Fix now:** override to 3.4.17 (patch).
* **High, `fast-uri` 3.1.0 (8 high, 2 moderate, 2 low).** The chain is MCP SDK -> `ajv`. ajv resolves URIs of our own schemas, and MCP tool input is validated with zod, so exploitation is unlikely. **Fix now:** change the template override 3.1.0 -> 3.1.9 (ajv needs `^3.0.1`).
* **High, `zod` 4.3.6 (GHSA-mrhx, memory exhaustion validating oversized constrained collections).** **Reachable:** every route runs `validate(spec)` on JSON bodies up to AppKit's 1 mb `express.json` limit. The fix is >= 4.6.6, which breaks the agreed 4.3.6 pin. It must be a global override so AppKit, the MCP SDK and the app share one copy (runbook: two copies fail `tsc`). **Defer until you decide.** Option: override `zod` 4.6.7 and run the full check list.
* **High, `js-yaml` 4.3.1 (GHSA-2883).** AppKit parses agent and skill frontmatter (from the `agent_skills` volume) with it, so input is trusted. **Fix now:** override `js-yaml@4.3.1` -> 4.3.2.
* **High, `systeminformation` 5.31.7 (GHSA-3f7j, plus 1 moderate and 1 low).** OTel host-metrics uses it. The Windows-only command injection does not apply on Linux Apps, and `networkStats()` input is not user-controlled. **Fix now:** change the template override -> 5.33.18.
* **High, `@opentelemetry/exporter-prometheus` / `sdk-node` 0.205.0 (GHSA-q7rr).** It arrives via `@mlflow/core` 0.4.0 (`^0.205.0`). The exporter is only created when `OTEL_METRICS_EXPORTER=prometheus`, which is not set. The fix needs sdk-node >= 0.217, outside `@mlflow/core`'s range, and MLflow tracing broke before (Finding 15). **Dismiss as not reachable** and revisit when `@mlflow/core` updates.
* **High, `@opentelemetry/propagator-jaeger` 2.1.0 / 2.8.0 (GHSA-45rx).** It is only created when `OTEL_PROPAGATORS` includes `jaeger`, which is not set. 2.9.0 needs `@opentelemetry/core` 2.9.0, which conflicts with the core 2.8.0 override. **Dismiss as not reachable.**
* **Before dismissing GHSA-q7rr and GHSA-45rx:** `resources/app.app.yml` sets only `OTEL_TRACES_SAMPLER`. **Checked 2026-10-29** on deployment `01f1d3976c2d`: neither `OTEL_METRICS_EXPORTER` nor `OTEL_PROPAGATORS` is set (see Results).
* **Figma export (6 high `react-router` 7.13.1, 1 high `vite` 8.0.5):** **fixed by removing the export's `package.json` and lockfile** (owner decision 2026-10-29). These were never deployed or imported, and the production app is already on `react-router` 7.18.4. GitHub closes these alerts automatically once the branch is merged to `main`.

## Moderate and low notes (app)

* `qs` 6.15.3 / 6.16.0 (3 moderate). The AppKit Express 4 app parses every query string with `qs` (`extended` parser), so **GHSA-4mjr is reachable** (DoS). GHSA-x5fp (comma option) and GHSA-6pq8 (`stringify`) are not used by Express. The MCP endpoint is mounted on the AppKit Express 4 app (`server/mcp/index.ts`), so the MCP SDK's Express 5 does not serve traffic. **Fix now:** override `qs` 6.16.1. It is already in the lock via `body-parser`, so this leaves one copy. Express asks for `~6.15.1`, so this is a minor bump.
* `vitest` / `@vitest/mocker` 4.1.9 (3 moderate). Test-only: a devDependency and an AppKit peer, also run by `prebuild` in the Apps build container. **Fix now:** bump the devDependency to 4.1.12.
* `yaml` 2.8.2 (1 moderate). Used by AppKit, OTel configuration and rolldown-vite on trusted files. **Fix now:** override 2.8.3.
* `echarts` 6.0.0 (1 moderate, XSS). An appkit-ui chart dependency, not in the bundle. **Fix now:** override 6.1.0 (minor, unused code path).
* `@opentelemetry/instrumentation-*` (GHSA-qqmp, DB user in span attributes, 8 moderate):
  * Only `instrumentation-pg` is active (Lakebase uses `pg` 8.18.0), and the attributes land in our own UC OTel tables. The fix (0.73.0) needs `@opentelemetry/core` ^2.9 and `instrumentation` ^0.221. **Defer** to an AppKit upgrade.
  * mysql, mysql2, knex, mongoose, oracledb, tedious and cassandra-driver are not installed, so those instrumentations never patch anything. **Dismiss as not reachable.**

## All alerts

Keys: (D) direct, (T) transitive. Notes P1-P13 / F1-F2 refer to the sections above (P1 dompurify, P2 echarts, P3 js-yaml, P4 yaml, P5 fast-uri, P6 systeminformation, P7 qs, P8 zod, P9 vitest, P10 jaeger, P11 prometheus/sdk-node, P12 instrumentation-pg, P13 inactive instrumentations, F1 react-router, F2 vite). Vulnerable range -> first patched version is in the appendix.

| # | alert id (GHSA) | package | severity | manifest | classification | reachable? | fix path | proposed action | risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GHSA-cg2g-xh64-v4q7 | `dompurify` 3.4.11 (T) | critical | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 2 | GHSA-q7rr-3cgh-j5r3 | `@opentelemetry/exporter-prometheus` 0.205.0 (T) | high | `ground-truth-app` | runtime server (OTel) [P11] | No (config) | sdk-node >= 0.217 | dismiss: not reachable | high if forced |
| 3 | GHSA-45rx-2jwx-cxfr | `@opentelemetry/propagator-jaeger` 2.1.0,2.8.0 (T) | high | `ground-truth-app` | runtime server (OTel) [P10] | No (config) | core 2.9 needed | dismiss: not reachable | medium |
| 4 | GHSA-q7rr-3cgh-j5r3 | `@opentelemetry/sdk-node` 0.205.0 (T) | high | `ground-truth-app` | runtime server (OTel) [P11] | No (config) | sdk-node >= 0.217 | dismiss: not reachable | high if forced |
| 5 | GHSA-mrv2-3pqr-j5jr | `dompurify` 3.4.11 (T) | high | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 6 | GHSA-4c8g-83qw-93j6 | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 7 | GHSA-7p8r-x3mc-p8w7 | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 8 | GHSA-f65p-4m7j-42xc | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 9 | GHSA-jqff-g426-hqxp | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 10 | GHSA-q3j6-qgpj-74h6 | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 11 | GHSA-qw65-cvwx-89v3 | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 12 | GHSA-v2hh-gcrm-f6hx | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 13 | GHSA-v39h-62p7-jpjc | `fast-uri` 3.1.0 (T) | high | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 14 | GHSA-2883-xcg3-v3hh | `js-yaml` 4.3.1 (T) | high | `ground-truth-app` | runtime server [P3] | trusted input only | override 4.3.2 | fix now: override | low |
| 15 | GHSA-3f7j-7jwc-fxfj | `systeminformation` 5.31.7 (T) | high | `ground-truth-app` | runtime server (OTel) [P6] | No (Linux; no user input) | override 5.31.7 -> 5.33.18 | fix now: override | low |
| 16 | GHSA-mrhx-c7xc-m3w5 | `zod` 4.3.6 (T) | high | `ground-truth-app` | runtime server + client [P8] | Yes (bodies <= 1 mb) | override 4.6.7 (all consumers) | fixed: override 4.6.7 + card locale trim (Results) | medium |
| 17 | GHSA-49rj-9fvp-4h2h | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 18 | GHSA-8646-j5j9-6r62 | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 19 | GHSA-8x6r-g9mw-2r78 | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 20 | GHSA-chx6-hx7r-mcp5 | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 21 | GHSA-qwww-vcr4-c8h2 | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 22 | GHSA-rxv8-25v2-qmq8 | `react-router` 7.13.1 (D) | high | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 23 | GHSA-587h-7wmj-h5pm | `vite` 8.0.5 (D) | high | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 24 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-cassandra-driver` 0.64.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 25 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-knex` 0.63.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 26 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-mongoose` 0.65.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 27 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-mysql` 0.65.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 28 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-mysql2` 0.65.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 29 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-oracledb` 0.44.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 30 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-pg` 0.71.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, active) [P12] | Yes, low impact | AppKit upstream | defer: upstream | medium |
| 31 | GHSA-qqmp-wf37-98f9 | `@opentelemetry/instrumentation-tedious` 0.38.0 (T) | moderate | `ground-truth-app` | runtime server (OTel, inactive) [P13] | No (no driver) | AppKit upstream | dismiss: not reachable | none |
| 32 | GHSA-82fw-gwwq-j7x9 | `@vitest/mocker` 4.1.9 (T) | moderate | `ground-truth-app` | test-only [P9] | No | via vitest 4.1.12 | fix now: bump | low |
| 33 | GHSA-qxg6-89mg-rqv8 | `@vitest/mocker` 4.1.9 (T) | moderate | `ground-truth-app` | test-only [P9] | No | via vitest 4.1.12 | fix now: bump | low |
| 34 | GHSA-55q2-fjhq-7xh7 | `dompurify` 3.4.11 (T) | moderate | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 35 | GHSA-fgmj-fm8m-jvvx | `echarts` 6.0.0 (T) | moderate | `ground-truth-app` | client dep, not bundled [P2] | No | override 6.1.0 | fix now: override | low-med |
| 36 | GHSA-hrr3-gc8f-f4qj | `fast-uri` 3.1.0 (T) | moderate | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 37 | GHSA-w74x-v6f9-j3xg | `fast-uri` 3.1.0 (T) | moderate | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 38 | GHSA-4mjr-xmp4-gh2g | `qs` 6.15.3 (T) | moderate | `ground-truth-app` | runtime server (Express) [P7] | Yes | override 6.16.1 | fix now: override | low |
| 39 | GHSA-6pq8-jhm2-2vcw | `qs` 6.15.3,6.16.0 (T) | moderate | `ground-truth-app` | runtime server (Express) [P7] | No (stringify) | override 6.16.1 | fix now: override | low |
| 40 | GHSA-x5fp-wj9c-mxmx | `qs` 6.15.3 (T) | moderate | `ground-truth-app` | runtime server (Express) [P7] | No (comma option) | override 6.16.1 | fix now: override | low |
| 41 | GHSA-7648-jmwf-vw7j | `systeminformation` 5.31.7 (T) | moderate | `ground-truth-app` | runtime server (OTel) [P6] | No (no user input) | override 5.31.7 -> 5.33.18 | fix now: override | low |
| 42 | GHSA-82fw-gwwq-j7x9 | `vitest` 4.1.9 (D) | moderate | `ground-truth-app` | test-only [P9] | No | devDep 4.1.12 | fix now: bump | low |
| 43 | GHSA-48c2-rrv3-qjmp | `yaml` 2.8.2 (T) | moderate | `ground-truth-app` | runtime server + build [P4] | trusted input only | override 2.8.3 | fix now: override | low |
| 44 | GHSA-2j2x-hqr9-3h42 | `react-router` 7.13.1 (D) | moderate | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 45 | GHSA-337j-9hxr-rhxg | `react-router` 7.13.1 (D) | moderate | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 46 | GHSA-f22v-gfqf-p8f3 | `react-router` 7.13.1 (D) | moderate | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 47 | GHSA-h8fp-f39c-q6mh | `react-router` 7.13.1 (D) | moderate | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 48 | GHSA-wrjc-x8rr-h8h6 | `react-router` 7.13.1 (D) | moderate | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 49 | GHSA-698v-4r3x-3vcv | `vite` 8.0.5 (D) | moderate | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 50 | GHSA-fx2h-pf6j-xcff | `vite` 8.0.5 (D) | moderate | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 51 | GHSA-r825-w8mm-5pxw | `vite` 8.0.5 (D) | moderate | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 52 | GHSA-rq7h-c2jc-7f22 | `vite` 8.0.5 (D) | moderate | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 53 | GHSA-v6wh-96g9-6wx3 | `vite` 8.0.5 (D) | moderate | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |
| 54 | GHSA-6688-9rhm-gjv2 | `dompurify` 3.4.11 (T) | low | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 55 | GHSA-c2j3-45gr-mqc4 | `dompurify` 3.4.11 (T) | low | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 56 | GHSA-c6gr-qvv4-5v3f | `dompurify` 3.4.11 (T) | low | `ground-truth-app` | client dep, not bundled [P1] | No | override 3.4.17 | fix now: override | low |
| 57 | GHSA-333x-w4r6-6crp | `fast-uri` 3.1.0 (T) | low | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 58 | GHSA-xhq7-xmqj-769h | `fast-uri` 3.1.0 (T) | low | `ground-truth-app` | runtime server (MCP SDK) [P5] | unlikely | override 3.1.0 -> 3.1.9 | fix now: override | low |
| 59 | GHSA-4vjg-vx72-qq4g | `systeminformation` 5.31.7 (T) | low | `ground-truth-app` | runtime server (OTel) [P6] | No (no user input) | override 5.31.7 -> 5.33.18 | fix now: override | low |
| 60 | GHSA-84g9-w2xq-vcv6 | `react-router` 7.13.1 (D) | low | `figma/_code` | Figma reference export [F1] | No | remove export manifest | fixed: manifest removed | none |
| 61 | GHSA-9jrq-w75r-8gcw | `vite` 8.0.5 (D) | low | `figma/_code` | Figma reference export (dev server) [F2] | No | remove export manifest | fixed: manifest removed | none |

**Totals (after the Figma manifest removal):**

* Fix now: 30 rows, all app. They come from 7 override changes plus 1 devDependency bump.
* Fixed (manifest removed): 19 Figma rows.
* Dismiss: 10 app rows (not reachable).
* Defer: 2 rows (zod, instrumentation-pg). zod was fixed later the same day (Results, "zod 4.6.7 applied").

## Proposed change set (step 4, after approval)

`ground-truth-app/pnpm-workspace.yaml` `overrides` (pnpm 11 ignores the `package.json` copy; keep that copy in sync, since it has no effect):

| Override | Today | Proposed |
| --- | --- | --- |
| `fast-uri` | 3.1.0 | 3.1.9 |
| `systeminformation` | 5.31.7 | 5.33.18 |
| `dompurify` | — | 3.4.17 |
| `echarts` | — | 6.1.0 |
| `js-yaml@4.3.1` | — | 4.3.2 |
| `yaml` | — | 2.8.3 |
| `qs` | — | 6.16.1 |

In `package.json`, change devDependency `vitest` 4.1.9 -> 4.1.12. Keep `zod` 4.3.6 and `@opentelemetry/core` 2.8.0, and make no AppKit change (`shared/appkit-types/*.d.ts` unchanged). Regenerate the lockfile in the same commit. Checks follow the requested list: frozen install, lockfile-only byte-identical, vitest baseline 1883 / 2 skipped, both `tsc -b`, `pnpm run build`, `check:bundle` <= 350 kB gzip, and `bundle validate --strict --target dev` for `ground-truth-app`. The Figma export manifest is already removed (19 rows).

## Decisions needed

1. Approve the change set above.
2. zod: keep 4.3.6 and defer GHSA-mrhx (current proposal), or try a global `zod` 4.6.7 override on the branch.
3. Approve dismissing the 10 not-reachable app alerts. I can't dismiss them on GitHub from here. The 19 Figma alerts need no dismissal; they close when the branch merges.

Owner answers (2026-10-29): 1 approved, 2 "try zod 4.6.7", 3 approved.

## Results (2026-10-29)

All checks ran on `/tmp` rsync copies (Node 22.16.0, pnpm 11.0.8). The baseline copy (`main` content) gave vitest 1883 pass / 2 skipped, both `tsc -b` 0 errors, `pnpm run build` OK, entry chunk 302.56 kB gzip, MCP card 82,280 bytes gzip, and app audit 1 C / 15 H / 20 M / 6 L (42).

**zod 4.6.7 trial** (all 7 overrides + `vitest` 4.1.12 + global `zod` 4.6.7, one zod copy everywhere):

| Check | Result |
| --- | --- |
| Frozen install, lockfile-only byte-identical | pass |
| Both `tsc -b` | 0 errors (no two-copy `_zod.version` clash) |
| Audit | 0 C / 3 H / 8 M / 0 L (zod row gone) |
| vitest | 2 fail / 1881 pass: two generated-artifact snapshot tests |
| `shared/contracts/generated/contracts.schema.json` | 74 differences: 36 nullable fields `anyOf: [{type: T}, {type: null}]` -> `type: [T, "null"]`, and 2 email `pattern` rewrites (same no-leading-dot / no-double-dot rule). Equivalent JSON Schema |
| MCP App review card (`server/mcp/views/app/build.ts`) | **466,769 bytes, 113,476 gzip: over the L300-17 budget (100 KB gzip / 400 KB raw)**, so `pnpm run build` fails |

The change set without zod gives a byte-identical card and schema, so the size growth comes from zod alone (ext-apps bundles zod into the card). Raising the budget is a design decision, so zod stays 4.3.6 and GHSA-mrhx stays deferred.

**Applied set** (7 overrides + `vitest` 4.1.12, `zod` 4.3.6), checked on an exact rsync of the repo:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass |
| `pnpm install --lockfile-only` | byte-identical lockfile |
| Lockfile package diff vs `main` | only `dompurify` 3.4.17, `echarts` / `zrender` 6.1.0, `fast-uri` 3.1.9, `js-yaml` 4.3.1 removed (4.3.2 already present), `qs` 6.15.3 + 6.16.0 -> 6.16.1, `systeminformation` 5.33.18, `yaml` 2.8.3, `vitest` + `@vitest/*` 4.1.12. One version of each |
| vitest | 61 files, 1883 pass / 2 skipped (baseline) |
| `tsc -b tsconfig.server.json` / `tsconfig.client.json` | 0 / 0 errors |
| `pnpm run build` (prebuild typegen + vitest, server + client) | pass |
| `pnpm run check:bundle` | entry chunk 302.56 kB gzip (budget 350 kB), unchanged |
| Client bundle scan | DOMPurify (`ALLOWED_TAGS`) and echarts (`zrender`) still absent |
| MCP card, contract schema | byte-identical to `main` |
| Audit | 0 C / 4 H / 8 M / 0 L (12): zod, Prometheus exporter, sdk-node, Jaeger propagator, 8 OTel DB instrumentations |
| `databricks bundle validate --strict --target dev` (`ground-truth-app`) | Validation OK |

**Deployed to dev (2026-10-29):** `bundle run app --target dev` at `31b1b85` -> deployment `01f1d3976c2d12cf810f52e0f5d24bb5` SUCCEEDED, app RUNNING; probes 12/12 (M2M SPN), `deploy_verification` run `92961586664054` 9/0, soak 12:56-13:07Z with 0 error/warn lines, 1 start, 27 traces and 0 error spans. `api_contract_tests` run `1079527457244820` 153 pass / 0 fail / 201 `skipped_live` / 100% coverage (same as build 5). Follow-up 2 closed. **OTel env (follow-up 3, closed):** the startup `otel_env` line shows `OTEL_METRICS_EXPORTER` and `OTEL_PROPAGATORS` both unset (`prometheusExporter: false`, `jaegerPropagator: false`). Of the 12 platform-injected `OTEL_*` variables, none is either of those two. The Prometheus / Jaeger / `sdk-node` dismissals are now evidence-backed.

Gotcha: an override experiment's lockfile keeps caret-range consumers on the experiment's version. A copy resolved from the zod 4.6.7 lockfile, with zod reverted, still had 4.6.7 for the MCP SDK (two copies). Always regenerate from `main`'s lockfile.

**zod options for the owner:** (a) keep 4.3.6 until AppKit moves off its exact pin (current); (b) raise the card budget to about 120 KB gzip / 480 KB raw in `build.ts` and L300-17, add the global override, and regenerate the card and `contracts.schema.json` (a contract-snapshot change, so rerun `api_contract_tests`).

**zod 4.6.7 applied (owner, 2026-10-29), budget unchanged.** The card is mostly zod, and most of that zod is unused: `main.ts` imports ext-apps' lean `app.js` (33 KB), MCP SDK v1 needs zod at runtime, and zod's `export * as locales` keeps all 51 locales (~185 KB minified) in the bundle (colinhacks/zod#6050). `build.ts` now has a Vite plugin (`zodEnglishOnlyLocales`) that serves an English-only `zod/v4/locales/index.js`. Checked on an exact rsync:

| Check | Result |
| --- | --- |
| Frozen install / lockfile-only | pass / byte-identical; one zod copy (4.6.7) |
| MCP App card | 75,467 B gzip / 273,447 raw (main: 82,280 / 344,467; 4.6.7 without the trim: 113,476) |
| zod messages | English at runtime (classic and mini); no other locales in the card |
| `contracts.schema.json` | 36 nullable `anyOf` -> `type: [T, "null"]`, 2 email patterns; nothing else |
| Both `tsc -b` / vitest | 0 errors / 62 files, 1891 pass, 2 skipped |
| `pnpm run build` / `check:bundle` | pass, generated files unchanged / entry chunk 242.90 kB gzip (was 302.56) |
| Audit | 0 C / 3 H / 8 M / 0 L (11): Prometheus exporter, sdk-node, Jaeger propagator, 8 OTel DB instrumentations |

Gotcha: a second install from the same pnpm store again left AppKit's bundled `@databricks/sdk-*` empty, even with `--force`; a new `--store-dir` fixed it (runbook updated). **Deployed (2026-10-30):** `32dc3da` -> deployment `01f1d3f6e51219888b03876091d84598`; probes 12/12; live MCP card byte-identical to the committed one; `deploy_verification` run `712371650173866` 9 / 0; `api_contract_tests` run `284479630574228` 153 / 0 / 201 `skipped_live` / 100%; soak 00:16-00:33Z 0 error lines, 0 error spans (one existing shutdown warn). **Genie One (owner, 2026-10-30):** the card rendered and the owner approved from it (`lb_votes_history` `approve`, `source = mcp`, 04:19:21Z; 22 `POST /mcp` spans, 0 errors). Follow-up 5 closed.

## Appendix: vulnerable range -> first patched

1 `>=3.4.4 <=3.4.16` -> 3.4.17; 2 `<0.217.0` -> 0.217.0; 3 `<2.9.0` -> 2.9.0; 4 `>=0.57.0 <0.217.0` -> 0.217.0; 5 `<=3.4.16` -> 3.4.17; 6 `<3.1.3` -> 3.1.3; 7 `<3.1.5` -> 3.1.5; 8 `<3.1.6` -> 3.1.6; 9 `<3.1.6` -> 3.1.6; 10 `<=3.1.0` -> 3.1.1; 11 `<3.1.7` -> 3.1.7; 12 `<=3.1.3` -> 3.1.4; 13 `<=3.1.1` -> 3.1.2; 14 `>=4.0.0 <4.3.2` -> 4.3.2; 15 `<5.33.16` -> 5.33.16; 16 `<4.6.6` -> 4.6.6; 17 `>=7.0.0 <=7.14.1` -> 7.14.2; 18 `>=7.7.0 <7.13.2` -> 7.13.2; 19 `<7.15.0` -> 7.15.0; 20 `<7.18.0` -> 7.18.0; 21 `>=7.12.0 <7.18.2` -> 7.18.2; 22 `<7.14.0` -> 7.14.0; 23 `>=8.0.0 <=8.1.5` -> 8.1.6; 24 `<0.66.0` -> 0.66.0; 25 `<0.65.0` -> 0.65.0; 26-28 `<0.67.0` -> 0.67.0; 29 `<0.46.0` -> 0.46.0; 30 `<0.73.0` -> 0.73.0; 31 `<0.40.0` -> 0.40.0; 32 `>=2.1.0 <4.1.11` -> 4.1.11; 33 `<4.1.12` -> 4.1.12; 34 `<=3.4.12` -> 3.4.13; 35 `<6.1.0` -> 6.1.0; 36 `<3.1.8` -> 3.1.8; 37 `<3.1.9` -> 3.1.9; 38 `>=2.2.5 <6.16.0` -> 6.16.0; 39 `>=6.7.0 <=6.16.0` -> 6.16.1; 40 `>=6.14.2 <=6.15.3` -> 6.15.4; 41 `<5.33.13` -> 5.33.13; 42 `<4.1.11` -> 4.1.11; 43 `>=2.0.0 <2.8.3` -> 2.8.3; 44 `<7.14.1` -> 7.14.1; 45 `>=6.4.0 <7.18.0` -> 7.18.0; 46 `>=7.5.1 <7.13.2` -> 7.13.2; 47 `>=7.11.0 <7.18.0` -> 7.18.0; 48 `>=6.0.0 <7.18.0` -> 7.18.0; 49, 51, 52 `<=8.1.5` -> 8.1.6; 50, 53 `<=8.0.15` -> 8.0.16; 54 `<=3.4.15` -> 3.4.16; 55 `<=3.4.11` -> 3.4.12; 56 `<=3.4.16` -> 3.4.17; 57, 58 `<3.1.9` -> 3.1.9; 59 `<5.33.14` -> 5.33.14; 60 `>=7.12.0 <7.15.1` -> 7.15.1; 61 `<=8.1.5` -> 8.1.6.

## Files

* Added `docs/sessions/2026-10-29_dependabot-triage.md`; updated `docs/sessions/INDEX.md` and `docs/design/ui/figma_make_brief.md` (§3 step 2).
* Deleted `docs/design/ui/figma/_code/package.json` and `docs/design/ui/figma/_code/pnpm-lock.yaml`.
* `ground-truth-app/pnpm-workspace.yaml` (7 overrides), `ground-truth-app/package.json` (`vitest` 4.1.12, inert `overrides` copy synced), `ground-truth-app/pnpm-lock.yaml` (regenerated).
* `PROJECT_MEMORY.md` and `ground-truth-app/PROJECT_MEMORY.md` (status rows, App Stack, Finding 17).
* Added `docs/requests/2026-10-29_dependabot-follow-ups.md` (10 items) and its row in `docs/requests/README.md`.
* Follow-up 3: added `ground-truth-app/server/lib/otelEnvCheck.ts` + `otelEnvCheck.test.ts` (8 tests) and one call in `server/server.ts` after the startup marker. Checks on an exact rsync: vitest 62 files, 1891 pass / 2 skipped; both `tsc -b` 0 errors; eslint clean on the new files (the `server.ts` `no-unsafe-argument` at `adoptAppKitHttpServer` was already there); `pnpm run build` OK; entry chunk 302.56 kB gzip; `bundle validate --strict --target dev` OK.
* Follow-up 5 (zod): `ground-truth-app/server/mcp/views/app/build.ts` (locale-trim plugin, budget comment), `reviewCardApp.generated.ts`, `shared/contracts/generated/contracts.schema.json`, `pnpm-workspace.yaml` + `package.json` (`zod` 4.6.7), `pnpm-lock.yaml`; `docs/runbooks/node_toolchain_genie_code.md` (zod rule, pnpm store gotcha).
* All committed on `mg-genie-dependabot-triage` (from `main` @ `9198d2d`), merged as PR #11 (`b8672f5`, 2026-10-30).
