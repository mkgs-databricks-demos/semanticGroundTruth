# Build 5 outline — implement the Figma Make redesign (proposal)

**Build 4 · wave `4-0` · session 32 · docs only.** A proposal for the planner, not a `waves.json`. Session numbers start after build 4's last session (41). Inputs: [`screen_inventory.md`](screen_inventory.md), [`figma_make_brief.md`](figma_make_brief.md), [`ui_test_strategy.md`](ui_test_strategy.md), and the owner's export in `docs/design/ui/figma/`.

## Preconditions (blocking)

1. Build 4 merged: plan-25 contracts and `schemas.ts`, migration 009, session-26 toolchain (jsdom, Testing Library, axe), session-33 server routes (`/api/review/skip`, `/api/me/settings`, `/api/steward/*`).
2. The owner has committed the Figma Make export per brief §3 (`docs/design/ui/figma/{_code,<slug>/*.png,design-system/variables.json,README.md}`) and picked header variant A or B (D2).
3. `variables.json` matches `client/src/theme/tokens.ts` (checked by session 42; mismatches are export defects, fixed in Figma, not by adding tokens).

## Rules carried over

* Build conventions §0 (build 4) still apply: `/tmp/gt-<id>/` copies for the toolchain, only one session changes `package.json`, no `docs/plans/**` edits.
* Semantic tokens only; hex only in `tokens.ts`, `index.css`, `server/mcp/views/cardHtml.ts`.
* Port the Figma code into `client/src/**`; never import from `docs/`.
* Each UI session ships its screen's tests from `ui_test_strategy.md` §8 in the same session (no "tests later").
* The skip-as-vote fix and the settings types from build 4 are kept; build 5 changes presentation, not contracts. A contract gap found during build 5 (e.g. a `FeedbackBranch` repo URL) is recorded as a `request`, not patched in a UI session.

## Proposed sessions

| Wave | Session | Title | Mode | Owned paths | Depends on |
|---|---|---|---|---|---|
| 5-0 | 42 | Design-system port: tokens diff, icon download, primitives | edit | `client/src/theme/**`, `client/src/components/ui-brand/**` (new: `Icon`, `EmptyState`, `StatusBadge`, `VoteButton`, `Segmented`, `KpiCard`, `PageHeader`), `client/public/brand/icons/**`, `src/notebooks/download_brand_assets*` | — |
| 5-0 | 43 | Test harness | edit | `client/src/test/**` (`renderWithProviders`, `mockApi` over `ROUTE_CONTRACTS`, `fixtures.ts` from brief §1.1, `axe.ts`, `testids.ts`, `keyboard.ts`), `client/src/theme/a11y-static.test.ts` (test-id regex, lucide allow-list) | — |
| 5-1 | 44 | Shell + settings plumbing | edit | `client/src/components/layout/**`, `client/src/App.tsx`, `client/src/lib/settings/**` (seed `next-themes` + `MotionConfig` from `GET /api/me/settings`), `ErrorBoundary`, NotFound | 42, 43 |
| 5-2 | 45 | Review screen | edit | `client/src/pages/review/**`, `client/src/components/review/**` | 44 |
| 5-2 | 46 | Settings screen | edit | `client/src/pages/settings/**`, `client/src/components/settings/**`; removes `NotificationPrefsForm` from Admin (F8) | 44 |
| 5-2 | 47 | Leaderboard + Assistant | edit | `client/src/pages/{leaderboard,agents}/**`, `client/src/components/leaderboard/**` | 44 |
| 5-2 | 48 | Steward console + Executive + Admin | edit | `client/src/pages/{steward/StewardPage*,executive,admin}/**`, `client/src/components/{steward,executive,admin}/**` (excluding the three new screens) | 44 |
| 5-3 | 49 | Steward triage: Feedback queue + Conflicts + Feedback branches | edit | `client/src/pages/steward/{FeedbackQueue,Conflicts,FeedbackBranches}*`, `client/src/components/steward/triage/**`, `client/src/lib/api/{endpoints,hooks}.ts` (steward triage hooks only) | 44, 48 (sub-nav) |
| 5-4 | 50 | Converge: build, deploy, manual checks | converge | `docs/sessions/**`, `.build-status/**` | 45-49 |

Wave 5-2 runs four sessions in parallel; their owned paths do not overlap (the shared `lib/api/hooks.ts` is touched only by 49, which runs after them). If parallel sessions need a new shared primitive, they record a `request` for session 42's owner instead of adding it locally.

## Per-session acceptance (summary)

* **42:** every token in `variables.json` equals `tokens.ts`; extended `contrast.test.ts` passes (vote + confidence tokens); every icon in brief §4 is in `client/public/brand/icons/` with its source attachment id in a manifest; `Icon` renders `currentColor`; no runtime CDN URL in `client/**`.
* **43:** `mockApi` rejects a fixture that fails its response schema and a request that fails its request schema (meta-tests); `renderWithProviders` renders light and dark; smoke test from session 26 still passes.
* **44:** S0 and S11 rows of the test matrix; F2 (one `<h1>` per page), F6/F7 (icons, underline active), F9 (settings-seeded theme), skip link, offline banner.
* **45:** all S1 rows incl. KB K1; F3 regression; `CardStack` never posts `voteType:'skip'`; reduced-motion test; session-complete uses `cardsPerSession`.
* **46:** all S7 rows incl. KB K5; Admin no longer renders notification preferences.
* **47:** all S2 and S3 rows; Assistant copy no longer shows file paths (F10).
* **48:** all S4, S5, S6 rows; F4 regression (error vs forbidden) on all three pages; skip-cooldown field.
* **49:** all S8, S9, S10 rows incl. KB K2-K4; steward sub-nav badges from the three list endpoints.
* **50:** `bundle deploy` + app runtime gate clean; manual checks from `ui_test_strategy.md` §9 recorded (Lighthouse ≥ 95 light and dark on 4 routes, screen-reader pass, keyboard walk-through, forced colors, Figma comparison, mobile); session summary in `docs/sessions/`.

## Open questions for the planner

1. **Header variant (D2):** A (Oat Light / Gray Navigation, default) or B (Navy 800 band in light mode). Owner records it in the export README.
2. **Feedback branch link:** `FeedbackBranch` has no repo URL. Add `htmlUrl` to the contract in a build-5 contract session, or keep copy-to-clipboard only.
3. **Notification channels:** Settings shows Slack / Teams / webhook disabled ("Coming later") because G5 is deferred; revisit after session 30's Slack MCP research.
4. **Bundle size:** framer-motion + new icons + diff rendering; set a budget (e.g. main chunk ≤ 350 kB gzip) and lazy-load steward/admin/executive routes (L200-C3 resolved question 1 already assumes code splitting).
5. **MCP App card (session 34) parity:** reuse the build-5 review card primitives in the MCP App view, or keep `cardHtml.ts` separate. Decide after session 31's design doc.
