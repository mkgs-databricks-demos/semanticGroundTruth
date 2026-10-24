# Session 26 (build 4, wave 4-0): Node toolchain proof, new dependencies, security audit

* **Date:** 2026-10-24
* **Mode:** edit (unattended build-wave `genie_task`, job `1079028753739581`, run `110489694161084`)
* **Branch:** `mg-genie-build-4`
* **Plan:** [docs/plans/26_app_toolchain_deps_audit.md](../plans/26_app_toolchain_deps_audit.md)
* **Status:** pass

## Problems

1. The Node/pnpm runbook was not yet proven inside a build-wave `genie_task`.
2. Build 4 (session 34, MCP App) and build 5 (UI tests) need `@modelcontextprotocol/ext-apps` and render-level test tooling.
3. `pnpm audit` on main: 42 findings (1 critical, 17 high).
4. vitest ran everything in `node`; there was no DOM environment for component tests.

## What was done

* **Toolchain proof:** runbook steps ran unchanged in the task. Bootstrap 9 s; `node v22.16.0`, `npm 10.9.2`, `pnpm 11.0.8`. `pypi.org`, `nodejs.org/dist` and `registry.npmjs.org` all returned HTTP 200 from the task.
* **Baseline** (`/tmp/gt-26`, HEAD `f3583c3`): frozen install 12.5 s, 21 files / 331 tests, both `tsc -b` exit 0, audit 1 critical / 17 high / 18 moderate / 6 low.
* **Dependencies:** `@modelcontextprotocol/ext-apps` `1.7.5` (exact); dev `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.8, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.1.3, `vitest-axe` 0.1.0 (all exact, matching the file's pinning style).
* **Audit:** `react-router` 7.18.0 -> 7.18.4 (direct); lockfile-only updates `@grpc/grpc-js` 1.14.4 -> 1.14.6, `body-parser` 1.20.8 / 2.3.0 -> 1.20.9 / 2.4.0, `source-map-js` 1.2.1 -> 1.2.2. Result: 1 critical / 12 high / 18 moderate / 5 low (high + critical 18 -> 13).
* **vitest projects:** `node` (every `*.test.ts`) and `client` (`client/**/*.test.tsx`, jsdom, `client/src/test/setup.ts`). Setup registers jest-dom + `vitest-axe` matchers, stubs `matchMedia` / `ResizeObserver`, and runs `cleanup` after each test. `client/src/test/smoke.test.tsx` renders `ErrorBoundary` (children state and error state) with an axe check on each.
* **Runbook:** "Still to prove" replaced with the `genie_task` result, new rules (overrides location, blocked build scripts, zod pin), a component-test section, and an evidence table for this run.

## Root causes and decisions

* **pnpm 11 ignores `package.json` `overrides`.** Changing `fast-uri` there left the lockfile unchanged; changing `pnpm-workspace.yaml` rewrote it. The existing overrides `fast-uri: 3.1.0` and `@opentelemetry/core: 2.8.0` (in `pnpm-workspace.yaml`) are what pin 9 `fast-uri` highs and block `@opentelemetry/propagator-jaeger` 2.9.0 (which needs core 2.9.0). `pnpm-workspace.yaml` is not in this session's owned paths, so this is a request.
* **zod not bumped.** `zod` 4.6.7 (fixes GHSA-mrhx-c7xc-m3w5) made `tsc -b tsconfig.server.json` fail in `server/agents/review-worker/agent.ts`: AppKit 0.84.0 pins `zod` `4.3.6` exactly, so the app had two zod copies (`_zod.version.minor` 3 vs 6). Reverted to 4.3.6. Fix needs a workspace override (one copy for everybody) or an AppKit upgrade.
* **`dompurify` 3.4.11 and `js-yaml` 4.3.1** are exact dependencies of `@databricks/appkit` / `@databricks/appkit-ui` 0.84.0. AppKit upgrades are out of scope. Override request filed.
* **`msw` left out.** 3.0.3 is an unmet peer of vitest 4's `@vitest/mocker` (`msw ^2.4.9`). 2.15.0 satisfies the peer but has an install script, which pnpm 11 rejects (`ERR_PNPM_IGNORED_BUILDS`) unless `allowBuilds` in `pnpm-workspace.yaml` lists it. Session 35 can mock `fetch` directly, as the plan allows.
* **`vitest-axe` 0.1.0 works with vitest 4** at runtime (`expect.extend` with `vitest-axe/matchers`). A negative test (an `<img>` without `alt`) failed with `image-alt` as expected, then was deleted. Its bundled types only augment the legacy `Vi` namespace, so `client/src/test/vitest-axe.d.ts` declares the matcher on vitest's `Assertion`.
* **appkit-ui under Node ESM:** `@databricks/appkit-ui/dist/react/charts/base.js` imports `echarts-for-react/esm/core` with no extension, which Node's resolver rejects. The `client` project inlines `@databricks/appkit-ui` (`server.deps.inline`) so Vite resolves it, as in the real client build.
* **Lockfile generation:** `package.json` was edited with the workspace file tools; `pnpm-lock.yaml` was then regenerated in the repo with `pnpm install --lockfile-only` + `pnpm update <transitives> --lockfile-only` (no `node_modules` created), as the runbook prescribes for lockfile changes. It differs from the `/tmp/gt-26` lockfile only in dropping a stray `zod@4.6.7` left there by the reverted bump; the repo lockfile was re-validated from a fresh copy.

## Checks

Run on a fresh copy of the repo's `ground-truth-app/` (`/tmp/gt-26v`) after the files were written:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` on committed lockfile | pass (4 s) |
| `vitest run` | pass: 22 files, 333 tests (331 + 2 smoke) |
| `tsc -b tsconfig.server.json` / `tsconfig.client.json` with `shared/contracts` at HEAD | exit 0 / exit 0 |
| Same with session 25's in-progress `shared/contracts` | fails (not this session): `synonyms` missing on `Asset` (server/mcp/server.ts, server/services/asset/mappers.ts, 2 MCP view tests), `UserStats` `skippedCount`/`skippedToday` (markdown.test.ts), `'skip'` not a vote type (CardStack.tsx, SwipeActions.tsx). These are the consumer updates planned for later build 4 sessions. |
| `eslint client/src/test vitest.config.ts --report-unused-disable-directives` | pass |
| `prettier --check` on new/changed files | pass |
| `pnpm list` | `@modelcontextprotocol/ext-apps` 1.7.5, `react-router` 7.18.4, single `zod` 4.3.6 |
| `pnpm peers check` | only `tailwindcss` (tailwindcss-animate, unrelated to this session) |
| `git status` | only the 7 owned files; no `node_modules/` |
| `bundle validate --strict` | skipped: no YAML touched |

## Remaining high/critical audit findings

| Package | Version | Fixed in | Why not fixed |
| --- | --- | --- | --- |
| `dompurify` (1 critical, 1 high) | 3.4.11 | 3.4.17 | exact pin in `@databricks/appkit-ui` 0.84.0; needs workspace override or AppKit upgrade |
| `fast-uri` (9 high) | 3.1.0 | 3.1.7 | pinned by `pnpm-workspace.yaml` override `fast-uri: 3.1.0` (not owned) |
| `@opentelemetry/propagator-jaeger` (1 high) | 2.8.0 | 2.9.0 | exact pin in `@opentelemetry/sdk-node` 0.219.0 + workspace override `@opentelemetry/core: 2.8.0` (2.9.0 needs core 2.9.0) |
| `js-yaml` (1 high) | 4.3.1 | 4.3.2 | exact pin in `@databricks/appkit` / `appkit-ui` 0.84.0 |
| `zod` (1 high) | 4.3.6 | 4.6.6 | exact pin in AppKit; app-only bump breaks `tsc` (two zod copies) |

## Requests

* `ground-truth-app/pnpm-workspace.yaml` overrides: `fast-uri: 3.1.7`, `dompurify: 3.4.17`, `js-yaml: 4.3.2`, and test `zod: 4.6.7` and `@opentelemetry/core` 2.9.x + `@opentelemetry/propagator-jaeger: 2.9.0` together. The owner must regenerate `pnpm-lock.yaml` in the same commit and re-run frozen install, `vitest run`, both `tsc -b`. Overriding AppKit's exact pins is a semver-compatible patch/minor, but needs a deployed app check (converge).
* Optional: remove the inert top-level `overrides` block from `ground-truth-app/package.json` (pnpm 11 ignores it) or keep it in sync. Left as is to avoid scope creep.

## Files modified

* `ground-truth-app/package.json`
* `ground-truth-app/pnpm-lock.yaml`
* `ground-truth-app/vitest.config.ts`
* `ground-truth-app/client/src/test/setup.ts` (new)
* `ground-truth-app/client/src/test/vitest-axe.d.ts` (new)
* `ground-truth-app/client/src/test/smoke.test.tsx` (new)
* `docs/runbooks/node_toolchain_genie_code.md`
