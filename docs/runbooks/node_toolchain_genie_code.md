# Runbook: Node.js + pnpm toolchain in Genie Code serverless

Repeatable pattern for running `pnpm install`, `pnpm add`, `vitest`, `tsc` and `pnpm audit` from a Genie Code session (interactive or a build-wave `genie_task`) on serverless compute.

* **First used:** 2026-10-21 (lockfile regeneration, [ground-truth-app/docs/sessions/2026-10-21_first-deploy-planning.md](../../ground-truth-app/docs/sessions/2026-10-21_first-deploy-planning.md)).
* **Re-verified:** 2026-10-24, interactive Genie Code session on serverless (evidence below).
* **Proven in a build-wave `genie_task`:** 2026-10-24, session 26 (build 4, wave `4-0`, job run `110489694161084`). Same steps, no changes: bootstrap 9 s; `pip`, `nodejs.org` and the npm registry all reachable from the task (evidence below).

## Why it is needed

Serverless ships a bare Node `v22.9.0` at `/usr/local/bin/node`. `npm`, `npx` and `corepack` are broken symlinks into `/usr/local/lib/node_modules/`, which is stripped from the image. pnpm 11 needs Node `>= 22.13`, and `corepack` 0.29.3 has a stale registry signing key. So: install a private Node with `nodeenv`, then install pnpm with that Node's npm.

## Steps

Run in one shell (each step depends on `PATH`). Total time on 2026-10-24: 8 s.

```bash
pip install -q nodeenv
python -m nodeenv --node=22.16.0 --prebuilt /tmp/node2216
export PATH=/tmp/node2216/bin:$PATH
node --version            # v22.16.0
npm --version             # 10.9.2
npm install -g pnpm@11.0.8 --force
pnpm --version            # 11.0.8
```

`/tmp` does not survive a compute restart. Every new shell must `export PATH=/tmp/node2216/bin:$PATH`; if `/tmp/node2216` is gone, rerun the steps.

## Use it on the app

```bash
export PATH=/tmp/node2216/bin:$PATH
cd ground-truth-app
pnpm install --frozen-lockfile     # proves package.json and pnpm-lock.yaml agree
pnpm exec vitest run
pnpm exec tsc -b tsconfig.server.json
pnpm exec tsc -b tsconfig.client.json
```

Rules:

* **Parallel build sessions share the Git folder.** Only the session that owns `package.json` / `pnpm-lock.yaml` installs in the repo. Every other session copies `ground-truth-app/` to `/tmp/gt-<session_id>/` and runs install/test/tsc there, so two sessions never race on `node_modules/`.
* **Never commit `node_modules/`.** It is in `.gitignore`; check `git status` before committing. For dependency experiments, copy the app to `/tmp` first (exclude `node_modules`, `.venv`, `dist`, `.databricks`) and work there.
* **Lockfile changes:** run `pnpm add` / `pnpm update` in the repo, then `pnpm install --frozen-lockfile` again; commit `package.json` and `pnpm-lock.yaml` together, only if the frozen install, `vitest run` and both `tsc -b` pass.
* `.npmrc` keeps `enable-pre-post-scripts=true` (pnpm 11 needs it for the `prebuild` typegen). Do not add a registry override.
* `pnpm run build` runs `prebuild` (`appkit generate-types --wait`), which needs a warehouse connection. Use `tsc -b` + `vitest run` locally; the Apps build is the full build.
* **Overrides live in `pnpm-workspace.yaml`.** pnpm 11 ignores the top-level `overrides` block in `package.json` (verified: changing it leaves the lockfile untouched; changing `pnpm-workspace.yaml` rewrites it). The `package.json` copy is inert. Any override change must regenerate `pnpm-lock.yaml` in the same commit, or `--frozen-lockfile` fails.
* **Build scripts are blocked by default.** A new dependency with an install script fails `pnpm add` with `ERR_PNPM_IGNORED_BUILDS` until it is added to `allowBuilds` in `pnpm-workspace.yaml` (example: `msw` 2.x).
* **Do not bump `zod` alone.** AppKit (0.84.0 through 0.89.0) pins `zod` `4.3.6` exactly; a different app `zod` gives two copies and `tsc` fails (`_zod.version.minor` 3 vs 6) where app schemas meet AppKit or the MCP SDK. Bump it with an override (so AppKit gets the same copy) or with an AppKit upgrade. Since 2026-10-29 a global `zod: 4.6.7` override is in `pnpm-workspace.yaml` (with `package.json` in step). It keeps the MCP App review card under its 100 KB gzip budget only because `server/mcp/views/app/build.ts` drops zod's non-English locales (`zodEnglishOnlyLocales`). Every zod bump must regenerate the card (`pnpm exec tsx server/mcp/views/app/build.ts`) and `shared/contracts/generated/contracts.schema.json` (`pnpm exec tsx shared/contracts/generate-schemas.ts > shared/contracts/generated/contracts.schema.json`); the tests fail on either when they are stale. See `ground-truth-app/PROJECT_MEMORY.md` Finding 17.
* **Override experiments: regenerate from `main`'s lockfile.** pnpm keeps an existing resolution while it still satisfies a caret range. A copy resolved from an experiment lockfile (for example `zod` 4.6.7), then reverted, still had 4.6.7 for some consumers (two copies). Start each candidate from the committed lockfile, and run the checks on an exact rsync of the repo before committing.
* **AppKit bundled dependencies can be missing after an install.** AppKit 0.89.0 ships `@databricks/sdk-genie`, `sdk-statementexecution` and `sdk-vectorsearch` as `bundledDependencies`. One fresh `/tmp` install (2026-10-29) left `node_modules/@databricks/appkit/node_modules/@databricks/` empty, so `server/lib/tracing/mlflowTraces.test.ts` failed with `Cannot find package '@databricks/sdk-statementexecution'` and "no tests". Fix: `rm -rf node_modules && pnpm install --frozen-lockfile --force`. If that still leaves it empty (seen 2026-10-29: every install after the first one from the same store), use a new store: `rm -rf node_modules && pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store-<n>`, with a new `<n>` for each fresh copy. Check: `ls node_modules/@databricks/appkit/node_modules/@databricks` lists all three before trusting a vitest result.

## Component tests (jsdom)

`vitest.config.ts` has two projects: `node` (every `*.test.ts`, including `client/src/theme/*`) and `client` (`client/**/*.test.tsx`, jsdom). The `client` project loads `client/src/test/setup.ts` (jest-dom matchers, `vitest-axe` `toHaveNoViolations`, `matchMedia` / `ResizeObserver` stubs, `cleanup`) and inlines `@databricks/appkit-ui`, whose ESM build imports `echarts-for-react/esm/core` without an extension (Node's resolver rejects it; Vite does not). `client/src/test/vitest-axe.d.ts` declares the axe matcher for vitest 4 (vitest-axe 0.1.0 only augments the legacy `Vi` namespace). `client/src/test/smoke.test.tsx` is the reference test. Run one project with `pnpm exec vitest run --project client`.

## Evidence (2026-10-24, temp copy of `ground-truth-app` at `0741bc7`)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Done in 9.6 s |
| `pnpm exec vitest run` | 21 files, 331 tests passed (3.8 s) |
| `tsc -b tsconfig.server.json` / `tsconfig.client.json` | exit 0 / exit 0 |
| `pnpm list @modelcontextprotocol/sdk zod` | sdk 1.32.1, zod 4.3.6 |
| `pnpm audit` | 42 vulnerabilities: 1 critical, 17 high, 18 moderate, 6 low |
| `pnpm add @modelcontextprotocol/ext-apps` (latest) | 2.0.3, peers `@modelcontextprotocol/core`, `client`, `server` `^2.0.0` (MCP TypeScript SDK v2 split packages): unmet with sdk 1.x |
| `@modelcontextprotocol/ext-apps@1.7.5` peers | `@modelcontextprotocol/sdk ^1.29.0`, `zod` 3.25+ or 4, React 17-19: compatible with the current app |
| `pnpm add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vitest-axe msw` | Resolved (16.3.3, 14.6.8, 7.0.1, 30.1.3, 0.1.0, 3.0.3); `pnpm peers check` flags msw and tailwindcss; 331 tests still pass |

Nothing from the experiment was committed; it ran in `/tmp/gt`.

## Evidence (2026-10-24, build-wave `genie_task`, session 26, job run `110489694161084`)

| Check | Result |
| --- | --- |
| Bootstrap (steps above) | 9 s; `node v22.16.0`, `npm 10.9.2`, `pnpm 11.0.8` |
| Network from the task | `pypi.org`, `nodejs.org/dist`, `registry.npmjs.org`: HTTP 200 |
| Baseline in `/tmp/gt-26` (main `f3583c3`) | frozen install 12.5 s; 21 files / 331 tests; both `tsc -b` exit 0; audit 1 critical, 17 high, 18 moderate, 6 low |
| Added | `@modelcontextprotocol/ext-apps` 1.7.5 (exact); dev `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.8, `@testing-library/jest-dom` 7.0.1, `jsdom` 30.1.3, `vitest-axe` 0.1.0 |
| Not added | `msw`: 3.x is an unmet peer of vitest 4's `@vitest/mocker` (`^2.4.9`); 2.x needs an install script (`ERR_PNPM_IGNORED_BUILDS`) |
| Audit fixes | `react-router` 7.18.0 -> 7.18.4; lockfile-only updates of `@grpc/grpc-js` 1.14.4 -> 1.14.6, `body-parser` 1.20.8 / 2.3.0 -> 1.20.9 / 2.4.0, `source-map-js` 1.2.1 -> 1.2.2 |
| After | audit 1 critical, 12 high, 18 moderate, 5 low; frozen install passes on the committed lockfile; 22 files / 333 tests (incl. 2 smoke component tests); both `tsc -b` exit 0 (with `shared/contracts` at HEAD; wave `4-0` session 25 was mid-edit) |
| Remaining high/critical | `dompurify` 3.4.11 and `js-yaml` 4.3.1 (exact pins in AppKit 0.84.0), `zod` 4.3.6 (exact pin in AppKit), `fast-uri` 3.1.0 and `@opentelemetry/propagator-jaeger` 2.8.0 (pinned by `pnpm-workspace.yaml` overrides `fast-uri` and `@opentelemetry/core`): all need `pnpm-workspace.yaml` override changes or an AppKit upgrade |
