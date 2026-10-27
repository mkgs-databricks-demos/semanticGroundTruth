# Session 43: UI test harness

**Build 5 · wave `5-0` · edit (parallel)**

## Context

`docs/design/ui/ui_test_strategy.md` §1-§7 define the harness every build-5 UI session uses. Session 26 (build 4) added jsdom, Testing Library and `vitest-axe` 0.1.0; there is one smoke test (`client/src/test/smoke.test.tsx`). No new npm dependencies (session 45 owns `package.json`).

## Steps

1. `client/src/test/axe.ts`: export `expectNoAxeViolations(container)` (vitest-axe if it works with vitest 4.1.9, else `axe-core` from `vitest-axe`'s dependency + a local matcher). Rules: WCAG 2.1 A/AA; `color-contrast` disabled in jsdom (covered by `contrast.test.ts` and the Chromium job).
2. `client/src/test/render.tsx`: `renderWithProviders(ui, { route, roles, theme: 'light'|'dark', settings, online })` with QueryClient (no retries), memory router, theme provider (`next-themes`, `attribute="class"`), toast region. `renderInBothThemes(fn)` helper.
3. `client/src/test/mockApi.ts`: `mockApi({ 'GET /api/review/next': fixture, ... })` over `vi.stubGlobal('fetch')`. Every request body is parsed with the request schema and every fixture with the response schema from `ROUTE_CONTRACTS` (`shared/contracts/schemas.ts`); a mismatch throws. Records calls (`calls('POST /api/review/skip')`). Unknown routes fail the test.
4. `client/src/test/fixtures/`: one module per area (`me`, `review`, `leaderboard`, `steward`, `executive`, `admin`, `settings`, `feedbackQueue`, `conflicts`, `feedbackBranches`, `notifications`) using the sample data of `docs/design/ui/figma_make_brief.md` §1.1; each validated against its schema in a meta-test.
5. `client/src/test/keyboard.ts`: helpers for the K1-K6 flows (`pressKey`, `tabUntil(name)`, `expectFocusVisible`).
6. `client/src/test/online.ts`: toggle `navigator.onLine` + dispatch `online`/`offline`.
7. `client/src/theme/a11y-static.test.ts`: add **opt-in strict rules** for files whose first line is `// @a11y-strict` (build-5 sessions add the marker to every file they rewrite, so the rules ratchet without failing today's code): no `lucide-react` import; every `data-testid` matches the §3 naming regex; a page component under `pages/**` renders exactly one `<h1>`. Add a report-only test that prints the files under `pages/**` and `components/**` still missing the marker (session 60 requires that list to be empty).
   Fixtures for contract fields added in this wave by session 44 (`htmlUrl`, Slack share) are not added here; the consuming session adds them next to its tests.
8. Meta-tests (`client/src/test/harness.test.tsx`): mockApi rejects a bad fixture and a bad request body; renderWithProviders renders light and dark; axe helper flags a known violation.
9. Keep `smoke.test.tsx` passing. Run vitest + both `tsc -b` in `/tmp/gt-43/`.

## Acceptance

Meta-tests pass; every fixture validates; `vitest.config.ts` keeps `client/**/*.test.tsx` on jsdom and `server/**`, `shared/**` on node.

## Owned paths

* `ground-truth-app/client/src/test/**`
* `ground-truth-app/client/src/theme/a11y-static.test.ts`
* `ground-truth-app/vitest.config.ts`

## Dependencies

None.
