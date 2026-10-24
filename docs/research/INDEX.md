# Research Index

| # | Document | Topic |
|---|---|---|
| 01 | [01_uc_semantics_api_surface.md](01_uc_semantics_api_surface.md) | UC semantics API surface (metric views, Pages, Domains) |
| 02 | [02_wilson_score_and_lakebase_cdf.md](02_wilson_score_and_lakebase_cdf.md) | Wilson score confidence and Lakebase CDF |
| 03 | [03_genie_code_workflow_tasks.md](03_genie_code_workflow_tasks.md) | Genie Code tasks in jobs |
| 04 | [04_dab_secrets_jobruns_mcp.md](04_dab_secrets_jobruns_mcp.md) | DAB resources: UC secrets, job runs, MCP services |
| 05 | [05_slack_mcp_notifications.md](05_slack_mcp_notifications.md) | App notifications through the workspace Slack MCP (G5) |

## G5 next step

Session 30 (2026-10-24) found that the app can post to Slack only **as the signed-in user**, through the Unity Gateway MCP `system.ai.slack`. The app service principal and jobs have no Slack identity, because the connection uses per-user OAuth. Recommended next build: a steward- and admin-only **"Share to Slack"** action. It adds the `ai-gateway` user API scope to the app, sends with `slack_send_message` (and `slack_send_message_draft` for tests), and shows a "Connect Slack" link on JSON-RPC error `-32042`. In-app notifications stay the system channel. Prerequisite: the owner reconnects `system.ai.slack` and confirms that `tools/list` through Unity Gateway shows `slack_send_message`. On 2026-10-24 it listed only 7 read-only tools, while the legacy proxy listed 13. Automated channel alerts need a Slack bot from the Slack admin (Option B). See [05_slack_mcp_notifications.md](05_slack_mcp_notifications.md).
