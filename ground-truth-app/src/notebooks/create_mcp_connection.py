"""create_mcp_connection.py

Creates or updates a schema-level UC HTTP connection for the MCP service.
Schema-level connections require CREATE CONNECTION on the schema (not the
metastore), which is covered by ALL PRIVILEGES on the catalog.

Run by: deploy.sh Phase 2 via `databricks bundle run create_mcp_connection`
Executed as spark_python_task on serverless compute.

Parameters (passed as --key=value via {{job.parameters.*}}):
  --connection_name   Short connection name (flat, no dots)
  --catalog           UC catalog for the schema-level connection
  --schema_name       UC schema for the schema-level connection
  --app_url           App URL (e.g. https://dev-semantic-ground-truth-....com)
  --base_path         MCP endpoint path (default /mcp)
  --scope_name        UC secret scope for M2M credentials
  --client_id_key     Secret key name for M2M client_id
  --client_secret_key Secret key name for M2M client_secret
  --oauth_scopes      OAuth scopes for token exchange
  --token_endpoint    OAuth token endpoint URL
"""
import argparse
import json
import sys

from databricks.sdk import WorkspaceClient


def _get_secret(scope: str, key: str) -> str:
    """Read a secret value via dbutils (Spark compute) or SDK fallback."""
    try:
        from pyspark.sql import SparkSession
        from pyspark.dbutils import DBUtils

        spark = SparkSession.builder.getOrCreate()
        return DBUtils(spark).secrets.get(scope=scope, key=key)
    except Exception:
        pass
    # Fallback: REST API (base64-encoded response)
    import base64

    w = WorkspaceClient()
    resp = w.api_client.do(
        "GET", "/api/2.0/secrets/get", query={"scope": scope, "key": key}
    )
    return base64.b64decode(resp["value"]).decode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create/update schema-level MCP HTTP connection"
    )
    parser.add_argument("--connection_name", required=True)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--schema_name", required=True)
    parser.add_argument("--app_url", required=True)
    parser.add_argument("--base_path", default="/mcp")
    parser.add_argument("--scope_name", required=True)
    parser.add_argument("--client_id_key", required=True)
    parser.add_argument("--client_secret_key", required=True)
    parser.add_argument("--oauth_scopes", default="apps ai-gateway")
    parser.add_argument("--token_endpoint", required=True)
    args = parser.parse_args()

    full_name = f"{args.catalog}.{args.schema_name}.{args.connection_name}"
    parent = f"schemas/{args.catalog}.{args.schema_name}"

    # ------------------------------------------------------------------ #
    # Read M2M credentials from secret scope
    # ------------------------------------------------------------------ #
    print(f"Reading credentials from scope={args.scope_name}")
    client_id = _get_secret(args.scope_name, args.client_id_key)
    client_secret = _get_secret(args.scope_name, args.client_secret_key)

    if not client_id or not client_secret:
        print(
            "ERROR: Could not read M2M credentials from secret scope.",
            file=sys.stderr,
        )
        sys.exit(1)

    options = {
        "host": args.app_url,
        "port": "443",
        "base_path": args.base_path,
        "client_id": client_id,
        "client_secret": client_secret,
        "oauth_scope": args.oauth_scopes,
        "token_endpoint": args.token_endpoint,
    }

    w = WorkspaceClient()

    # ------------------------------------------------------------------ #
    # Create or update
    # ------------------------------------------------------------------ #
    try:
        existing = w.api_client.do(
            "GET", f"/api/2.1/unity-catalog/connections/{full_name}"
        )
        print(f"Connection exists: {full_name} (updating options)")
        result = w.api_client.do(
            "PATCH",
            f"/api/2.1/unity-catalog/connections/{full_name}",
            body={"options": options},
        )
        print(f"Updated: {result.get('full_name', full_name)}")
    except Exception as e:
        err = str(e)
        if "does not exist" in err or "NOT_FOUND" in err:
            print(f"Connection does not exist \u2014 creating: {full_name}")
            result = w.api_client.do(
                "POST",
                "/api/2.1/unity-catalog/connections",
                body={
                    "name": args.connection_name,
                    "parent": parent,
                    "connection_type": "HTTP",
                    "options": options,
                },
            )
            print(f"Created: {result.get('full_name', full_name)}")
        else:
            print(f"ERROR checking connection: {e}", file=sys.stderr)
            raise

    # ------------------------------------------------------------------ #
    # Verify
    # ------------------------------------------------------------------ #
    verify = w.api_client.do(
        "GET", f"/api/2.1/unity-catalog/connections/{full_name}"
    )
    print(f"Verified: {verify.get('full_name')}")
    print(f"  credential_type: {verify.get('credential_type')}")
    print(f"  url: {verify.get('url')}")
    # Redact secrets from the options before printing
    safe_opts = {
        k: v
        for k, v in verify.get("options", {}).items()
        if k not in ("client_secret",)
    }
    print(f"  options: {json.dumps(safe_opts, indent=2)}")


if __name__ == "__main__":
    main()
