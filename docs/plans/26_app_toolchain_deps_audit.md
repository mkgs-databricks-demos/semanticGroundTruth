# Session 26: Node toolchain proof, new dependencies, security audit

**Build 4 · wave `4-0` · edit · app**

## Scope

Prove the Node/pnpm runbook works inside a build-wave `genie_task`, add the dependencies build 4 and build 5 need (MCP Apps SDK, render-level UI testing), fix the high/critical `pnpm audit` findings that semver-compatible updates can fix, and configure vitest so client component tests run in jsdom. Sole owner of `package.json` and `pnpm-lock.yaml` in this build.

## Context

* Runbook: [docs/runbooks/node_toolchain_genie_code.md](../runbooks/node_toolchain_genie_code.md). Re-verified interactively on 2026-10-24 (8 s bootstrap, frozen install 9.6 s, 331 tests, both `tsc -b` clean). Not yet proven inside a `genie_task`; that is the first thing this session records.
* Resolution experiment (2026-10-24, `/tmp/gt`, not committed): `@modelcontextprotocol/ext-apps` latest is 2.0.3 and needs MCP TypeScript SDK v2 (`@modelcontextprotocol/core|client|server ^2`); **1.7.5** needs `@modelcontextprotocol/sdk ^1.29` (app has 1.32.1). Dev deps `@testing-library/react 16.3.3`, `@testing-library/user-event 14.6.8`, `@testing-library/jest-dom 7.0.1`, `jsdom 30.1.3`, `vitest-axe 0.1.0`, `msw 3.0.3` resolved; `pnpm peers check` flagged `msw` and `tailwindcss`.
* `pnpm audit` on `main` (0741bc7): 42 findings, 1 critical, 17 high, 18 moderate, 6 low. GitHub Dependabot reported 35 alerts (14 high) on the default branch.
* `vitest.config.ts` excludes `**/.venv/**` (Apps container venv). `package.json` `prebuild` = `pnpm run sync && appkit generate-types --wait && vitest run`, so every Apps build runs the tests and a failing test fails the deploy.
* AppKit is pinned at `0.84.0` (`@databricks/appkit`, `@databricks/appkit-ui`). Do not change AppKit or React major versions in this session.

## Tasks

1. Bootstrap per the runbook. Record in your status file `notes`: `node --version`, `pnpm --version`, bootstrap seconds, and whether `pip`/`nodejs.org`/npm registry were reachable from the task. If bootstrap fails, stop as `blocked` with the exact error (this is the runbook's open question).
2. Work in `/tmp/gt-26/` (copy of `ground-truth-app/` without `node_modules`, `.venv`, `dist`, `.databricks`). Baseline: `pnpm install --frozen-lockfile`, `vitest run`, `tsc -b tsconfig.server.json`, `tsc -b tsconfig.client.json`; record counts.
3. Add dependencies:
   * runtime: `@modelcontextprotocol/ext-apps@1.7.5` (exact pin).
   * dev: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, an axe matcher (`vitest-axe`, or `axe-core` + a small local matcher if `vitest-axe` 0.1.0 does not work with vitest 4), `msw` only if its peer warning is harmless with the installed TypeScript (else leave it out and note why; session 35 can mock `fetch` directly).
4. Audit: `pnpm audit --json`; apply fixes that stay within the current major versions (`pnpm update <pkg>` or `pnpm.overrides` for transitive packages). Do not take a major upgrade of AppKit, React, Vite/rolldown-vite, Tailwind, express or the MCP SDK. Record before/after counts by severity and list every remaining high/critical with the reason it was not fixed.
5. vitest: split into projects so `server/**` and `shared/**` keep the `node` environment and `client/**/*.test.tsx` runs in `jsdom` with a setup file `client/src/test/setup.ts` (jest-dom matchers, axe matcher, `matchMedia` and `ResizeObserver` stubs). Add one smoke component test `client/src/test/smoke.test.tsx` that renders `ErrorBoundary` and passes an axe check, to prove the setup.
6. Re-run the frozen install, `vitest run` and both `tsc -b` in `/tmp/gt-26/`. Only if all pass, copy `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` and the new test files into the repo. Check `git status` shows no `node_modules/`.
7. Update the runbook's "Still to prove" line and evidence table with the `genie_task` result.

## Acceptance Criteria

- [ ] Status `notes` include the in-task bootstrap evidence (versions + timing).
- [ ] `package.json` has `@modelcontextprotocol/ext-apps` `1.7.5` and the test dev dependencies; `pnpm install --frozen-lockfile` passes on the committed lockfile.
- [ ] `vitest run` passes with at least the 331 existing tests plus the smoke component test; both `tsc -b` exit 0.
- [ ] High + critical audit findings reduced, with each remaining one listed and justified.

## Owned Paths

- `ground-truth-app/package.json`
- `ground-truth-app/pnpm-lock.yaml`
- `ground-truth-app/vitest.config.ts`
- `ground-truth-app/client/src/test/**`
- `docs/runbooks/node_toolchain_genie_code.md`

## Dependencies

- None (wave `4-0`). Session 34 (MCP App) and build 5 (UI tests) depend on these packages.
