"""Minimal MCP (Model Context Protocol) client for Unity Gateway MCP services.

Used by smoke tests to exercise MCP services through Unity Gateway with the
bundle-owned OAuth M2M service principal:

    https://<workspace>/ai-gateway/mcp-services/<catalog>.<schema>.<mcp_service>

Example: Genie One = ``system.ai.genie_one_mcp``. The caller token needs the
``ai-gateway`` OAuth scope.

Implements the Streamable HTTP transport handshake:
``initialize`` -> ``notifications/initialized`` -> ``tools/list`` / ``tools/call``.
Responses may be ``application/json`` or ``text/event-stream`` (SSE); both are
handled. Verified against system.ai.genie_one_mcp on 2026-10-13
(protocol 2025-06-18, JSON responses, ``Mcp-Session-Id`` header).
"""

import json
import time as _time
from typing import Any, Dict, List, Optional

import requests

DEFAULT_PROTOCOL_VERSION = "2025-06-18"
DEFAULT_TIMEOUT = 120  # seconds; Unity Gateway can be slow on cold start
_TRANSIENT_RETRY_ATTEMPTS = 3
_TRANSIENT_RETRY_SLEEP = 5  # seconds between retries


class McpError(RuntimeError):
    """Raised when an MCP HTTP call or JSON-RPC response fails."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def get_m2m_access_token(
    workspace_url: str,
    client_id: str,
    client_secret: str,
    oauth_scopes: str,
) -> str:
    """Mint an OAuth M2M access token via the workspace OIDC endpoint.

    Args:
        workspace_url: e.g. https://host.cloud.databricks.com
        client_id: SPN application_id.
        client_secret: SPN OAuth secret (must include ``oauth_scopes``).
        oauth_scopes: Space-separated scopes to request (subset of the secret's).

    Returns:
        The bearer access token. Never log it.
    """
    resp = requests.post(
        f"{workspace_url.rstrip('/')}/oidc/v1/token",
        auth=(client_id, client_secret),
        data={"grant_type": "client_credentials", "scope": oauth_scopes},
        timeout=30,
    )
    if not resp.ok:
        raise McpError(
            f"Token request failed (HTTP {resp.status_code}) for scope "
            f"'{oauth_scopes}': {resp.text[:300]}",
            resp.status_code,
        )
    return resp.json()["access_token"]


def gateway_mcp_url(workspace_url: str, mcp_service_full_name: str) -> str:
    """Unity Gateway URL for a UC MCP service (``catalog.schema.name``)."""
    return f"{workspace_url.rstrip('/')}/ai-gateway/mcp-services/{mcp_service_full_name}"


def _parse_response(resp: requests.Response) -> Any:
    """Parse a JSON or SSE MCP response; return the last JSON-RPC message."""
    content_type = resp.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        messages = [
            json.loads(line[5:].strip())
            for line in resp.text.splitlines()
            if line.startswith("data:") and line[5:].strip()
        ]
        return messages[-1] if messages else None
    if not resp.content:
        return None
    return resp.json()


def extract_text_content(tool_result: Dict[str, Any]) -> str:
    """Join all ``text`` content items from a ``tools/call`` result."""
    return " ".join(
        c.get("text", "")
        for c in tool_result.get("content", [])
        if c.get("type") == "text"
    ).strip()


def parse_text_as_json(tool_result: Dict[str, Any]) -> Dict[str, Any]:
    """Best-effort: extract text content and parse it as JSON.

    Returns an empty dict if the text is not valid JSON.
    """
    text = extract_text_content(tool_result)
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"_raw": parsed}
    except (json.JSONDecodeError, TypeError):
        return {"_raw_text": text}


class McpHttpClient:
    """Stateful MCP Streamable HTTP client (one session per instance)."""

    def __init__(
        self,
        url: str,
        access_token: str,
        protocol_version: str = DEFAULT_PROTOCOL_VERSION,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        self.url = url
        self.protocol_version = protocol_version
        self.timeout = timeout
        self.session_id: Optional[str] = None
        self.server_info: Dict[str, Any] = {}
        self._next_id = 1
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

    def _post(self, payload: Dict[str, Any]) -> requests.Response:
        """POST a JSON-RPC payload; retries on transient connection/timeout errors."""
        headers = dict(self._headers)
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
            headers["MCP-Protocol-Version"] = self.protocol_version
        method = payload.get("method", "?")
        last_exc: Optional[Exception] = None
        for attempt in range(1, _TRANSIENT_RETRY_ATTEMPTS + 1):
            try:
                resp = requests.post(
                    self.url, headers=headers, json=payload, timeout=self.timeout
                )
                if not resp.ok:
                    raise McpError(
                        f"{method} failed (HTTP {resp.status_code}): {resp.text[:300]}",
                        resp.status_code,
                    )
                return resp
            except McpError:
                raise  # HTTP-level errors are not retried
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
                last_exc = exc
                if attempt < _TRANSIENT_RETRY_ATTEMPTS:
                    _time.sleep(_TRANSIENT_RETRY_SLEEP)
                continue
        raise McpError(
            f"{method} timed out after {_TRANSIENT_RETRY_ATTEMPTS} attempt(s) "
            f"(timeout={self.timeout}s each): {last_exc}"
        )

    def _request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        request_id = self._next_id
        self._next_id += 1
        resp = self._post(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}}
        )
        message = _parse_response(resp)
        if not isinstance(message, dict):
            raise McpError(f"{method}: unexpected response body: {str(message)[:300]}")
        if "error" in message:
            raise McpError(f"{method}: JSON-RPC error {message['error']}")
        return message.get("result", {})

    def initialize(self, client_name: str = "ground-truth-smoke-test") -> Dict[str, Any]:
        """Run the initialize handshake and send notifications/initialized."""
        request_id = self._next_id
        self._next_id += 1
        resp = self._post(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": self.protocol_version,
                    "capabilities": {},
                    "clientInfo": {"name": client_name, "version": "0.1.0"},
                },
            }
        )
        self.session_id = resp.headers.get("mcp-session-id")
        message = _parse_response(resp)
        if not isinstance(message, dict) or "error" in message:
            raise McpError(f"initialize: bad response: {str(message)[:300]}")
        result = message.get("result", {})
        self.server_info = result.get("serverInfo", {})
        negotiated = result.get("protocolVersion")
        if negotiated:
            self.protocol_version = negotiated
        # Notification: no id, no response body expected (HTTP 202/204)
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return result

    def list_tools(self) -> List[Dict[str, Any]]:
        """Return all tools, following pagination cursors."""
        tools: List[Dict[str, Any]] = []
        cursor: Optional[str] = None
        while True:
            result = self._request("tools/list", {"cursor": cursor} if cursor else {})
            tools.extend(result.get("tools", []))
            cursor = result.get("nextCursor")
            if not cursor:
                return tools

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool; returns the MCP result (``content``, ``isError``, ...)."""
        return self._request("tools/call", {"name": name, "arguments": arguments})
