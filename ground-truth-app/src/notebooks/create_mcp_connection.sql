-- create_mcp_connection.sql
-- Creates or updates the UC HTTP connection for the MCP service.
--
-- Run by: deploy.sh Phase 2 via `databricks bundle run create_mcp_connection`
-- Executed as sql_task.file against the SQL warehouse.
-- Design source: app_bundle_support_plan.md §2c
--
-- Parameters (passed via --params from deploy.sh, bound as :param):
--   connection_name:   UC connection name (flat, metastore-level)
--   app_url:           App URL from bundle summary
--   base_path:         MCP endpoint path (default /mcp)
--   scope_name:        UC secret scope for M2M credentials
--   client_id_key:     Secret key name for M2M client_id
--   client_secret_key: Secret key name for M2M client_secret
--   oauth_scopes:      OAuth scopes for token exchange
--   token_endpoint:    OAuth token endpoint URL

-- Declare session variables from job parameters
DECLARE OR REPLACE VARIABLE v_connection_name STRING;
DECLARE OR REPLACE VARIABLE v_app_url STRING;
DECLARE OR REPLACE VARIABLE v_base_path STRING;
DECLARE OR REPLACE VARIABLE v_scope_name STRING;
DECLARE OR REPLACE VARIABLE v_client_id_key STRING;
DECLARE OR REPLACE VARIABLE v_client_secret_key STRING;
DECLARE OR REPLACE VARIABLE v_oauth_scopes STRING;
DECLARE OR REPLACE VARIABLE v_token_endpoint STRING;

SET VAR v_connection_name   = :connection_name;
SET VAR v_app_url           = :app_url;
SET VAR v_base_path         = :base_path;
SET VAR v_scope_name        = :scope_name;
SET VAR v_client_id_key     = :client_id_key;
SET VAR v_client_secret_key = :client_secret_key;
SET VAR v_oauth_scopes      = :oauth_scopes;
SET VAR v_token_endpoint    = :token_endpoint;

-- Shared OPTIONS clause. format_string() with a double-quoted template keeps the
-- single quotes literal. Do NOT use '' escapes inside CONCAT: Databricks SQL
-- parses 'abc''' as two adjacent literals ('abc' + ''), silently dropping quotes.
DECLARE OR REPLACE VARIABLE v_options STRING;
SET VAR v_options = format_string(
  "host '%s', base_path '%s', client_id secret('%s', '%s'), client_secret secret('%s', '%s'), oauth_scope '%s', token_endpoint '%s'",
  v_app_url, v_base_path,
  v_scope_name, v_client_id_key,
  v_scope_name, v_client_secret_key,
  v_oauth_scopes, v_token_endpoint
);

-- Create connection if it doesn't exist (first deploy).
-- DDL identifiers and OPTIONS literals don't bind :param — use EXECUTE IMMEDIATE.
EXECUTE IMMEDIATE format_string(
  "CREATE CONNECTION IF NOT EXISTS `%s` TYPE HTTP OPTIONS (%s)",
  v_connection_name, v_options
);

-- Ensure options are current (handles app URL changes and credential rotations).
-- Syntax is ALTER CONNECTION <name> OPTIONS (...) — no SET keyword.
EXECUTE IMMEDIATE format_string(
  "ALTER CONNECTION `%s` OPTIONS (%s)",
  v_connection_name, v_options
);

-- Verify: surface connection details for the job run output
EXECUTE IMMEDIATE format_string("DESCRIBE CONNECTION `%s`", v_connection_name);
