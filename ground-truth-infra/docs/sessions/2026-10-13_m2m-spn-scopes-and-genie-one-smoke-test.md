# 2026-10-13 — M2M SPN secret keys, ai-gateway scope, Genie One MCP smoke test

**Branch:** `mg-genie-m2m-spn`
**Commits:** `676623e`, `ebbaac2`, `af6cd38`, `0a5341a`, `7ed1b2f`
**Last verified run:** `post_deploy_setup` run `542532194146061`. `ensure_m2m_service_principal` and `smoke_test_genie_one_mcp` passed; `setup_secrets` failed as expected (scaffold).

## Summary

Finished provisioning the dev M2M SPN (`semantic-ground-truth-m2m-dev`, app ID `16f8923c-a948-4f0e-b00a-f54ad3f6b1f9`):

* simplified the secret key names
* added the `ai-gateway` OAuth scope
* added a deploy-time smoke test that calls the Genie One MCP (`system.ai.genie_one_mcp`) end to end through Unity Gateway as the SPN

## Problems and root causes

| Problem | Root cause | Fix |
| --- | --- | --- |
| Secret key names were long (`m2m_client_secret_dev_matthew_giglia_semantic_ground_truth`) | Schema-qualified convention carried over from lakeLoom | Renamed to `m2m_client_{id,secret}_<target>`, matching the SPN name `semantic-ground-truth-m2m-<target>` |
| `apps`-only secret could not call Genie One | Unity Gateway MCP services require the `ai-gateway` scope; scopes on an existing secret cannot be changed | User generated a new secret with `apps ai-gateway` and deleted the old one; `var.m2m_oauth_scopes` default changed to `"apps ai-gateway"` |
| `deploy.sh` would have shown `appsai-gateway` | `safe()` strips spaces | Separate cleanup for the scopes value that keeps spaces and `:`. First attempt used a backslash inside an f-string (breaks Python before 3.12); rewritten |
| Poll always reported `UNKNOWN`, timed out at 120 s | `genie_poll_response` returns rendered markdown, not JSON with a `status` field | `_classify_poll()`: `isError` → failed; JSON `status` if present; non-JSON text → completed |
| First poll treated as the answer | Genie returns a plain-text "Still running — no progress steps yet" message before the real answer | That pattern is classified as in progress |

## Changes

### Secret keys (`676623e`)
* dev: `m2m_client_id_dev` / `m2m_client_secret_dev`
* prod: `m2m_client_id_prod` / `m2m_client_secret_prod`
* The old key `m2m_client_id_dev_matthew_giglia_semantic_ground_truth` was deleted from the scope by the user.

### OAuth scopes (`ebbaac2`)
* `m2m_oauth_scopes` default: `"apps ai-gateway"`
  * `apps`: the connection calls the Bundle 2 app's `/mcp`
  * `ai-gateway`: the SPN calls Unity Gateway MCP services (Genie One, later `ground_truth_mcp`)
* Token check passed: `M2M SPN verification: PASSED (HTTP 200)`.
* The current secret expires 2028-10-12. It must be regenerated with more scopes when Bundle 2 declares `user_api_scopes`.

### Genie One MCP smoke test (`af6cd38`, `0a5341a`, `7ed1b2f`)
* `src/lib/mcp_client.py`: `get_m2m_access_token()`, `gateway_mcp_url()`, `McpHttpClient` (`initialize`, `list_tools` with pagination, `call_tool`; JSON and SSE replies), `extract_text_content()`, `parse_text_as_json()`. Reusable for the Bundle 2 `ground_truth_mcp` test.
* `src/notebooks/smoke_test_genie_one_mcp.py`:
  1. M2M token with `ai-gateway` scope
  2. MCP `initialize` + `notifications/initialized`
  3. `tools/list`: asserts `genie_ask` and `genie_poll_response` exist
  4. `genie_ask` (default question `what is databricks lakebase?`), then `genie_poll_response` with backoff (3 s doubling to a 15 s cap; 120 s timeout)
  * A timeout only warns; it does not fail the task, because reachability is already proven by steps 1–3.
  * Task values: `genie_one_mcp_reachable`, `genie_one_mcp_tool_count`, `genie_one_ask_status`, `genie_one_poll_status`.
* Job wiring: condition task `check_m2m_token_verified` (`m2m_token_verified == "true"`) → `smoke_test_genie_one_mcp`. Added `+smoke_test_genie_one_mcp` to the `only:` list in `run_post_deploy.job_run.yml`.

## Observed Genie One behavior (2026-10-13)

* URL: `https://<host>/ai-gateway/mcp-services/system.ai.genie_one_mcp`
* Server `genie_chat 1.0.0`, protocol `2025-06-18`, JSON responses, `Mcp-Session-Id` header returned.
* Tools:
  * `genie_ask(question)`
  * `genie_poll_response(conversation_id, response_id)`
  * `genie_get_query_result(conversation_id, response_id, item_id)`
  * `genie_cancel_response(conversation_id)`
* `genie_ask` returns JSON: `{response_id, conversation_id, status: "in_progress"}`.
* `genie_poll_response` returns markdown. In-progress text says "Still running". The final answer starts with an `<!-- agent: Genie has finished ... -->` comment, then `**Status:** completed`, reasoning, and the answer.
* The SPN needed no extra grant to reach Genie One. The general-knowledge question completed in 3 polls (about 16 s).
* The legacy `/api/2.0/mcp/genie` endpoint (`genie` scope) shuts down 2026-10-31. Do not use it.

## Decisions

* Secret keys follow `m2m_client_{id,secret}_<target>`. They are literal per-target values in `databricks.yml`, not built from `${bundle.target}` in the variable default (not sure DAB resolves that there).
* A single scope set (`apps ai-gateway`) for both the connection and the caller. It can be split into two variables later if least privilege on the connection matters.
* The smoke test is gated on token verification, so a missing secret skips it instead of failing it.

## Files modified

* `databricks.yml`: secret key values per target, `m2m_oauth_scopes` default and comments
* `resources/secrets/ground_truth_scope.secret_scope.yml`: key documentation (`<target>`)
* `resources/jobs/post_deploy_setup.job.yml`: `check_m2m_token_verified` and `smoke_test_genie_one_mcp` tasks
* `resources/jobs/run_post_deploy.job_run.yml`: `+smoke_test_genie_one_mcp`
* `src/notebooks/ensure_m2m_service_principal.py`: widget default for scopes
* `src/lib/mcp_client.py` (new)
* `src/notebooks/smoke_test_genie_one_mcp.py` (new)
* `docs/plans/m2m_service_principal_plan.md`, `docs/runbooks/m2m-service-principal.md`: key names and scopes
* `../deploy.sh`: scopes fallback value and cleanup

## Open items

1. `setup_secrets.py`: still raises `NotImplementedError`, so every auto-run reports FAILED. Next up.
2. `setup_gateway_connection.py`: scaffold; implement once Bundle 2 deploys the app.
3. `ground_truth_mcp` MCP service: fails until the HTTP connection exists (post-Bundle 2).
4. Regenerate the M2M secret with the app's OBO scopes once Bundle 2 declares `user_api_scopes`.
5. Optional: call `genie_get_query_result` when a Genie answer includes query results.
