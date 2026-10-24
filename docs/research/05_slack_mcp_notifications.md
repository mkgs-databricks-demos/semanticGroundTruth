# Research: App notifications through the workspace Slack MCP (G5)

## Date: 2026-10-24

Session 30 · build 4 · wave `4-0` · docs only. Plan: [`docs/plans/30_root_research_slack_mcp_notifications.md`](../plans/30_root_research_slack_mcp_notifications.md).

**Method.** Databricks docs, plus read-only API calls run as `matthew.giglia@databricks.com` (the job's run identity) on `fevm-hls-fde` on 2026-10-24: connection and MCP service GETs, UC permission GETs, MCP `initialize` and `tools/list`. **No `tools/call` was made, no Slack message was sent, and no connection, grant, secret or app setting was created or changed.** Every claim below is tagged:

* **[verified]**: seen in an API response in this session.
* **[docs]**: stated in Databricks documentation (linked), not tested here.
* **[unverified]**: inference, or a test we deliberately did not run.

---

## Summary

* **Yes, the app can post to Slack through the workspace Slack MCP, but only as the signed-in user (OBO), never as the app.** The Slack MCP uses per-user OAuth (`OAUTH_U2M_MAPPING`). Every caller needs their own Slack sign-in. The app service principal cannot do the interactive Slack sign-in, so it has no Slack identity.
* **Use the Unity Gateway MCP `system.ai.slack`**, not the legacy proxy or the raw connection. Call `https://<workspace>/ai-gateway/mcp-services/system.ai.slack` with the user's token. The app needs the `ai-gateway` user API scope, and the caller needs `EXECUTE` on the MCP. `account users` already has `EXECUTE`.
* **Gotcha found:** through Unity Gateway, `tools/list` for the owner returned **7 read-only tools and no send tool**. The legacy proxy, on another connection, returned 13 tools, including `slack_send_message`. The send path must be proven with a test user before it is built (see Q3).
* **Jobs cannot use it.** There is no user, and the app SPN has no Slack credential. A Genie Code task that runs as the owner can use the owner's credential. That is fine for owner-addressed digests, but it is not a general notification channel.
* **Recommendation: Option A, user-initiated "Share to Slack" (OBO).** The steward or admin clicks a button, the app shows a preview, and the app sends the message as that user. Keep in-app notifications as the system channel. Defer automated or bot delivery (Option B: an app-owned Slack bot) until a Slack admin can create a bot app.

---

## Live findings (fevm-hls-fde, 2026-10-24)

| Object | Finding | Tag |
|---|---|---|
| Connection `system_ai_agent_slack_mcp` | HTTP, `credential_type = OAUTH_U2M_MAPPING`, host `https://mcp.slack.com`, base path `/mcp`, `oauth_provider = OAUTH_PROVIDER_SLACK_MCP`, owner SPN `3f5d4543-…`, `read_only: true`, comment *"System-managed connection for AI agents… Do not modify or delete."* `oauth_scope` is **read only** (search, history, `canvases:read`, `users:read`, `users:read.email`). It has **no `chat:write`**. | [verified] |
| Grants on that connection | `account users`: `USE_CONNECTION` (direct). `READ_METADATA` is inherited from the metastore. | [verified] |
| MCP service `system.ai.slack` | Source connection `connections/system.ai.slack` (`CONNECTION_HTTP_OAUTH_U2M_MAPPING`, `https://mcp.slack.com:443/mcp`). Its scopes **include `chat:write`**, `canvases:write`, `im:write`, `channels:write`, `reactions:write` and others. Service policy `slack-mask-pii` (built-in `system.ai.detect_sensitive_data`, `post_call`, action `transform`, category `class.email_address`). | [verified] |
| Grants on `system.ai.slack` | `account users`: `EXECUTE` (direct, also inherited from `system.ai` and `system`). `metastore_admins`: `MANAGE`. | [verified] |
| MCP services in the project schema | Only `semantic-ground-truth-mcp`, the app's own MCP. There is no project Slack MCP. | [verified] |
| App `dev-semantic-ground-truth` | SPN `9f3db838-9415-46fe-9722-9654a6856ecc`. `resources/app.app.yml` `user_api_scopes` = `sql, genie, files, model-serving` (**no `ai-gateway`**). | [verified] |
| Workspace setting `allowedAppsUserApiScopes` | `['*']`: every scope is allowed, including `ai-gateway`. | [verified] |

---

## Q1. URL, auth and privilege for a UC-registered external MCP

**Answer.** There are two endpoints. Both answered `initialize` for the owner.

| Path | URL | Needs | Status |
|---|---|---|---|
| **Unity Gateway (current)** | `POST https://<workspace>/ai-gateway/mcp-services/system.ai.slack` (Streamable HTTP, JSON-RPC) | OAuth scope `ai-gateway` (tool calls), `EXECUTE` on the MCP, `USE CATALOG`/`USE SCHEMA` on the parents. End users do **not** need `USE CONNECTION`. | Initialize: 200, `serverInfo.name = "slack"` [verified]. Docs: [Databricks-provided MCPs](https://docs.databricks.com/aws/en/agents/mcp-tools/built-in-mcp-services/), [Govern an MCP](https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service/) [docs] |
| Legacy external proxy | `POST https://<workspace>/api/2.0/mcp/external/system_ai_agent_slack_mcp` | `USE CONNECTION` on the connection | Initialize: 200, `serverInfo.name = "Slack MCP"` [verified]. It is not in the current docs. Docs now point external servers at MCP Services ([HTTP connections](https://docs.databricks.com/aws/en/query-federation/http/)) [docs] |

* Who holds the privilege: `account users` has `USE_CONNECTION` on `system_ai_agent_slack_mcp` and `EXECUTE` on `system.ai.slack` [verified].
* The docs say `USE CONNECTION` *"permits direct use of the connection outside the MCP's tool selection and policies"*, so it should be reserved for authors and admins ([Govern an MCP](https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service/)) [docs]. The legacy path skips the `slack-mask-pii` policy and Unity Gateway governance, so the design must not use it.
* Management APIs (`/api/2.1/unity-catalog/mcp-services/...`) use the `unity-catalog` scope. Tool calls use `ai-gateway` ([MCP API reference](https://docs.databricks.com/aws/en/ai-gateway/mcp-service-reference/)) [docs].

## Q2. Can the app SPN call it? OBO? Users who have not connected Slack?

**App SPN: no, in practice.** With `OAUTH_U2M_MAPPING`, each Databricks identity signs in to Slack once in a browser, and calls then run as that Slack user ([Managed OAuth providers](https://docs.databricks.com/aws/en/agents/mcp-tools/managed-oauth/), [HTTP connections: U2M Per User](https://docs.databricks.com/aws/en/query-federation/http/)) [docs]. The SPN has `EXECUTE` through `account users`, assuming the SPN is in that group [unverified]. But it cannot complete an interactive Slack consent, so it would get the sign-in elicitation on every call. We did not call it as the SPN, because the plan limits experiments to "as yourself" [unverified]. Even if it worked, messages would come from a person's Slack account, not from a bot.

**OBO: yes.** Per [Authentication for agents](https://docs.databricks.com/aws/en/agents/custom-agents/agent-authentication/) [docs]:

1. Add `ai-gateway` to `user_api_scopes` on the app resource (`ground-truth-app/resources/app.app.yml`). The workspace allowlist permits it [verified]. Adding a scope makes every user consent again, once ([Apps auth](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth/)) [docs].
2. Call the Unity Gateway URL with the `x-forwarded-access-token` the Apps proxy forwards. `server/middleware/identity.ts` already reads it [verified].
3. **A user who has not connected Slack** gets JSON-RPC error **`-32042`** with a login URL in **`error.data.elicitations[]`**. The app must show that link ("Connect Slack") and retry after sign-in. The user can also open the MCP in Catalog Explorer and click **Login** [docs]. We did not see the error shape here, because the owner is already signed in [unverified].
4. The MCP API also has **Sign in / Check sign-in / Sign out** operations ([MCP API reference](https://docs.databricks.com/aws/en/ai-gateway/mcp-service-reference/)) [docs]. A settings page can use Check sign-in to show "Slack: connected" before the user clicks Share [unverified: exact path not tested].

## Q3. Which tools exist, and which can post?

`tools/list` was run as the owner only (read-only), and no tool was called.

| Endpoint | Tools returned | Tag |
|---|---|---|
| Unity Gateway `system.ai.slack` | `slack_search_public_and_private`, `slack_search_channels`, `slack_search_users`, `slack_read_channel`, `slack_read_thread`, `slack_read_canvas`, `slack_read_user_profile` (all `readOnlyHint: true`) | [verified] |
| Legacy `system_ai_agent_slack_mcp` | The 7 above plus `slack_search_public`, **`slack_send_message`**, **`slack_schedule_message`**, **`slack_send_message_draft`**, **`slack_create_canvas`**, **`slack_update_canvas`** | [verified] |

Write tools (input schemas from the legacy listing) [verified]:

| Tool | Required | Optional | Notes |
|---|---|---|---|
| `slack_send_message` | `channel_id`, `message` | `thread_ts`, `reply_broadcast`, `draft_id`, `unfurl_app_links` | A DM uses the user id as `channel_id`. Markdown, up to 5000 chars per text element. Returns a message link. |
| `slack_schedule_message` | `channel_id`, `message`, `post_at` | `thread_ts`, `reply_broadcast` | `post_at` from 2 minutes to 120 days ahead. Cannot be edited later through the API. |
| `slack_send_message_draft` | `channel_id`, `message` | `thread_ts` | Saves to the user's Drafts & Sent without sending. This is the safest test tool. |
| `slack_create_canvas` | `title`, `content` | none | Not available on free teams. |

Slack scopes: posting needs `chat:write`, and canvases need `canvases:write`. Both are in the `system.ai.slack` connection's scope list [verified] and in the managed Slack provider's scope list ([Managed OAuth providers](https://docs.databricks.com/aws/en/agents/mcp-tools/managed-oauth/)) [docs].

**Why the Unity Gateway list has no send tool: unresolved [unverified].** The MCP service has no `include_tool_selectors`, so all tools should be exposed, and its connection requests `chat:write` [verified]. Two likely causes:

* The owner's per-user Slack grant on `system.ai.slack` predates the write scopes. Per the docs, *"If Databricks adds a scope to a provider after a user authorized the connection, that user's connection doesn't get the new scope automatically. The user must reconnect"* ([Managed OAuth providers](https://docs.databricks.com/aws/en/agents/mcp-tools/managed-oauth/)) [docs]. The MCP `update_time` is 2026-10-20 [verified].
* A workspace or Slack-workspace policy hides write tools.

**Before any build work:** the owner signs out and back in to `system.ai.slack` (Catalog Explorer → MCP → Login), then repeats `tools/list`. If `slack_send_message` appears, Option A is viable. If it does not, ask the Databricks or Slack admin. This is the first item in "Next steps".

## Q4. Can a job use it?

**Not as a general channel.** Jobs (`feedback_pipeline`, `freshness_resurfacing`) run as the job's `run_as` identity:

* **Run as a service principal:** the SPN has no Slack sign-in (Q2). Every call would return the `-32042` elicitation [docs + unverified].
* **Run as a user (the owner):** the stored per-user Slack credential works unattended. This session is a Genie Code job task running as the owner, and it reached the Unity Gateway Slack MCP with no interaction (`initialize` + `tools/list` returned 200) [verified]. So a Genie Code task, or a notebook task run as the owner, *can* post, but **every message comes from the owner's personal Slack account**. That is fine for an owner-only digest ("5 assets went stale this week" DM'd to the owner). It is wrong for messages to other stewards: it impersonates a person and breaks accountability.

**Closest workable patterns**, in order:

1. Jobs write in-app notifications (Lakebase `notifications`, status `sent`). They already do this, and it needs no change.
2. Stewards act on them in the app with **Share to Slack** (Option A), which sends as the steward.
3. Optional: an owner-only weekly digest DM, through a Genie Code task run as the owner using `slack_send_message` to the owner's own user id. This is opt-in and documented as owner-scoped.
4. True system notifications to channels need a bot identity (Option B) or a webhook (Option C).

## Q5. Could the app register its own Slack MCP connection?

**Possible, but it needs a Slack admin, and the hosted Slack MCP is the wrong fit for a bot.**

* **Bearer token (bot `xoxb-…`):** a UC HTTP connection with `BEARER_TOKEN` can hold a bot token ([HTTP connections](https://docs.databricks.com/aws/en/query-federation/http/)) [docs]. The hosted `mcp.slack.com` server is built for **user** OAuth (its `authorization_endpoint` is `slack.com/oauth/v2_user/authorize` and its `token_endpoint` is `oauth.v2.user.access` [verified]). Whether it accepts a bot token is undocumented [unverified]. One user-owned connection in the workspace (`kt_bidw_slack_app`) uses `BEARER_TOKEN`; we did not inspect or use it, per plan.
* **M2M:** Slack has no OAuth client-credentials grant for this, so M2M does not apply [unverified: based on Slack's OAuth model].
* **The practical bot path skips MCP.** Create a schema-level HTTP connection to `https://slack.com/api` with `BEARER_TOKEN` (the bot token), and call `chat.postMessage` through the Databricks connections proxy ([HTTP connections → connections proxy](https://docs.databricks.com/aws/en/query-federation/http/)) [docs], or directly from the app with the token from a secret. Grant the app SPN `USE CONNECTION`. Messages then come from a named bot, which is right for system notifications.
* **What the owner needs from the Slack admin:** a Slack app in the org workspace with bot scopes `chat:write` (plus `chat:write.public` to post in channels without being invited, and `im:write` for DMs), installed to the workspace. The admin shares the bot token (`xoxb-`), which is stored in the project secret scope and never printed. The bot is invited to the target channel(s).

## Q6. Does a Unity Gateway MCP service add anything?

**Yes. Use the Unity Gateway path (`system.ai.slack`) for Option A:**

* **Governance:** `EXECUTE` grants per principal, and GRANT policies can restrict `system.ai` MCPs ([Govern an MCP](https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service/)) [docs]. Tool selection (`include_tool_selectors`) applies only to MCPs we own. We cannot change it on `system.ai.slack` without `MANAGE` [docs].
* **Policies (Beta):** ON CALL / ON RESULT policies can allow, block or **require approval** for a call. `system.ai.slack` already has a PII-mask result policy [verified]. A "block `slack_send_message` to `#general`" policy is possible but needs `MANAGE` [docs].
* **Rate limits:** QPM per service, user or group. Over the limit returns 429 ([Rate limits](https://docs.databricks.com/aws/en/ai-gateway/rate-limits/)) [docs]. Only on an MCP we own.
* **Observability:** `system.ai_gateway.usage` (`service_type = 'MCP_SERVICE'`), `system.access.audit` (`mcpCall`), and the unified trace table (Beta, admin-enabled) ([Govern an MCP → Monitor usage](https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service/), [Observability](https://docs.databricks.com/aws/en/ai-gateway/observability/)) [docs]. Every Share to Slack is attributable to the user without extra app code.
* **Should we register our own Slack MCP service?** Only for project-specific tool selection (`slack_send_message`, `slack_send_message_draft`, `slack_search_channels` only) or rate limits. It needs `CREATE SERVICE` on the schema plus a managed-OAuth Slack connection we create. It is a later option, not needed for Option A [docs].

---

## Decision table

| Option | Identity | Privilege / setup | Covers | Pros | Cons |
|---|---|---|---|---|---|
| **A. User-initiated Share to Slack (OBO)** | Signed-in steward/admin, as their Slack user | App `user_api_scopes += ai-gateway`; `EXECUTE` on `system.ai.slack` (already held by `account users`); each user connects Slack once | Steward triage, campaign kickoffs, "ask in #channel" | No admin, secret or webhook needed. Unity Gateway audit + PII policy. Matches Slack's user-OAuth MCP. | Not automatic. Unity Gateway write tools not yet visible (Q3 gotcha). Message comes from the person. |
| B. App-owned bot connection | Slack bot (`xoxb-`) via app SPN | Slack admin creates the bot; schema-level HTTP `BEARER_TOKEN` connection; SPN `USE CONNECTION` | Automated job/app alerts to channels | Real system identity. Works from jobs. | Needs the Slack admin. Raw API, not MCP. A new secret to manage. |
| C. Incoming webhook (current code) | Webhook URL | Slack admin creates the webhook; secret in scope | One fixed channel | Code already exists (`destinations/slack.ts`) | Deferred by the owner. One channel. Secret sprawl. |
| D. Do nothing (in-app only) | None | None | In-app list | Zero work | No reach outside the app |

## Recommendation

**Build Option A next. Keep D (in-app) as the system channel. Revisit B when a Slack admin is available. Keep C's code dormant.**

* **Identity:** the signed-in user (OBO), through `x-forwarded-access-token`. Never the app SPN.
* **Privilege:** `EXECUTE` on `system.ai.slack` (plus `USE CATALOG system` / `USE SCHEMA system.ai`). All are inherited by `account users` today. The app needs the `ai-gateway` user API scope. **Not** `USE CONNECTION`.
* **Tools:** `slack_send_message` (send), `slack_send_message_draft` (a safe "draft to me" mode for first use and tests), `slack_search_channels` (channel picker).
* **Who can share:** `steward` and `admin` roles only (RBAC). Reviewers keep in-app notifications.

### Exact changes for a later build

1. **Contracts** (`ground-truth-app/shared/contracts/`):
   * `api.ts`: `POST /api/notifications/:id/share-slack` and `POST /api/assets/:id/share-slack`. Body `{ channelId: string, message?: string, mode: 'send' | 'draft' }`. Response `{ status: 'sent' | 'drafted' | 'needs_slack_login', permalink?: string, loginUrl?: string }`. `GET /api/slack/channels?q=` returns `{ id, name }[]`. `GET /api/me/slack` returns `{ connected: boolean, loginUrl?: string }`.
   * `values.ts`: keep `NOTIFICATION_CHANNELS` (`slack` stays). Add `SLACK_SHARE_MODES = ['send','draft']`.
   * `schemas.ts`: add the routes to `ROUTE_CONTRACTS` (session 25 owns that file this wave).
2. **Server service** `ground-truth-app/server/services/notification/destinations/slackMcp.ts`: a small Streamable-HTTP JSON-RPC client to `${DATABRICKS_HOST}/ai-gateway/mcp-services/system.ai.slack` using the **user's** token. Map `-32042` to `needs_slack_login` with `error.data.elicitations[0].url`. Never log the token or message body. Add a 10s timeout and map 429 to a retryable error. Leave `SlackDestination` (webhook) as is, but keep it out of auto-routing for Option A, which is user-initiated only.
3. **App resource** `ground-truth-app/resources/app.app.yml`: `user_api_scopes += ai-gateway`. Note in the deploy runbook that users will consent again.
4. **RBAC** (`server/routes/notifications.ts`, `assets.ts`): only `steward` or `admin` may share. Audit each share in Lakebase (`notifications` row with `channel='slack'`, `status='sent'` and the permalink in `metadata`).
5. **Admin settings:** an optional default channel id per campaign, in `app.user_settings` / campaign settings (migration 009 from session 25), and a feature flag `GT_SLACK_SHARE_ENABLED` (default on when `ai-gateway` is in scope).
6. **UI:** a "Share to Slack" action on the notification and asset detail, with a channel picker, preview, and "Connect Slack" when `needs_slack_login`.
7. **Tests:** unit tests for the JSON-RPC client (mock fetch: success, `-32042`, 429, 403 without `EXECUTE`), contract tests for the new routes (wave 4 contract tests pattern), and RBAC tests (a reviewer gets 403). Live smoke test only with `mode: 'draft'` to the tester's own user id, never `send` in CI.
8. **Docs:** update `docs/plans/gap_analysis_2026-10.md` G5 to "Option A planned". Remove the webhook-only guidance.

### Next steps (prerequisites, owner)

1. Reconnect `system.ai.slack` (Catalog Explorer → `system.ai.slack` → Login), then repeat `tools/list` through Unity Gateway. Proceed only if `slack_send_message` appears (Q3).
2. Confirm that the app SPN is not expected to post. If channel alerts from jobs are a requirement, ask the Slack admin for a bot (Option B, Q5).

---

## Sources

* [Databricks-provided MCPs](https://docs.databricks.com/aws/en/agents/mcp-tools/built-in-mcp-services/)
* [Authentication for agents (MCP Services, OBO, `-32042`)](https://docs.databricks.com/aws/en/agents/custom-agents/agent-authentication/)
* [MCP authentication and networking](https://docs.databricks.com/aws/en/agents/mcp-tools/authentication-networking/)
* [Managed OAuth providers (Slack scopes, reconnect after scope change)](https://docs.databricks.com/aws/en/agents/mcp-tools/managed-oauth/)
* [Connect to external HTTP services (auth types, connections proxy)](https://docs.databricks.com/aws/en/query-federation/http/)
* [External MCP servers (register)](https://docs.databricks.com/aws/en/ai-gateway/register-mcp-service/)
* [Govern an MCP (EXECUTE, USE CONNECTION, policies, monitoring)](https://docs.databricks.com/aws/en/ai-gateway/govern-mcp-service/)
* [MCP API and SDK reference](https://docs.databricks.com/aws/en/ai-gateway/mcp-service-reference/)
* [Apply rate limits to model and MCP services](https://docs.databricks.com/aws/en/ai-gateway/rate-limits/)
* [Unity Gateway observability](https://docs.databricks.com/aws/en/ai-gateway/observability/)
* [Configure authorization in a Databricks app (supported scopes incl. `ai-gateway`)](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth/)
