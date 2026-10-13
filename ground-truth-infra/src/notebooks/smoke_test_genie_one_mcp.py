# Databricks notebook source
# MAGIC %md
# MAGIC # Smoke Test: Genie One MCP (via Unity Gateway, M2M SPN)
# MAGIC
# MAGIC Verifies the bundle-owned OAuth M2M service principal can reach the
# MAGIC Databricks-provided Genie One MCP (`system.ai.genie_one_mcp`) through
# MAGIC Unity Gateway:
# MAGIC
# MAGIC 1. Mint an M2M token with the `ai-gateway` scope
# MAGIC 2. MCP `initialize` + `notifications/initialized`
# MAGIC 3. `tools/list` — assert the expected Genie One tools are present
# MAGIC 4. *(optional)* `tools/call genie_ask` when `ask_question` is set
# MAGIC
# MAGIC **Design source:** `docs/plans/m2m_service_principal_plan.md` §8
# MAGIC
# MAGIC **Fails** on token, handshake, or discovery errors. The access token is never printed.

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# --- Read Job Parameters ---
dbutils.widgets.text("secret_scope_name", "semantic_ground_truth_credentials", "Workspace secret scope name")
dbutils.widgets.text("m2m_client_id_dbs_key", "m2m_client_id_dev", "Secret key for M2M client_id")
dbutils.widgets.text("m2m_client_secret_dbs_key", "m2m_client_secret_dev", "Secret key for M2M client_secret")
dbutils.widgets.text("workspace_url", "", "Workspace URL (blank = current)")
dbutils.widgets.text("mcp_service_name", "system.ai.genie_one_mcp", "UC MCP service (catalog.schema.name)")
dbutils.widgets.text("oauth_scope", "ai-gateway", "OAuth scope for the gateway call")
dbutils.widgets.text("expected_tools", "genie_ask,genie_poll_response", "Comma-separated tools that must exist")
dbutils.widgets.text("ask_question", "what is databricks lakebase?", "Optional: question for genie_ask (blank = skip)")
dbutils.widgets.text("poll_timeout_seconds", "120", "Max seconds to poll genie_poll_response")

secret_scope_name = dbutils.widgets.get("secret_scope_name")
m2m_client_id_dbs_key = dbutils.widgets.get("m2m_client_id_dbs_key")
m2m_client_secret_dbs_key = dbutils.widgets.get("m2m_client_secret_dbs_key")
workspace_url = dbutils.widgets.get("workspace_url")
mcp_service_name = dbutils.widgets.get("mcp_service_name")
oauth_scope = dbutils.widgets.get("oauth_scope")
expected_tools = [t.strip() for t in dbutils.widgets.get("expected_tools").split(",") if t.strip()]
ask_question = dbutils.widgets.get("ask_question").strip()
poll_timeout_seconds = int(dbutils.widgets.get("poll_timeout_seconds"))

print(f"secret_scope_name={secret_scope_name}")
print(f"m2m_client_id_dbs_key={m2m_client_id_dbs_key}")
print(f"m2m_client_secret_dbs_key={m2m_client_secret_dbs_key}")
print(f"mcp_service_name={mcp_service_name}")
print(f"oauth_scope={oauth_scope}")
print(f"expected_tools={expected_tools}")
print(f"ask_question={'(skip)' if not ask_question else ask_question}")
print(f"poll_timeout_seconds={poll_timeout_seconds}")

# COMMAND ----------

# --- Load src/lib ---
import sys
from pathlib import Path

notebook_path = (
    dbutils.notebook.entry_point.getDbutils()
    .notebook()
    .getContext()
    .notebookPath()
    .get()
)
lib_path = str(
    Path("/Workspace")
    / Path(notebook_path).parent.relative_to("/")
    / ".."
    / "lib"
)
if lib_path not in sys.path:
    sys.path.insert(0, lib_path)

from mcp_client import (
    McpError,
    McpHttpClient,
    extract_text_content,
    gateway_mcp_url,
    get_m2m_access_token,
    parse_text_as_json,
)

print(f"Loaded lib from: {lib_path}")

# COMMAND ----------

# --- Step 1: Mint M2M token (ai-gateway scope) ---
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
workspace_url = (workspace_url or w.config.host).rstrip("/")

client_id = dbutils.secrets.get(secret_scope_name, m2m_client_id_dbs_key)
client_secret = dbutils.secrets.get(secret_scope_name, m2m_client_secret_dbs_key)

try:
    access_token = get_m2m_access_token(workspace_url, client_id, client_secret, oauth_scope)
except McpError as e:
    raise RuntimeError(
        f"Token exchange failed: {e}\n"
        f"  - HTTP 400/401 with a scope error: the secret was not generated with '{oauth_scope}'.\n"
        f"    Regenerate it with the scopes in var.m2m_oauth_scopes (see runbook)."
    ) from e

print(f"Step 1 PASSED: M2M token minted (scope={oauth_scope}, client_id={client_id[:8]}...)")

# COMMAND ----------

# --- Step 2: MCP initialize handshake ---
url = gateway_mcp_url(workspace_url, mcp_service_name)
mcp = McpHttpClient(url, access_token)

try:
    init_result = mcp.initialize()
except McpError as e:
    hint = {
        401: "token rejected by Unity Gateway; confirm the token has the ai-gateway scope",
        403: f"SPN lacks access to {mcp_service_name} (EXECUTE grant or MCP policy)",
        404: f"MCP service {mcp_service_name} not found",
    }.get(e.status_code, "see error above")
    raise RuntimeError(f"MCP initialize failed: {e}\n  Hint: {hint}") from e

print(f"Step 2 PASSED: initialize OK")
print(f"  URL:          {url}")
print(f"  Server:       {mcp.server_info.get('name')} {mcp.server_info.get('version')}")
print(f"  Protocol:     {mcp.protocol_version}")
print(f"  Session:      {'yes' if mcp.session_id else 'none (stateless)'}")

# COMMAND ----------

# --- Step 3: tools/list ---
tools = mcp.list_tools()
tool_names = [t["name"] for t in tools]

print(f"Discovered {len(tools)} tool(s):")
for t in tools:
    required = t.get("inputSchema", {}).get("required", [])
    print(f"  - {t['name']}  (required: {required})")

missing = [name for name in expected_tools if name not in tool_names]
if not tools:
    raise AssertionError(f"tools/list returned no tools for {mcp_service_name}")
if missing:
    raise AssertionError(f"Expected tools missing from {mcp_service_name}: {missing}")

print(f"Step 3 PASSED: expected tools present: {expected_tools}")

# COMMAND ----------

# --- Step 4: genie_ask + genie_poll_response ---
# On by default with a general-knowledge question (no data grants needed).
# Data questions depend on the SPN's grants (OBO). Set ask_question blank to skip.
import time

ask_status = "skipped"
poll_status = "skipped"
poll_answer = None

if not ask_question:
    print("Step 4 SKIPPED: ask_question not set")

# COMMAND ----------

# --- Step 4a: genie_ask ---
if ask_question:
    print(f"Asking: {ask_question}")
    ask_result = mcp.call_tool("genie_ask", {"question": ask_question})
    ask_is_error = bool(ask_result.get("isError"))
    ask_text = extract_text_content(ask_result)
    ask_data = parse_text_as_json(ask_result)

    print(f"genie_ask isError={ask_is_error}")
    print(f"Response keys: {list(ask_data.keys())}")
    print(f"Response text: {ask_text[:600]}")

    if ask_is_error:
        ask_status = "error"
        raise AssertionError(f"genie_ask returned isError=true: {ask_text[:500]}")
    ask_status = "ok"

    # Extract conversation_id and response_id for polling.
    # Genie One returns these in the text content as JSON.
    conversation_id = ask_data.get("conversation_id")
    response_id = ask_data.get("response_id") or ask_data.get("message_id")

    if not conversation_id or not response_id:
        print(f"WARNING: could not find conversation_id/response_id in genie_ask response")
        print(f"  Available keys: {list(ask_data.keys())}")
        print(f"  Full text: {ask_text[:1000]}")
        poll_status = "skipped_no_ids"
    else:
        print(f"\nStep 4a PASSED: genie_ask accepted")
        print(f"  conversation_id={conversation_id}")
        print(f"  response_id={response_id}")

# COMMAND ----------

# --- Step 4b: genie_poll_response ---
# Genie One response shapes (observed 2026-10-13):
#   - genie_ask returns JSON: {response_id, conversation_id, status: "in_progress"}
#   - genie_poll_response while in-flight: JSON {status: "in_progress", ...}
#   - genie_poll_response when done: rendered MARKDOWN text (not JSON) starting
#     with <!-- agent: Genie has finished ... -->. The answer is the text itself.
#   - genie_poll_response on error: isError=true, text has the error message.
#
# Completion detection:
#   1. isError=true                       → FAILED
#   2. Text is non-empty AND not parseable as JSON with status=in_progress → COMPLETED
#   3. JSON with status in {completed, failed, cancelled, error} → terminal
#   4. Otherwise (empty text or JSON in_progress)            → keep polling

POLL_INTERVAL_BASE = 3  # seconds; doubles each retry up to 15s

def _classify_poll(poll_result):
    """Return (status_label, text, parsed_json) for a poll response."""
    is_error = bool(poll_result.get("isError"))
    text = extract_text_content(poll_result)
    data = parse_text_as_json(poll_result)

    if is_error:
        return "FAILED", text, data

    # If the text parses as JSON with a status field, use it
    json_status = (data.get("status") or data.get("state") or "").upper()
    if json_status in {"COMPLETED", "COMPLETE", "FAILED", "CANCELLED", "ERROR"}:
        return json_status, text, data
    if json_status == "IN_PROGRESS" or json_status == "EXECUTING_QUERY":
        return "IN_PROGRESS", text, data

    # Non-JSON, non-empty text = Genie finished and returned rendered markdown.
    # Exception: Genie sometimes returns a "still running" message as plain text
    # on the first poll before it has actual results. Treat that as in-progress.
    if text and "_raw_text" in data:
        lower = text.lower()
        if "still running" in lower or "no progress steps yet" in lower:
            return "IN_PROGRESS", text, data
        return "COMPLETED", text, data

    # Empty or unrecognised
    return "IN_PROGRESS" if not text else "UNKNOWN", text, data


if ask_question and poll_status != "skipped_no_ids":
    print(f"Polling genie_poll_response (timeout={poll_timeout_seconds}s) ...")
    start = time.time()
    polls = 0
    interval = POLL_INTERVAL_BASE
    last_status = "IN_PROGRESS"
    last_text = ""
    poll_data = {}

    while True:
        elapsed = time.time() - start
        if elapsed >= poll_timeout_seconds:
            poll_status = "timeout"
            print(f"  Timed out after {elapsed:.0f}s ({polls} poll(s)), last status={last_status}")
            break

        polls += 1
        try:
            poll_result = mcp.call_tool("genie_poll_response", {
                "conversation_id": conversation_id,
                "response_id": response_id,
            })
        except McpError as e:
            print(f"  Poll #{polls}: McpError ({e.status_code}): {e}")
            if polls >= 3:
                poll_status = "error"
                raise
            time.sleep(interval)
            interval = min(interval * 2, 15)
            continue

        last_status, last_text, poll_data = _classify_poll(poll_result)
        print(f"  Poll #{polls}: status={last_status}  elapsed={elapsed:.0f}s  text_len={len(last_text)}")

        if last_status not in {"IN_PROGRESS", "EXECUTING_QUERY", "UNKNOWN"}:
            break

        time.sleep(interval)
        interval = min(interval * 2, 15)

    # Evaluate final state
    if last_status == "FAILED":
        poll_status = "error"
        print(f"  genie_poll_response FAILED: {last_text[:500]}")
        raise AssertionError(
            f"genie_poll_response returned error after {polls} poll(s): {last_text[:300]}"
        )
    elif last_status in {"COMPLETED", "COMPLETE"}:
        poll_status = "completed"
        poll_answer = last_text[:2000]
        # Strip the HTML comment prefix for display
        display = poll_answer.lstrip()
        if display.startswith("<!--"):
            end = display.find("-->")
            if end > 0:
                display = display[end + 3:].strip()
        print(f"\n  Answer (first 800 chars):")
        print(f"  {display[:800]}")
        print(f"\nStep 4b PASSED: genie_poll_response completed in {polls} poll(s), {elapsed:.0f}s")
    elif poll_status == "timeout":
        # Warn but don't fail — Genie may be slow; reachability was already proved
        print(f"  WARNING: poll timed out; genie_ask was accepted but answer not received.")
        print(f"  Last text ({len(last_text)} chars): {last_text[:300]}")
    else:
        poll_status = last_status.lower()
        print(f"  Terminal status: {last_status}")
        print(f"  Response: {last_text[:500]}")
        raise AssertionError(f"genie_poll_response ended with status={last_status}")

    print(f"  Response shape: keys={list(poll_data.keys())}, is_json={'_raw_text' not in poll_data}")

# COMMAND ----------

# --- Task values + summary ---
import json as _json  # avoid shadowing earlier import

dbutils.jobs.taskValues.set(key="genie_one_mcp_reachable", value="true")
dbutils.jobs.taskValues.set(key="genie_one_mcp_tool_count", value=str(len(tools)))
dbutils.jobs.taskValues.set(key="genie_one_ask_status", value=ask_status)
dbutils.jobs.taskValues.set(key="genie_one_poll_status", value=poll_status)

summary = {
    "mcp_service": mcp_service_name,
    "url": url,
    "oauth_scope": oauth_scope,
    "server": mcp.server_info,
    "protocol_version": mcp.protocol_version,
    "tools": tool_names,
    "genie_ask": ask_status,
    "genie_poll": poll_status,
}
if poll_answer:
    summary["answer_preview"] = poll_answer[:500]
print("=" * 72)
print(_json.dumps(summary, indent=2))
print("=" * 72)
print("Genie One MCP smoke test PASSED")
