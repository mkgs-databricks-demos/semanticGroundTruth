# Session 30: Research: can the app notify through the workspace Slack MCP? (G5)

**Build 4 · wave `4-0` · edit (research, docs only) · root**

## Scope

The owner has no Slack/Teams incoming webhook (G5 webhook path deferred, 2026-10-24) and asked whether the app can use the Slack MCP available in the workspace instead. Answer that with evidence and a recommended design. Docs only: no app, infra or job changes, no messages sent to Slack.

## Context

* G5 today: `ground-truth-app/server/services/notification/` has in-app notifications plus Slack/Teams webhook senders that are never configured. The webhook secret YAMLs are deleted in session 28.
* Slack MCP connections found in this workspace on 2026-10-24 (`w.connections.list()`), all `HTTP` connections to `https://mcp.slack.com` with `is_mcp_connection=true`:
  * `system_ai_agent_slack_mcp`: owner is a service principal (`3f5d4543-...`), credential type **`OAUTH_U2M_MAPPING`** (each user signs in to Slack; calls run as that user). Looks like the workspace-provided one.
  * Several user-owned copies (`slack_rw`, `stride_slack_mcp`, `slack-mcp-uday-v2`, `dd_slack_mcp_conn`: `OAUTH_U2M_MAPPING`; `kt_bidw_slack_mcp_2`: `OAUTH_U2M`; `kt_bidw_slack_app`: `BEARER_TOKEN`). Do not use other people's connections in the design.
* The app already exposes and consumes MCP: it serves `/mcp`, and infra registers `semantic-ground-truth-mcp` as a UC HTTP connection (M2M). Databricks proxies external MCP servers registered as UC connections (managed MCP path for external servers); Unity Gateway can also front MCP services (`ai-gateway` docs).
* App identity options: app service principal (`9f3db838-...`), or on-behalf-of-user tokens forwarded by the Apps proxy (`x-forwarded-access-token`, needs `user_api_scopes`).

## Questions to answer (each with a source: doc link, API response, or experiment)

1. What URL and auth does a Databricks App use to call a UC-registered external MCP connection (`/api/2.0/mcp/external/<connection>` or the current equivalent)? Which privilege is required (`USE CONNECTION`)? Who holds it on `system_ai_agent_slack_mcp`?
2. With `OAUTH_U2M_MAPPING`, can the **app SPN** call it at all? If not, can the app call it **as the signed-in user** (OBO), and what happens for a user who has not connected Slack (error shape, consent URL)?
3. Which Slack MCP tools exist (`tools/list`), and which can post a message or DM (names, input schema, required Slack scopes)? Run `tools/list` as yourself only if you already have access; never call a write tool.
4. Can a **job** (feedback pipeline, freshness resurfacing) use it, given there is no interactive user? If not, what is the closest workable pattern (e.g. the steward clicks "Share to Slack" in the app; a Genie Code task running as the owner)?
5. Could the app register its own Slack MCP connection with a bot token (`BEARER_TOKEN`) or M2M, and what would the owner need from the Slack admin?
6. Unity Gateway: does fronting the connection with an MCP service add anything useful (tracing, rate limits, policies)?

## Deliverables

1. `docs/research/05_slack_mcp_notifications.md`: answers 1-6, a decision table (OBO user-initiated share / app-owned bot connection / webhook later / do nothing), the recommended option, and the exact changes for a later build (contracts, server service, RBAC, admin settings, tests). Mark each claim as verified or unverified.
2. A short "G5 next step" paragraph appended to `docs/research/INDEX.md` (create if missing).

## Acceptance Criteria

- [ ] Every question has an answer with its source, or an explicit "could not verify" and why.
- [ ] No Slack message was sent; no connection, grant or secret was created or changed.
- [ ] Recommendation names the identity used (user, app SPN, bot) and the privilege needed.

## Owned Paths

- `docs/research/05_slack_mcp_notifications.md`
- `docs/research/INDEX.md`

## Dependencies

- None (wave `4-0`).
