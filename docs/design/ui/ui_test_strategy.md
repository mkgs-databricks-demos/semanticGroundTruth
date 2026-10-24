# UI test strategy — build 5 (testable by construction)

**Build 4 · wave `4-0` · session 32 · docs only.** Applies to every screen in [`screen_inventory.md`](screen_inventory.md). Hooks named here are written into the [`figma_make_brief.md`](figma_make_brief.md) prompts so the exported code already carries them.

## 1. Tooling (what build 5 can rely on)

| Need | Tool | Source |
|---|---|---|
| Runner | vitest 4 (`prebuild` runs `vitest run`, so a failing test fails the Apps deploy) | `ground-truth-app/package.json` |
| DOM | `jsdom` via a vitest project for `client/**/*.test.tsx`; `server/**` and `shared/**` stay `node` | session 26 (`vitest.config.ts`, `client/src/test/setup.ts`) |
| Render + queries | `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | session 26 |
| Accessibility | `vitest-axe`, or `axe-core` + a local `toHaveNoViolations` matcher if `vitest-axe` 0.1.0 does not work with vitest 4 | session 26 decides; tests import the matcher from `client/src/test/axe.ts` so either works |
| Network mocking | `msw` if session 26 added it (peer warning harmless); otherwise a `mockApi()` helper over `vi.stubGlobal('fetch')` | session 26 status file; §5 |
| Contract schemas | `ROUTE_CONTRACTS` + zod schemas in `shared/contracts/schemas.ts` | session 25 |
| Static guards (keep) | `client/src/theme/contrast.test.ts` (token contrast per mode), `client/src/theme/a11y-static.test.ts` (no palette classes, no unlabeled buttons, no `outline-none` without a ring) | build 3 |

Assumption: sessions 25 and 26 land as planned. If session 26 leaves `msw` or the axe matcher out, the harness session (build 5, §9) uses the fallbacks above; no test below changes.

## 2. Query priority (Testing Library)

Tests find elements the way a user or assistive technology does. In order:

1. `getByRole(role, { name })`: buttons, links, headings, tabs, radios, switches, dialogs, tables, rows, progressbar, meter, status, alert, log.
2. `getByLabelText`: form fields (every input has a visible label; the brief requires it).
3. `getByText`: static copy that has no role (empty-state descriptions, helper text).
4. `getByTestId`: only for non-semantic hooks: a container with no role (`review-card-root`), one of many similar rows (`steward-queue-row` + `data-asset-id`), a count that is part of a larger label (`shell-bell-count`), or an element whose accessible name changes with state (`shell-theme-toggle`).

A test that uses `getByTestId` where a role query would work is a review defect. Never query by class name or DOM structure.

## 3. `data-testid` naming

* Format: `<page>-<component>-<element>`, kebab-case, all lower case. `<page>` is the route slug from the inventory (`review`, `leaderboard`, `assistant`, `steward`, `executive`, `admin`, `settings`; the three new steward screens use the short page prefixes `steward-queue`, `steward-conflicts`, `steward-branches`; global chrome uses `shell`; fallbacks `not-found`, `app-error`).
* Variable identity goes in a `data-*` attribute, never in the test id: `data-testid="steward-queue-row" data-asset-id="…"`, `data-testid="review-skip-reason-option" data-reason="not_my_area"`.
* Test ids are part of the UI contract: renaming one is a breaking change and needs the test updated in the same commit. The full list per screen is in the brief's "Keep:" lines; build 5 copies them into a `client/src/test/testids.ts` constant map so tests and components import the same strings.
* The static guard in `a11y-static.test.ts` is extended to fail on a `data-testid` that does not match `^[a-z]+(-[a-z0-9]+)+$`.

## 4. Test layout

* One file per screen: `client/src/pages/<page>/<Page>.test.tsx` (new steward screens: `client/src/pages/steward/<Screen>.test.tsx`). One `describe` per state, one `it` per behaviour.
* Every state test ends with the axe check on the rendered container: `expect(await axe(container)).toHaveNoViolations()`. Disable no rule globally; a rule disabled for one test needs a comment with the reason and is listed as a suppression in the session status file.
* Shared harness in `client/src/test/` (build 5 harness session): `renderWithProviders(ui, { route, me, settings, theme })` wraps `QueryClientProvider` (retry off), `MemoryRouter`, `ThemeProvider` (`next-themes`, `attribute="class"`), and `MotionConfig`; `fixtures.ts` (the brief §1.1 sample data, typed with the contract types); `mockApi.ts` (§5); `axe.ts`; `testids.ts`; `keyboard.ts` (helpers like `pressKeys('A')`).

## 5. Mocking `fetch` from the plan-25 schemas

Goal: fixtures cannot drift from the API.

* `mockApi({ 'GET /api/review/next': fixtures.card, 'POST /api/review/skip': fixtures.skipResponse, … })` registers handlers (MSW `http.get/post` or a `fetch` stub) keyed by the exact `method path` strings in `ROUTE_CONTRACTS`.
* On registration, every fixture is parsed with that route's `response` schema; a fixture that fails parsing throws, so a contract change breaks the fixture, not production.
* Every request the component sends is parsed with the route's `request` / `query` / `params` schema; an invalid request fails the test (this is how "client no longer sends `voteType: 'skip'`" stays enforced).
* Error helpers: `mockApi.error('GET /api/review/next', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting')` returns the standard envelope; `mockApi.forbidden(route)` returns 403 `FORBIDDEN`; `mockApi.offline()` makes `fetch` reject with `TypeError('Failed to fetch')` and sets `navigator.onLine = false`; `mockApi.pending(route)` never resolves (loading state).
* Unhandled requests fail the test (`onUnhandledRequest: 'error'` in MSW, or the stub throws), so a screen cannot silently call a route nobody mocked.

## 6. Keyboard-only flows

Each flow uses `userEvent.keyboard` only (no clicks) and asserts focus with `toHaveFocus()`.

| Flow | Screen | Steps and assertions |
|---|---|---|
| K1 Review loop | S1 | Tab to the card area; `A` → `POST /api/review/vote` with `voteType:'approve'`, live region says "Approved Readmission Rate (30-day)", next card renders. `R` → Reject sheet open, focus in textarea, `Esc` closes and focus returns to Reject button. `E` → Edit sheet, Tab through 3 fields, submit sends `edits`. `S` → `POST /api/review/skip` with no `reason`, never `/vote`; counter increments from `SkipResponse.stats.skippedToday`. `Shift+S` then `2` → skip with `reason:'not_my_area'`. Arrow aliases (`→ ← ↑`) give the same calls. Shortcuts typed inside the Reject textarea do not vote. `?` opens the help dialog, `Esc` closes it. |
| K2 Steward resolve | S9 | `J`/`K` move the selected conflict group (`aria-selected`); `2` selects proposal 2 (radio checked); `Enter` sends `POST /api/steward/conflicts/:assetId/resolve` with `resolution:'accept_edit'` and that `voteId`; `X` opens the confirm `alertdialog` with focus on Cancel; `Enter` on "Reject all" sends `resolution:'reject_all'`; focus moves to the next group. |
| K3 Queue triage | S8 | `/` focuses search; `J`/`K` move row focus; `Enter` opens the detail sheet (focus trapped, `Esc` returns focus to the row); `C` on a row with `pendingEdits ≥ 2` navigates to `/steward/conflicts`. |
| K4 Branch review | S10 | `J`/`K`, `Enter` expands (`aria-expanded="true"`), `Y` copies (clipboard stub called with the branch name, toast), status buttons reachable by Tab, confirm dialog traps focus. |
| K5 Settings | S7 | Arrow keys change the Theme radiogroup and `<html>` gets/loses `class="dark"`; `Ctrl+S` sends `PUT /api/me/settings` with only the changed fields. |
| K6 Shell | S0 | First Tab focuses "Skip to content"; Enter moves focus to `<main>`; Tab order matches the brief; `Esc` closes the notification popover and returns focus to the bell. |

## 7. Light / dark visual-state checks

jsdom does not compute Tailwind/CSS cascade, so color correctness is tested in layers:

1. **Tokens** (exists): `contrast.test.ts` asserts every ui_brand_plan §7.1 pairing per mode from `tokens.ts`. Extend it with the vote and confidence tokens and the Figma `variables.json` comparison (every exported hex must equal a `tokens.ts` value; brief §3 step 4).
2. **Usage** (exists, extended): `a11y-static.test.ts` fails on Tailwind palette classes, inline hex outside the token files, and lucide imports other than the allowed `Sun`, `Moon`, `Monitor`, `Trophy`.
3. **Theme wiring** (new, per screen): render each screen's populated state twice with `renderWithProviders(ui, { theme: 'light' | 'dark' })`; assert `document.documentElement.classList.contains('dark')` matches, the Databricks symbol `src` swaps (`databricks-symbol-color.svg` ↔ `databricks-symbol-light.svg`), empty-state primary icons swap navy ↔ white, and axe passes in both. Settings `theme` from `GET /api/me/settings` seeds the provider (test with `system` + a `matchMedia` stub).
4. **Reduced motion** (new): with `motion:'reduce'` (or `matchMedia('(prefers-reduced-motion: reduce)')` true) the card has no drag handlers and votes apply without exit animation; with `motion:'full'` and an OS reduce preference, reduced motion still wins.
5. **Pixel comparison** is manual: the converge session compares deployed screenshots against `docs/design/ui/figma/<slug>/*.png` side by side and records differences in its summary. No screenshot-diff tooling is added in build 5.

## 8. Screen × state test matrix

Every row is at least one automated test (Testing Library + axe). `KB` = keyboard flow from §6. States match the inventory §5 table.

| Screen | State | Test (`describe` → key assertions) |
|---|---|---|
| S0 Shell | populated | nav links by role per role set (reviewer: 3 items; steward: +Steward, Executive; admin: +Admin); bell name "Notifications (2 unread)" |
| S0 | loading | role-gated items are skeletons until `GET /api/me` resolves |
| S0 | notifications-empty | popover text "You're all caught up" |
| S0 | notifications-error | bell still focusable, tooltip text |
| S0 | offline | `role="status"` banner text |
| S0 | keyboard | KB K6 |
| S1 Review | loading | `review-card-root` absent, skeleton present, vote buttons absent |
| S1 | populated | heading "Readmission Rate (30-day)"; meter "Confidence 71%"; progressbar "Review progress 42 of 120"; 4 vote buttons by name |
| S1 | approve / reject / edit | request bodies parsed by `VoteBody`; sheets for reject and edit; live region text |
| S1 | skip | `POST /api/review/skip` only, no `/vote`; counter `review-skip-counter` = `skippedToday`; toast text with cooldown hours |
| S1 | skip-reason | picker has 4 radios/options from `SKIP_REASONS`; choosing sends `reason` |
| S1 | resurfaced | badge "You skipped this earlier" when `resurfacedFromSkip` |
| S1 | empty | `review-empty-root`, buttons "Switch campaign" (with campaign filter) / "View leaderboard" |
| S1 | session-complete | after `cardsPerSession` votes+skips the panel shows; "Keep going" resumes |
| S1 | error | `GET /api/review/next` 503 → alert with message, Retry refetches (F3 regression test: empty state NOT shown) |
| S1 | vote-error | vote 500 → card still shown, toast |
| S1 | offline | vote buttons disabled with reason; no request sent on `A` |
| S1 | keyboard | KB K1 |
| S2 Leaderboard | loading / populated | 5 skeleton rows; current-user row has "You"; medals have `aria-label`; skipped stat present, not a sortable/rank column |
| S2 | empty | `leaderboard-empty-root`, "Start reviewing" link to `/` |
| S2 | error / offline | alert + Retry; offline note |
| S2 | tabs | arrow keys change period; request query `period=30d` parsed by `LeaderboardQuery` |
| S3 Assistant | empty | 3 starter prompt buttons; clicking one sends it |
| S3 | populated / streaming | `role="log"` contains messages with `data-role`; input disabled while streaming (agents hook mocked at module level) |
| S3 | error / no-agent / offline | alert + Try again; no-agent copy; input disabled |
| S4 Steward | loading / populated (3 tabs) | tabs by role; campaign rows; assets table paging; metric view validate shows result |
| S4 | empty (per tab) | each empty-state CTA by name |
| S4 | error | per-tab alert; other tabs still usable |
| S4 | forbidden | reviewer `me` → `steward-forbidden-root`, no steward requests sent; F4 regression: `GET /api/me` 500 shows error, not forbidden |
| S4 | offline | write buttons disabled |
| S4 | import wizard | step navigation, scan pending, partial failure list, `ImportAssetsBody` request parse |
| S5 Executive | loading / populated | 6 KPI groups by label; dashboard link name includes "opens in a new tab" |
| S5 | empty / dashboard-unconfigured | `totalAssets 0` copy; `executive_dashboard_url: null` → no link |
| S5 | error / forbidden / offline | as S4 |
| S6 Admin | loading / populated | three groups; scoring fields by label incl. "Skip cooldown (hours)" |
| S6 | validation | 900 hours → inline error, no request |
| S6 | last-admin conflict | DELETE 409 `CONFLICT` → inline alert |
| S6 | empty-group / error / forbidden / offline | copy; alert; `admin-forbidden-root`; disabled |
| S7 Settings | loading / populated / defaults | radiogroups checked from fixture; "Using defaults" note when the API returns defaults |
| S7 | dirty / saving / saved | footer appears; `PUT /api/me/settings` body parsed by `UpdateUserSettingsRequest` contains only changed fields; toast |
| S7 | validation | cards per session 150 → inline error, no request |
| S7 | error / offline | load alert + Retry; form disabled, theme still switches |
| S7 | keyboard / theme | KB K5; §7 theme wiring |
| S8 Feedback queue | loading / populated | rows with `data-asset-id`; vote bar accessible name; "Often skipped" badge rule |
| S8 | empty / filtered-empty | CTA; Clear filters restores rows |
| S8 | error / forbidden / offline | standard |
| S8 | keyboard | KB K3 |
| S9 Conflicts | loading / populated | current + proposals; `<ins>`/`<del>` present; radiogroup name |
| S9 | resolving / resolved | buttons disabled during request; group removed; toast names authors |
| S9 | stale | resolve 409/404 → alert + Refresh refetches |
| S9 | empty / error / forbidden / offline | standard |
| S9 | keyboard | KB K2 |
| S10 Feedback branches | loading / populated | 3 cards; status badge text (not color only); expand shows files |
| S10 | status change | `POST …/:batchId/status` body parsed by `UpdateFeedbackBranchStatusRequest`; confirm for rejected |
| S10 | failed-branch / empty / error / forbidden / offline | standard |
| S10 | keyboard | KB K4 |
| S11 Fallbacks | not-found / app-error | heading by role; Reload button; stack hidden until disclosure opened |

## 9. What stays manual

Recorded by the build-5 converge session in its summary, against the deployed app (`dev-semantic-ground-truth`):

* **Lighthouse accessibility** ≥ 95 on `/`, `/leaderboard`, `/steward`, `/settings`, light and dark (ui_brand_plan §9 target; never run so far).
* **Screen reader pass** (VoiceOver on macOS Safari or NVDA on Firefox): K1 review loop and K2 resolve, listening for the live-region announcements and diff `<ins>`/`<del>`.
* **Keyboard-only walk-through** of all screens on the deployed app (the automated K flows cover logic; this catches real focus-ring visibility and scroll issues).
* **Windows High Contrast / forced colors**: cards, inputs and focus rings stay visible.
* **Visual comparison** against the Figma export (§7.5).
* **Mobile**: 390 px viewport, swipe gestures on a touch device.

## 10. Gate for build 5

A build-5 UI session passes only if: every row of §8 for its screens exists and passes, axe passes in every state, both `tsc -b` pass, and `vitest run` passes in its `/tmp/gt-<id>/` copy (build conventions §0). The converge session adds the manual §9 results to its summary; missing manual results make its status `fail`, not `pass`.
