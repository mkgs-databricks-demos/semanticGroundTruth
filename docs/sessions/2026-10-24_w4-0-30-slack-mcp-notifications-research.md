# Session 30 · Wave 4-0 · Research: Slack MCP notifications (G5)

**Date:** 2026-10-24 · **Run:** 110489694161084 · **Mode:** edit (docs only) · **Branch:** `mg-genie-build-4`

## Problem

G5: the owner has no Slack or Teams webhook. The question was whether the app can notify through the workspace Slack MCP instead.

## What was done

* Read the plan, the manifest session, the notification service (`ground-truth-app/server/services/notification/`), `resources/app.app.yml` and the existing research docs.
* Made read-only API calls as the job run identity (owner): GET connection `system_ai_agent_slack_mcp` and its grants and effective grants; GET MCP service `system.ai.slack` and its grants; list the MCP services in the project schema; read the app SPN and the `allowedAppsUserApiScopes` setting. Ran MCP `initialize` and `tools/list` on Unity Gateway (`/ai-gateway/mcp-services/system.ai.slack`) and on the legacy proxy (`/api/2.0/mcp/external/system_ai_agent_slack_mcp`).
* Wrote `docs/research/05_slack_mcp_notifications.md` (Q1-6, decision table, recommendation, exact later-build changes, each claim tagged verified, docs or unverified) and created `docs/research/INDEX.md` with a "G5 next step" paragraph.

## Key findings

* Both Slack connections are per-user OAuth (`OAUTH_U2M_MAPPING`). The app SPN and SPN-run jobs have no Slack identity. Posting is only possible as the signed-in user (OBO, with the `ai-gateway` user API scope), or as the `run_as` user of a job.
* `account users` has `EXECUTE` on `system.ai.slack` and `USE_CONNECTION` on `system_ai_agent_slack_mcp`. `system.ai.slack` has a PII-mask result policy.
* **Gotcha:** `tools/list` through Unity Gateway returned only 7 read-only tools, while the legacy proxy returned 13, including `slack_send_message`, `slack_schedule_message`, `slack_send_message_draft` and canvases. The likely cause is a stale per-user grant from before the write scopes were added (the docs say users must reconnect). This is unverified. The owner should reconnect and check again before building.

## Decision

Recommend **Option A: a user-initiated "Share to Slack" (OBO, steward/admin only)** through `system.ai.slack`. In-app notifications stay the system channel. A bot connection (Option B) needs a Slack admin and is deferred. The webhook code stays dormant.

## Checks

| Check | Result |
|---|---|
| Every question answered with a source or marked unverified | pass |
| No Slack message sent, no `tools/call`, no connection, grant or secret change | pass (only GETs, `initialize` and `tools/list`) |
| Recommendation names the identity and privilege | pass (signed-in user; `EXECUTE` on `system.ai.slack` + `ai-gateway` scope) |
| Only owned paths edited | pass |

## Files modified

* `docs/research/05_slack_mcp_notifications.md` (new)
* `docs/research/INDEX.md` (new)

## Requests for other sessions

None. The later build touches `shared/contracts/*` (session 25's files this wave) and `resources/app.app.yml`. Those changes are listed in the research doc and are not made here.
