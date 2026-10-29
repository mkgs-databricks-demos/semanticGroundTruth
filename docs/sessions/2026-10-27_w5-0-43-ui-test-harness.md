# Session 43: UI test harness (build 5, wave 5-0)

* **Date:** 2026-10-27
* **Mode:** edit (parallel), job run `229891579528310`, branch `mg-genie-build-5`
* **Plan:** `docs/plans/build-5/43_ui_test_harness.md`, scope `ui_test_strategy.md` §1-§7 with meta-tests; opt-in `@a11y-strict` rules; no new dependencies
* **Status:** pass

## What was built

Shared harness in `ground-truth-app/client/src/test/` that every build-5 UI session imports.

| File | Purpose |
|---|---|
| `axe.ts` | `expectNoAxeViolations(container, { disableRules? })` and a configured `axe`. vitest-axe 0.1.0 works with vitest 4.1.9 (session 26 smoke test), so it wraps `configureAxe`; no local matcher needed. Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`; `color-contrast` off globally (jsdom has no CSS; covered by `contrast.test.ts` and the Chromium job). |
| `render.tsx` | `renderWithProviders(ui, { route, path, roles, me, settings, theme, online, reducedMotion, queryClient })`: ThemeProvider (next-themes, `attribute="class"`, storage key `sgt-theme` as in `main.tsx`) > MotionConfig > QueryClientProvider (no retries) > MemoryRouter, plus an empty toast live region (`shell-toast-region`). Returns `user`, `queryClient`, `api`. `renderInBothThemes(fn)` runs light then dark with cleanup in between. `roles` / `me` / `settings` register `GET /api/me` and `GET /api/me/settings` on the active mock. |
| `mockApi.ts` | `mockApi({ 'METHOD /path': fixture \| fn })` over `vi.stubGlobal('fetch')`. Keys must be `ROUTE_CONTRACTS` keys. Fixtures are parsed with the route's response schema at registration (function handlers when called); each request's params, query and body are parsed with the route's schemas; a body or query sent to a route that declares none fails; unknown routes and unmocked routes fail. Helpers: `error(key, status, code, message)`, `forbidden(key)`, `pending(key)`, `offline()` / `online()`, `calls(key)`, `takeProblems()`. Request failures reject the fetch and are recorded; an `afterEach` fails the test if any are left (React Query would otherwise swallow them). Real fetch restored after each test. |
| `fixtures/` | One module per area: `me`, `review`, `leaderboard`, `steward`, `executive`, `admin`, `settings`, `feedbackQueue`, `conflicts`, `feedbackBranches`, `notifications` (+ `ids.ts`, `index.ts`). Brief §1.1 sample data, typed with the contract types, UUID ids so requests built from fixtures pass request validation. Each exports `<area>Routes` for `mockApi`; `FIXTURE_ROUTES` lists them for the meta-test. |
| `keyboard.ts` | `pressKey(user, 'Shift+S')`, `pressKeys`, `toKeyboardSyntax`, `tabUntil(user, name)` (uses Testing Library's accessible-name computation via `getRoles` + `queryAllByRole`; failure message lists the focus order), `expectFocusVisible(el)`. |
| `online.ts` | `setOnline(bool)` (defines `navigator.onLine`, dispatches `online`/`offline` in `act`), `setInitialOnline`, `resetOnline` (auto after each test). |
| `media.ts` | `stubMatchMedia({ prefersDark, prefersReducedMotion, queries })` for strategy §7.3 (theme `system`) and §7.4 (reduced motion); restored after each test. Not named in plan step list but needed by strategy §7.3/§7.4 and kept small. |
| `harness.test.tsx` | 60 meta-tests (below). |

`client/src/theme/a11y-static.test.ts` (additive only, 117 lines, existing rules a-c unchanged):

* **(d) opt-in strict rules** for non-test `.tsx` under `pages/**` / `components/**` whose first line is `// @a11y-strict`: (d1) no `lucide-react` import; (d2) every literal `data-testid` matches `^[a-z]+(-[a-z0-9]+)+$`, and a template literal with `${}` is a violation (variable identity goes in a `data-*` attribute, §3); non-literal expressions such as a constants map are allowed; (d3) a page under `pages/**` has exactly one literal `<h1>` (keep the heading outside loading/error branches). A self-test checks each rule helper.
* **(e) report-only** test: the count of files still missing the marker is in the test name (visible even with `silent: 'passed-only'`), the list goes to stdout. Today: 41 of 41 files at HEAD (more once session 42's `components/ui/**` lands). Session 60 makes it a hard check.

`vitest.config.ts` unchanged: it already keeps `client/**/*.test.tsx` on jsdom and `server/**`, `shared/**` (all `*.test.ts`) on node.

## Checks

All in `/tmp` copies with the Node toolchain of `docs/runbooks/node_toolchain_genie_code.md` (node 22.16.0, pnpm 11.0.8, `pnpm install --frozen-lockfile`).

| Check | Where | Result |
|---|---|---|
| Baseline vitest | `/tmp/gt-43` (tree at start) | 932/932 |
| vitest (full) | `/tmp/gt-43c` = `git archive HEAD` + session 43 files | **994/994 pass** (38 files) |
| `tsc -b tsconfig.server.json` | same | pass (exit 0) |
| `tsc -b tsconfig.client.json` | same | pass (exit 0) |
| Meta-tests `harness.test.tsx` | same | 60/60 |
| `a11y-static.test.ts` | same | 125/125 |
| Strict rules fire (negative test) | `/tmp/gt-43` with a temporary marked `pages/zz/BadPage.tsx` (lucide import, `BadId`, interpolated id, two `<h1>`) + `GoodPage.tsx` | 3 expected failures on BadPage (d1, d2 with both id errors, d3), GoodPage passes; temp files removed |
| Fixture drift caught | `/tmp/gt-43` with leaderboard rank 0 | fixture meta-test fails as intended; restored |
| Against the live working tree (all wave 5-0 sessions in progress) | `/tmp/gt-43w` | both `tsc -b` pass; harness + a11y tests pass; 4 failures all in session 44's in-progress contract work (generated `contracts.schema.json`, contract `manifest.json`, route count 50, `stewardService` upsert), not in session 43 files |

Meta-tests cover: every fixture validates (11 areas, 28 route fixtures) and uses the brief values; mockApi rejects a bad fixture, an unknown key, a bad request body (`voteType: 'skip'` to `/vote`), a body to a route with no request schema, a bad query, bad path params, an uncontracted path and an unmocked route, and a bad function-handler body; serves fixtures with the contract status and records calls; static paths win over `:param` routes; `error()` envelope becomes `ApiError` through the real `lib/api` client; `forbidden`, `pending`, `offline`/`online`; renderWithProviders in light and dark (html `dark` class, `useTheme` value, axe in both), `system` theme following `prefers-color-scheme`, `settings`, route `path` + `useParams`, toast region, `online: false`; axe flags `image-alt` / `button-name`, passes good markup, `disableRules`; keyboard syntax, `tabUntil` + `pressKey`, `tabUntil` failure message, `expectFocusVisible` failing on bare `outline-none`; `setOnline` events and reset.

## Decisions and notes

* **Session 44 contract fields (plan conflict, recorded as an assumption).** Plan 43 says the `htmlUrl` / Slack-share fixtures are added by the consuming session. But plan 44 makes `FeedbackBranch.htmlUrl` and `AppRuntimeConfig.slackShareEnabled` **required**, and the wave gate runs vitest + `tsc -b` on the merged tree, so fixtures without them would fail the 5-0 gate. Following the runner rule for parallel dependencies (code against the documented signature), the two fields are spread into the fixtures (`branchLink()` in `feedbackBranches.ts`, `SLACK_SHARE` in `executive.ts`). Spread properties are not excess-property checked and zod strips unknown keys on the old schema, so the fixtures compile and validate both at HEAD and with session 44's contract (verified in both copies). No Slack share route fixtures were added; session 50 adds them.
* **Toast region.** Session 42's `components/ui/Toast.tsx` is a controlled `ToastRegion` (`role="status"`) rendered by screens with `useToasts()`. The harness region is a separate empty `role="region"` ("Toast notifications") so it never collides with `getByRole('status')`; screens render their own `ToastRegion`.
* **`testids.ts`** (strategy §4) is not in plan 43's step list; not added. The (d2) rule allows constant-map expressions so it can be introduced later.
* **Request validation mirrors the server** (same zod schemas, non-strict): unknown query keys or body keys pass, as they do on the server. Schemas that are `.strict()` (e.g. `UpdateUserSettingsRequest`) stay strict.
* `color-contrast` is the only globally disabled axe rule; it is listed in `AXE_GLOBALLY_DISABLED_RULES` with the reason.

## Files changed

* `ground-truth-app/client/src/test/axe.ts` (new)
* `ground-truth-app/client/src/test/render.tsx` (new)
* `ground-truth-app/client/src/test/mockApi.ts` (new)
* `ground-truth-app/client/src/test/keyboard.ts` (new)
* `ground-truth-app/client/src/test/online.ts` (new)
* `ground-truth-app/client/src/test/media.ts` (new)
* `ground-truth-app/client/src/test/harness.test.tsx` (new)
* `ground-truth-app/client/src/test/fixtures/{ids,index,me,review,leaderboard,steward,executive,admin,settings,feedbackQueue,conflicts,feedbackBranches,notifications}.ts` (new)
* `ground-truth-app/client/src/theme/a11y-static.test.ts` (strict rules + report)

## Requests

* Session 44 / integrator: when session 44's contract lands, regenerate `shared/contracts/generated/contracts.schema.json` and `tests/contract/manifest.json` (seen stale in the live tree during this session; session 44's own work).
* Build-5 UI sessions: start each rewritten file with `// @a11y-strict`; use `renderWithProviders`, `mockApi` + `fixtures`, `expectNoAxeViolations` from `client/src/test/`.

## Suppressions

None.
