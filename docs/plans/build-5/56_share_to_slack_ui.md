# Session 56: Share to Slack, UI (G5 Option A)

**Build 5 · wave `5-3` · edit (parallel with 55)** · spec: `docs/research/05_slack_mcp_notifications.md` §Exact changes 6; server from session 50; hooks from session 49.

## Steps

1. `components/share/ShareToSlackDialog.tsx`: channel picker (combobox over `GET /api/slack/channels?query=`, debounced), message preview (read-only text the server will send + optional note), mode **Draft to me** (default) / **Send**; results: drafted / sent (link to the permalink, "opens in a new tab") / `needs_slack_login` (explains "Connect Slack in Catalog Explorer → system.ai.slack" with a link) / 403 / 429 messages.
2. Mount it: a "Share to Slack" action in the notification popover item (`components/layout/NotificationBell.tsx`, `notificationActions` slot from session 49) and in the asset detail sheet (`components/steward/AssetDetailSheet.tsx`, `actions` slot from session 54). Only for steward/admin and when `/api/config` `slackShareEnabled` is true.
3. Icons from the brand set (`SendIcon` per session 42's manifest).
4. `// @a11y-strict` on every file written. Tests: reviewer sees no action; steward draft flow (request body parsed by the contract), send flow, login-needed, 429, flag off hides the action; dialog focus trap and Escape; axe light + dark.
5. vitest + both `tsc -b` in `/tmp/gt-56/`.

## Owned paths

* `ground-truth-app/client/src/components/share/**`
* `ground-truth-app/client/src/components/layout/NotificationBell.tsx`
* `ground-truth-app/client/src/components/steward/AssetDetailSheet.tsx`

## Dependencies

49, 50, 54
