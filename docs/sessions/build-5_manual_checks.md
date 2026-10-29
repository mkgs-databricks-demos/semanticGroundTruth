# Build 5 manual checks (owner worksheet, prerequisite `M5`)

**Written by:** session 63 (wave `5-10`, run `229891579528310`, 2026-10-28). **Read by:** session 64 (wave `5-11`).
**App:** `dev-semantic-ground-truth` (deployment of record `01f1d3145f051b5fbddf309e716f8304`, the session 62 deployment that passed `ui_visual_checks` 44/44). Check against the deployment that is live when you test, and write its id here: `__________`.
**Sources:** `docs/design/ui/ui_test_strategy.md` §9 (what stays manual), §6 (keyboard flows K1-K4), owner decision D-B5-2 (`docs/plans/build-5/build_conventions.md` §2), follow-up 11 (`docs/requests/2026-10-27_build-4-follow-ups.md`), session 62 summary (Figma similarity).

## How to fill it in

* Fill **every** `result` cell with `pass`, `fail` or `n/a`. Wave `5-11` stops as `blocked` while any `result` cell is blank.
* Use `notes` for scores, the browser / assistive technology used, and what you saw. For a `fail` you accept for now, write `accept: <reason>` in `notes` (session 64 then files a follow-up instead of failing).
* Theme `light` / `dark` means the in-app theme (Settings > Appearance); `any` means one theme is enough.
* Push the filled file to `mg-genie-build-5`, then start a **new** build run with `only` = the `w5-11_*` task keys (a repair does not re-run a finished iteration).

Prerequisites: reconnect `system.ai.slack` in Catalog Explorer (needed for the Slack rows), and accept the new app consent once (build 5 added the `ai-gateway` user scope; see `docs/runbooks/deploy_order_and_permissions.md`).

## 1. Lighthouse accessibility (target ≥ 95)

Chrome DevTools > Lighthouse > Accessibility, desktop. Put the score in `notes`.

| check | route | theme | result | notes |
|---|---|---|---|---|
| Lighthouse accessibility ≥ 95 | `/` | light | | |
| Lighthouse accessibility ≥ 95 | `/` | dark | | |
| Lighthouse accessibility ≥ 95 | `/leaderboard` | light | | |
| Lighthouse accessibility ≥ 95 | `/leaderboard` | dark | | |
| Lighthouse accessibility ≥ 95 | `/steward` | light | | |
| Lighthouse accessibility ≥ 95 | `/steward` | dark | | |
| Lighthouse accessibility ≥ 95 | `/settings` | light | | |
| Lighthouse accessibility ≥ 95 | `/settings` | dark | | |

## 2. Screen reader (K1, K2)

VoiceOver on macOS Safari or NVDA on Firefox. Listen for the live-region announcements and, in K2, the diff `<ins>` / `<del>` text (`ui_test_strategy.md` §6).

| check | route | theme | result | notes |
|---|---|---|---|---|
| K1 review loop: approve (`A`) is announced ("Approved ..."), the next card is read | `/` | any | | |
| K1 review loop: reject sheet (`R`) opens with focus in the textarea, `Esc` returns focus | `/` | any | | |
| K1 review loop: skip with a reason is announced; resurfaced badge is read | `/` | any | | |
| K2 steward resolve: `J`/`K` selection and proposal radios are announced | `/steward/conflicts` | any | | |
| K2 steward resolve: proposed edit diff reads as inserted / deleted text | `/steward/conflicts` | any | | |
| K2 steward resolve: `Enter` resolve result is announced | `/steward/conflicts` | any | | |

## 3. Keyboard-only walk-through (all screens)

No mouse. Every control reachable with Tab / Shift+Tab, the focus ring is visible on every stop, nothing scrolls the focused element out of view, dialogs trap and return focus.

| check | route | theme | result | notes |
|---|---|---|---|---|
| Keyboard walk-through (S0 shell, skip link, nav, bell, theme toggle) | `/` | any | | |
| Keyboard walk-through (S1 Review, K1) | `/` | any | | |
| Keyboard walk-through (S2 Leaderboard, period tabs, table scroller) | `/leaderboard` | any | | |
| Keyboard walk-through (S3 Assistant) | `/assistant` | any | | |
| Keyboard walk-through (S4 Steward console, asset sheet, Share to Slack dialog) | `/steward` | any | | |
| Keyboard walk-through (S8 Feedback queue) | `/steward/feedback-queue` | any | | |
| Keyboard walk-through (S9 Conflicts, K2) | `/steward/conflicts` | any | | |
| Keyboard walk-through (S10 Feedback branches, confirm dialog) | `/steward/feedback-branches` | any | | |
| Keyboard walk-through (S5 Executive) | `/executive` | any | | |
| Keyboard walk-through (S6 Admin, maintenance actions) | `/admin` | any | | |
| Keyboard walk-through (S7 Settings, unsaved changes) | `/settings` | any | | |
| Keyboard walk-through (S11 not found) | `/does-not-exist` | any | | |

## 4. Forced colors (Windows High Contrast)

Windows contrast theme (or Edge / Chrome DevTools > Rendering > Emulate `forced-colors: active`). Cards, inputs, buttons and focus rings stay visible.

| check | route | theme | result | notes |
|---|---|---|---|---|
| Forced colors: cards, vote buttons, focus rings | `/` | any | | |
| Forced colors: tabs, table, focus rings | `/leaderboard` | any | | |
| Forced colors: chat input, messages | `/assistant` | any | | |
| Forced colors: steward console, sheet, dialog | `/steward` | any | | |
| Forced colors: conflict groups, radios, diff | `/steward/conflicts` | any | | |
| Forced colors: queue and branches lists, status badges | `/steward/feedback-branches` | any | | |
| Forced colors: form inputs, switches, selects | `/settings` | any | | |

## 5. Figma side-by-side (`ui_test_strategy.md` §7.5)

Compare with the Figma Make export (`docs/design/ui/figma/`). Start with the 5 lowest `figma_similarity` cells from `ui_visual_checks` run `743244124674286` (session 62); screenshots in `/Volumes/hls_fde_dev/dev_matthew_giglia_semantic_ground_truth/ui_visual_checks/743244124674286/`.

| check | route | theme | result | notes |
|---|---|---|---|---|
| Figma side-by-side, 390x844 (similarity 0.858, `settings__dark__390x844.png`) | `/settings` | dark | | |
| Figma side-by-side, 1440x900 (similarity 0.910, `review__dark__1440x900.png`) | `/` | dark | | |
| Figma side-by-side, 390x844 (similarity 0.911, `steward-feedback-branches__dark__390x844.png`) | `/steward/feedback-branches` | dark | | |
| Figma side-by-side, 390x844 (similarity 0.912, `steward__dark__390x844.png`) | `/steward` | dark | | |
| Figma side-by-side, 390x844 (similarity 0.913, `steward__light__390x844.png`) | `/steward` | light | | |
| Figma side-by-side, spot check of the other screens (similarity ≥ 0.914) | all other routes | light + dark | | |

## 6. Mobile: 390 px touch

A real touch device (or a 390 px wide phone) on the deployed app.

| check | route | theme | result | notes |
|---|---|---|---|---|
| 390 px: swipe gestures on the review card (approve / reject / skip) | `/` | light | | |
| 390 px: swipe gestures on the review card (approve / reject / skip) | `/` | dark | | |
| 390 px: navigation menu, leaderboard table scrolls sideways | `/leaderboard` | any | | |

## 7. MCP App card in Genie One / Genie Code (follow-up 11)

The `ui://ground-truth/review-card` MCP App (`server/mcp/views/cardHtml.ts`, unchanged in build 5) through the app's MCP server.

| check | route | theme | result | notes |
|---|---|---|---|---|
| MCP App review card renders in Genie One (`review_get_next`) | Genie One | any | | |
| MCP App card vote round-trip (`review_submit_vote` or `review_skip_card` from the card) | Genie One | any | | |
| MCP App card renders, or the text fallback is readable, in Genie Code | Genie Code | any | | |

## 8. Share to Slack, Send mode (G5 Option A)

After reconnecting `system.ai.slack`. Use a test channel and send **once**; automated tests and earlier live use were `draft` only.

| check | route | theme | result | notes |
|---|---|---|---|---|
| `slack_send_message` is listed by `system.ai.slack` after reconnect (needs_slack_login gone) | `/steward` | any | | |
| Share to Slack in **Send** mode posts once to a test channel; the message and link are correct | `/steward` | any | | |
