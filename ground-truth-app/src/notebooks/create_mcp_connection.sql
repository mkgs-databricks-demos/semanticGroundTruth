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

-- Create connection if it doesn't exist (first deploy).
-- DDL identifiers and OPTIONS literals don't bind :param — use EXECUTE IMMEDIATE.
EXECUTE IMMEDIATE CONCAT(
  'CREATE CONNECTION IF NOT EXISTS `', v_connection_name, '` TYPE HTTP OPTIONS (',
    'host ''',          v_app_url,           ''', ',
    'base_path ''',     v_base_path,         ''', ',
    'client_id secret(''',     v_scope_name, ''', ''', v_client_id_key,     '''), ',
    'client_secret secret(''', v_scope_name, ''', ''', v_client_secret_key, '''), ',
    'oauth_scope ''',   v_oauth_scopes,      ''', ',
    'token_endpoint ''', v_token_endpoint,   '''',
  ')'
);

-- Ensure options are current (handles app URL changes and credential rotations).
-- ALTER is idempotent — safe to run even if CREATE just succeeded above.
EXECUTE IMMEDIATE CONCAT(
  'ALTER CONNECTION `', v_connection_name, '` SET OPTIONS (',
    'host ''',          v_app_url,           ''', ',
    'base_path ''',     v_base_path,         ''', ',
    'client_id secret(''',     v_scope_name, ''', ''', v_client_id_key,     '''), ',
    'client_secret secret(''', v_scope_name, ''', ''', v_client_secret_key, '''), ',
    'oauth_scope ''',   v_oauth_scopes,      ''', ',
    'token_endpoint ''', v_token_endpoint,   '''',
  ')'
);

-- Verify: surface connection details for the job run output
EXECUTE IMMEDIATE CONCAT('DESCRIBE CONNECTION `', v_connection_name, '`');
