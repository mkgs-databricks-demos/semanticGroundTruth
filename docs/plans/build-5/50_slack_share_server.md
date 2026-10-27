# Session 50: Share to Slack, server side (G5 Option A)

**Build 5 · wave `5-1` · edit (parallel with 49)** · spec: `docs/research/05_slack_mcp_notifications.md` §Recommendation and §Exact changes 2-5, 7.

## Steps

1. **MCP client** `server/services/notification/destinations/slackMcp.ts`: minimal Streamable-HTTP JSON-RPC client to `${DATABRICKS_HOST}/ai-gateway/mcp-services/system.ai.slack` with the **user's** token (`x-forwarded-access-token`), never the app SPN. Methods: `searchChannels(query)` (`slack_search_channels`), `send(channelId, text)` (`slack_send_message`), `draft(channelId, text)` (`slack_send_message_draft`). Map JSON-RPC `-32042` / 401 → `needs_slack_login`; 403 → `FORBIDDEN` (missing `EXECUTE` on `system.ai.slack`); 429 → `RATE_LIMITED` with retry-after.
2. **Routes** `server/routes/slack.ts` (stubs from session 44): implement the 3 routes. Message text: asset name, type, status, confidence, a deep link to the app (`/steward?asset=<id>` or the notification target) and the optional user message; max 3,000 chars. RBAC steward/admin (already enforced). Audit each share as a `notifications` row (`channel='slack'`, `status`, permalink in `metadata`) via `NotificationService`.
3. **Feature flag** `GT_SLACK_SHARE_ENABLED` (default `true`); when false the routes return 404 and `/api/config` reports `slackShareEnabled: false` (field added to the config contract by session 44).
4. **App resource** `resources/app.app.yml`: add `ai-gateway` to `user_api_scopes`. Users consent again on first open; the runbook is owned by session 46 in another wave, so put the note in your status summary and session 63 adds it to the runbook.
5. **Tests:** JSON-RPC client with mocked fetch (success, `-32042`, 429, 403); route tests (reviewer 403, steward draft → `drafted`, send → `sent` + audit row, login needed → `needs_slack_login`); flag off → 404.
6. vitest + both `tsc -b` in `/tmp/gt-50/`; `bundle validate --strict --target dev` for the app.

## Owned paths

* `ground-truth-app/server/services/notification/**`
* `ground-truth-app/server/routes/slack.ts`, `ground-truth-app/server/routes/notifications.ts`, `ground-truth-app/server/routes/config.ts`
* `ground-truth-app/resources/app.app.yml`

## Dependencies

44
