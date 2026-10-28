# Session 56 (wave 5-3): Share to Slack, UI (G5 Option A)

Run `229891579528310`, branch `mg-genie-build-5`, mode `edit`. Plan: `docs/plans/build-5/56_share_to_slack_ui.md`. Spec: `docs/research/05_slack_mcp_notifications.md` §Exact changes 6. Server: session 50. Hooks: session 49.

**Status: blocked.** Everything in my owned paths is done and tested. One change outside my paths is needed: two existing test files mount the bell or the asset sheet as a steward without a `GET /api/config` handler. The new action reads that route, so the strict `mockApi` fails 4 of their tests (a 5th fails as a knock-on). The patch is below (2 files, 5 added lines). With it applied in `/tmp/gt-56`, the full vitest run passes.

## Changes (owned paths)

### `components/share/` (new)
* `ShareToSlackDialog.tsx`: an AppKit (Radix) modal dialog. Radix traps focus and closes on Escape. Focus goes back to `returnFocusRef` when the trigger is still mounted.
  * **Channel picker:** a WAI-ARIA combobox over `GET /api/slack/channels?query=`, with a 300 ms debounce (`CHANNEL_SEARCH_DEBOUNCE_MS`). The list loads when the field gets focus. Arrow keys move through the options and Enter picks one. Escape closes the list but not the dialog (`onEscapeKeyDown` checks the picker). The status line says "Searching channels…", "No channels match …" or "N channels found". A failed load shows an InlineAlert with Retry.
  * **Preview:** read-only text in the same layout as the server's `buildShareMessage`: title/body, or `Asset:` and `Status:`. The confidence and the link are marked "added when sent", because the server adds them. There is an optional note (max `SLACK_SHARE_MESSAGE_MAX`, with a character count).
  * **Mode:** `RadioCardGroup` with **Draft to me** (default) or **Send to channel**. The submit button reads "Save draft" or "Send to Slack". It stays disabled until a channel is picked, while the request runs, and while offline (an offline alert is shown).
  * **Body:** `{ channelId, mode, message? }`. `message` is sent only when the note is not blank.
  * **Results:**
    * drafted / sent: a `role="status"` panel and a permalink, "View in Slack" or "Open draft in Slack". The link opens in a new tab (`target=_blank`, `rel=noopener noreferrer`, sr-only "(opens in a new tab)"). A Done button is shown.
    * `needs_slack_login`: a warning that says "Connect Slack in Catalog Explorer → system.ai.slack, then try again." It shows a "Connect Slack" link when the server returns an https `loginUrl`. Otherwise it explains "Open system.ai.slack in Catalog Explorer and click Login." (session 50 request 3).
    * 403: a forbidden alert with the server message.
    * 429: "Try again in N seconds" (from `error.details.retryAfterSeconds`) and a Retry button.
    * Other errors: an error alert with Retry.
  * Only https URLs from the server are rendered as links (`safeHttpsUrl`).
* `ShareToSlackButton.tsx`: an outline button with the brand `send` icon (`SendIcon.svg`, session 42 manifest). The visible text is "Share to Slack". An optional sr-only `: <subject>` makes list items distinct, and the name still starts with the visible label.
* `useSlackShareAvailable.ts`: true only for steward/admin when `/api/config` has `slackShareEnabled: true`. It uses the same query key and function as `useRuntimeConfig` and does not fetch until `GET /api/me` shows a steward.
* `index.ts`: barrel.

### `components/layout/NotificationBell.tsx`
* Each notification item shows **Share to Slack** (test id `shell-notification-share-button`) when available, followed by the existing `notificationActions(n)` slot (kept as is).
* The availability check runs per item. Nothing extra is fetched until the list renders, and a reviewer never asks for `/api/config`.
* Clicking it closes the popover and opens the dialog at the bell level. The dialog is not inside the popover, so the popover's outside-click handler cannot unmount it. Closing the dialog returns focus to the bell.

### `components/steward/AssetDetailSheet.tsx`
* The footer shows **Share to Slack** (`steward-asset-share-button`) when available, followed by the existing `actions(asset)` slot.
* The dialog stacks on top of the sheet. Escape closes only the dialog, and focus returns to the Share button.
* The footer is now always passed once the asset has loaded. When there is nothing to show, `AssetFooterActions` renders `null`, so the footer is empty.

### Tests: `components/share/ShareToSlack.test.tsx` (16)
* **Visibility:** a reviewer sees no action in the bell or the sheet, and no `/api/config` request is made. With the flag off, the action is hidden in both. A steward gets a named action per item next to the slot.
* **Draft flow from the bell:** debounced search (no request for "st"), preview and note. The body is parsed with `ShareSlackRequestSchema`. The drafted result shows, Done closes the dialog, and focus returns to the bell.
* **Send flow from the sheet:** with no note, no `message` is sent. The sent result has a permalink with `target`/`rel`.
* **Errors:** `needs_slack_login` with a link; `needs_slack_login` with a non-https URL falls back to the text steps; 429 retry-after, where Retry sends exactly once more; 403; no matching channel.
* **Keyboard:** the focus trap holds over 12 Tabs. Escape closes the list first, then the dialog. Focus returns to Share and the sheet stays open.
* **Helpers:** `safeHttpsUrl`, `sharePreviewLines`.
* **axe:** light and dark, with the list open, login needed, and sent.
* **Negative check:** with `useSlackShareAvailable` forced to `true`, the 3 visibility tests fail (verified, then reverted).

## Checks (`/tmp/gt-56`, a copy of the live tree, Node toolchain runbook)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass |
| `tsc -b tsconfig.server.json` | exit 0 |
| `tsc -b tsconfig.client.json` | exit 0 |
| vitest `components/share` | 16/16 pass |
| vitest, live tree without the patch (AppLayout + StewardPage files) | **5 fail**: AppLayout "popover lists notifications…", "Enter opens the bell popover…", "no violations in light and dark…", and StewardPage "an asset opens the detail sheet…" (`mockApi: GET /api/config was requested but has no handler`). StewardPage "metric views tab" is a knock-on (a leftover modal sets `pointer-events: none`). |
| vitest, full, with the patch below applied in the copy | **57 files, 1741 pass, 2 skipped, 0 fail** (includes `theme/a11y-static`) |
| `bundle validate` | skipped: no YAML touched |

I did not deploy anything and made no live Slack call.

The `/tmp` copy was taken while session 55 (same wave) was editing `components/steward-triage/**` and `pages/steward/FeedbackQueuePage.tsx`, so the full-run count includes that snapshot of its work.

## Requests

1. **`client/src/components/layout/AppLayout.test.tsx` (session 49) and `client/src/components/steward/StewardPage.test.tsx` (session 54)** (blocks the wave gate). Register `GET /api/config` where a steward opens the bell or the asset sheet. Apply from the repo root with `git apply`:

```diff
--- a/ground-truth-app/client/src/components/layout/AppLayout.test.tsx
+++ b/ground-truth-app/client/src/components/layout/AppLayout.test.tsx
@@ -20,6 +20,7 @@
   feedbackQueueRoutes,
   notifications,
   notificationsRoutes,
+  runtimeConfig,
   settingsRoutes,
 } from '../../test/fixtures';
 import { pressKey, tabUntil } from '../../test/keyboard';
@@ -44,7 +45,8 @@
 
 function renderShell(options: RenderWithProvidersOptions & { props?: AppLayoutProps } = {}) {
   const { props, ...rest } = options;
-  mockApi(notificationsRoutes);
+  // Share to Slack (session 56) reads GET /api/config for stewards when the list renders.
+  mockApi({ ...notificationsRoutes, 'GET /api/config': runtimeConfig });
   return renderWithProviders(shell(props), { roles: STEWARD, ...rest });
 }
 
--- a/ground-truth-app/client/src/components/steward/StewardPage.test.tsx
+++ b/ground-truth-app/client/src/components/steward/StewardPage.test.tsx
@@ -30,6 +30,7 @@
   meSteward,
   metricViews,
   pagedAssets,
+  runtimeConfig,
   sources,
   stewardRoutes,
   TARGET_CATALOG,
@@ -169,6 +170,8 @@
       ...stewardRoutes,
       'GET /api/assets/:assetId': assetReadmissionRate,
       'GET /api/assets/:assetId/versions': [],
+      // Share to Slack (session 56) reads GET /api/config for stewards in the sheet footer.
+      'GET /api/config': runtimeConfig,
     });
     const name = assetReadmissionRate.displayName ?? assetReadmissionRate.name;
     const { user } = renderPage({}, { assetActions: (a) => <button type="button">Share {a.name}</button> });
```

`git apply --check` passes on the live tree (checked 2026-10-28). Then set `.build-status/229891579528310/56.json` to `pass` and repair from `w5-3_integrate`.

## Decisions

* **Built-in action plus the slot.** The bell and the sheet render Share to Slack themselves, and the slot callbacks still render after it. `App.tsx` and `StewardPage` pass no slot, and neither is mine. Owning the mount in these two files is the only way the action reaches users.
* **The flag check runs where the action renders,** so `/api/config` is not fetched on every page load. Even so, any existing test that shows a steward a notification item or a loaded asset sheet needs a config handler (the request above). This is the same pattern as the s52 GOTCHA (a new GET breaks strict `mockApi` tests).
* **The bell dialog sits outside the popover:** the popover's document `mousedown` handler would unmount a dialog rendered inside it.
* **Alerts and the footer sit outside the `<form>`:** InlineAlert's Retry is a default (submit) button and sent the share twice. The test caught it. The submit button uses `form={formId}`.
* **No Catalog Explorer link without `loginUrl`:** the app origin is not the workspace host, so the client cannot build a reliable workspace URL. The text steps are shown instead.

## Assumptions

* The server's message layout (session 50 `buildShareMessage`) stays as it is. The preview copies its labels but not its values for confidence and link.
* An empty query (`GET /api/slack/channels` with no `query`) returns a default list. Session 50 passes it to `slack_search_channels` as is. Check this in the manual wave (M5).

## Files

`ground-truth-app/client/src/components/share/{ShareToSlackDialog,ShareToSlackButton}.tsx`, `share/{useSlackShareAvailable,index}.ts`, `share/ShareToSlack.test.tsx`, `components/layout/NotificationBell.tsx`, `components/steward/AssetDetailSheet.tsx`.
