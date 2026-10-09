#!/usr/bin/env bash
# deploy.sh — Shared deployment script for the Semantic Ground Truth solution.
#
# Deploys Declarative Automation Bundles in dependency order:
#   1. ground-truth-infra    (UC schema, warehouse, Lakebase, secret scope, MCP service, jobs)
#   2. ground-truth-app      (AppKit app: Node.js + React, migrations, MCP server)  [Bundle 2]
#   3. ground-truth-agent    (Genie Agent: operational agent, tool definitions)      [Bundle 3]
#
# Pre-deploy steps (before infra bundle deploy):
#   - Resolves catalog, schema, workspace URL from bundle summary
#   - Resolves MCP connection name (connection created post-Bundle 2)
#   - Resolves M2M SPN secret key names and display-name prefix
#
# Post-deploy steps (after infra bundle deploy):
#   - check_m2m_credentials: non-fatal check of the M2M SPN credential contract.
#     client_id is auto-provisioned by the ensure_m2m_service_principal task;
#     client_secret is admin-provisioned. Prints an ADMIN ACTION block when the
#     secret is missing (see ground-truth-infra/docs/runbooks/m2m-service-principal.md).
#
# NOTE on MCP connection & service (hi-genie-orchestrator pattern):
#   HTTP connections ALWAYS require valid credentials at creation time:
#     - REST API → DCR (workspace may not support it)
#     - SQL DDL without creds → falls back to DCR
#     - SQL DDL with creds → validates token exchange immediately
#   Therefore: connection + MCP service are POST-deploy steps, created after
#   Bundle 2 deploys the app. The connection uses the bundle-owned M2M SPN
#   credentials (created by the ensure_m2m_service_principal task), NOT the
#   app's auto-provisioned SPN. See docs/plans/m2m_service_principal_plan.md.
#   The setup_gateway_connection notebook (post_deploy_setup job) handles both
#   connection creation (via SQL DDL with secret() refs) and MCP service
#   registration. The MCP service DAB resource is kept for declarative tracking
#   but will fail until the connection exists — this is expected and documented.
#
# Usage:
#   ./deploy.sh --target dev                             # deploy all bundles
#   ./deploy.sh --target dev --infra                     # deploy only infra bundle
#   ./deploy.sh --target dev --infra --run-setup         # deploy infra + force post-deploy setup
#   ./deploy.sh --target dev --app                       # deploy only app bundle
#   ./deploy.sh --target dev --agent                     # deploy only agent bundle
#   ./deploy.sh --target dev --validate                  # validate only, no deploy
#   ./deploy.sh --target dev --destroy                   # destroy deployed resources
#
# Requirements:
#   - Databricks CLI installed and authenticated (databricks auth login)
#   - python3 (for JSON parsing of CLI output)

set -euo pipefail

# --------------------------------------------------------------------------- #
# Self-relocation — avoid FUSE filesystem staleness on long-running operations
#
# The Databricks web terminal mounts /Workspace via FUSE. After long-running
# CLI commands (e.g. bundle run polling for 2+ minutes), the FUSE mount can
# become stale, causing "error reading input file: Operation not permitted".
#
# Fix: if running from /Workspace, copy to /tmp and re-exec from local disk.
# --------------------------------------------------------------------------- #
if [[ "${BASH_SOURCE[0]}" == /Workspace/* ]] && [[ "${__DEPLOY_RELOCATED:-}" != "1" ]]; then
  _tmp_script="/tmp/gt_deploy_$$.sh"
  cp "${BASH_SOURCE[0]}" "${_tmp_script}"
  chmod +x "${_tmp_script}"
  export __DEPLOY_RELOCATED=1
  export __DEPLOY_ORIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec "${_tmp_script}" "$@"
fi
if [[ "${__DEPLOY_RELOCATED:-}" == "1" ]]; then
  trap 'rm -f "${BASH_SOURCE[0]}"' EXIT
fi

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
if [[ -n "${__DEPLOY_ORIG_DIR:-}" ]]; then
  SCRIPT_DIR="${__DEPLOY_ORIG_DIR}"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
INFRA_BUNDLE="ground-truth-infra"
APP_BUNDLE="ground-truth-app"
AGENT_BUNDLE="ground-truth-agent"

# MCP connection config
MCP_CONNECTION_SUFFIX="semantic-ground-truth-mcp"
MCP_BASE_PATH="/mcp"

# Resolved at runtime by resolve_infra_vars()
CATALOG=""
SCHEMA=""
SCOPE_NAME=""
WORKSPACE_HOST=""
SQL_WAREHOUSE_ID=""
LAKEBASE_PROJECT_ID=""
MCP_CONNECTION_NAME=""
M2M_CLIENT_ID_KEY=""
M2M_CLIENT_SECRET_KEY=""
M2M_SPN_PREFIX=""

# --------------------------------------------------------------------------- #
# Defaults
# --------------------------------------------------------------------------- #
TARGET=""
DEPLOY_INFRA=true
DEPLOY_APP=true
DEPLOY_AGENT=true
VALIDATE_ONLY=false
DESTROY=false
RUN_SETUP=false

# --------------------------------------------------------------------------- #
# Usage
# --------------------------------------------------------------------------- #
usage() {
  cat <<EOF
Usage: $(basename "$0") --target <target> [OPTIONS]

Options:
  --target <name>    Required. Bundle target (dev, prod).
  --infra            Deploy only the infrastructure bundle.
  --app              Deploy only the application bundle.
  --agent            Deploy only the agent bundle.
  --run-setup        Force post-deploy setup tasks (overrides run_setup=false in dev).
  --validate         Validate bundles without deploying.
  --destroy          Destroy deployed resources for the target.
  -h, --help         Show this help message.

Deployment order:
  1. ${INFRA_BUNDLE}     — shared infrastructure
  2. ${APP_BUNDLE}       — application (AppKit)
  3. ${AGENT_BUNDLE}     — operational Genie agent

First deployment:
  ./deploy.sh --target dev --infra --run-setup
  # Creates the M2M SPN and stores its client_id in the secret scope.
  # MCP service will fail (no connection yet — expected pre-Bundle 2).
  # Then: workspace admin generates the M2M OAuth secret and stores it
  #   (ground-truth-infra/docs/runbooks/m2m-service-principal.md),
  #   and provisions webhook secrets (see docs/runbooks/)
  ./deploy.sh --target dev --infra --run-setup
  # Verifies the M2M token exchange.
  ./deploy.sh --target dev --app
  # Then: run post_deploy_setup with app_url to create MCP connection,
  # and re-deploy infra to register the MCP service:
  ./deploy.sh --target dev --infra

Subsequent deploys (infra unchanged):
  ./deploy.sh --target dev --app
EOF
  exit 0
}

# --------------------------------------------------------------------------- #
# Parse arguments
# --------------------------------------------------------------------------- #
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)      TARGET="$2"; shift 2 ;;
    --infra)       DEPLOY_INFRA=true;  DEPLOY_APP=false; DEPLOY_AGENT=false; shift ;;
    --app)         DEPLOY_INFRA=false; DEPLOY_APP=true;  DEPLOY_AGENT=false; shift ;;
    --agent)       DEPLOY_INFRA=false; DEPLOY_APP=false; DEPLOY_AGENT=true;  shift ;;
    --run-setup)   RUN_SETUP=true; shift ;;
    --validate)    VALIDATE_ONLY=true; shift ;;
    --destroy)     DESTROY=true; shift ;;
    -h|--help)     usage ;;
    *)             echo "Error: Unknown option '$1'"; usage ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "Error: --target is required."
  usage
fi

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
log()  { echo -e "\n\033[1;34m==>\033[0m \033[1m$1\033[0m"; }
warn() { echo -e "\033[1;33m  ⚠  $1\033[0m"; }
ok()   { echo -e "\033[1;32m  ✓  $1\033[0m"; }
fail() { echo -e "\033[1;31m  ✗  $1\033[0m"; exit 1; }

# safe() — sanitise a value for shell interpolation (strips unsafe chars)
safe() { echo "$1" | sed 's/[^a-zA-Z0-9_.-]//g'; }

# safe_url() — like safe() but preserves :// for workspace URLs
safe_url() { echo "$1" | sed 's/[^a-zA-Z0-9_./:=-]//g'; }

# cd_bundle() — cd into a /Workspace directory with FUSE refresh and retry.
cd_bundle() {
  local dir="$1"
  local i
  for ((i=1; i<=3; i++)); do
    ls "${dir}" >/dev/null 2>&1 || true
    sleep 0.5
    if cd "${dir}" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  cd "${dir}"
}

# --------------------------------------------------------------------------- #
# Prerequisites
# --------------------------------------------------------------------------- #
command -v databricks &>/dev/null || fail "Databricks CLI not found."
command -v python3    &>/dev/null || fail "python3 not found (required for JSON parsing)."

# --------------------------------------------------------------------------- #
# deploy_bundle — validate and deploy (or destroy) a single bundle
# --------------------------------------------------------------------------- #
deploy_bundle() {
  local bundle_name="$1"
  shift
  local extra_args=("$@")
  local bundle_dir="${SCRIPT_DIR}/${bundle_name}"

  if [[ ! -d "${bundle_dir}" ]]; then
    warn "Bundle directory '${bundle_name}' does not exist yet — skipping."
    return 0
  fi

  if [[ ! -f "${bundle_dir}/databricks.yml" ]]; then
    warn "No databricks.yml found in '${bundle_name}' — skipping."
    return 0
  fi

  log "Validating ${bundle_name} (target: ${TARGET})"
  (cd_bundle "${bundle_dir}" && databricks bundle validate --target "${TARGET}")
  ok "Validation passed: ${bundle_name}"

  if [[ "${VALIDATE_ONLY}" == true ]]; then
    return 0
  fi

  if [[ "${DESTROY}" == true ]]; then
    log "Destroying ${bundle_name} (target: ${TARGET})"
    (cd_bundle "${bundle_dir}" && databricks bundle destroy --target "${TARGET}" --auto-approve)
    ok "Destroyed: ${bundle_name}"
  else
    log "Deploying ${bundle_name} (target: ${TARGET})"
    local deploy_rc=0
    if [[ ${#extra_args[@]} -gt 0 ]]; then
      (cd_bundle "${bundle_dir}" && databricks bundle deploy --target "${TARGET}" "${extra_args[@]}") || deploy_rc=$?
    else
      (cd_bundle "${bundle_dir}" && databricks bundle deploy --target "${TARGET}") || deploy_rc=$?
    fi
    if [[ ${deploy_rc} -eq 0 ]]; then
      ok "Deployed: ${bundle_name}"
    else
      warn "Deploy completed with errors (exit ${deploy_rc}). Some resources may have failed."
      warn "Check output above. Common expected failures:"
      warn "  - MCP service: connection doesn't exist yet (pre-Bundle 2)"
      warn "  - Job run: notebooks not committed to Git branch"
    fi
  fi
}

# --------------------------------------------------------------------------- #
# resolve_infra_vars — extract resolved values from the infra bundle summary
# --------------------------------------------------------------------------- #
resolve_infra_vars() {
  local bundle_dir="${SCRIPT_DIR}/${INFRA_BUNDLE}"

  log "Resolving infrastructure variables (target: ${TARGET})"

  local summary_json
  summary_json=$(cd "${bundle_dir}" && databricks bundle summary --target "${TARGET}" --output json 2>/dev/null) || {
    fail "Could not read bundle summary for ${INFRA_BUNDLE}.\n" \
         "  Deploy the infra bundle first:\n" \
         "    cd ${bundle_dir} && databricks bundle deploy --target ${TARGET}"
  }

  eval "$(echo "${summary_json}" | python3 -c "
import sys, json, re

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f'RESOLVE_ERROR=\"JSON parse error: {e}\"', flush=True)
    sys.exit(0)

vars_block = data.get('variables', {})

def get_var(name, default=''):
    v = vars_block.get(name, {})
    if isinstance(v, dict):
        return v.get('value', default)
    return str(v) if v else default

# --- catalog and schema (prefer resource, fall back to variable) ---
catalog = ''
schema  = ''
resources = data.get('resources', {})
schemas_block = resources.get('schemas', {})
for schema_name, ws in schemas_block.items():
    if isinstance(ws, dict):
        catalog = ws.get('catalog_name', '')
        schema  = ws.get('name', '')

if not catalog:
    catalog = get_var('catalog')
if not schema:
    schema = get_var('schema')

# --- secret_scope_name ---
scope = get_var('secret_scope_name', 'semantic_ground_truth_credentials')

# --- sql_warehouse_id ---
warehouse_id = ''
wh_block = resources.get('sql_warehouses', {})
for wh_name, wh in wh_block.items():
    if isinstance(wh, dict):
        warehouse_id = wh.get('id', '')
        if warehouse_id:
            break

# --- lakebase_project_id ---
project_id = ''
pg_projects = resources.get('postgres_projects', {})
for proj_name, proj in pg_projects.items():
    if isinstance(proj, dict):
        project_id = proj.get('project_id', '')
        if project_id:
            break

# --- M2M service principal contract ---
m2m_id_key     = get_var('m2m_client_id_dbs_key')
m2m_secret_key = get_var('m2m_client_secret_dbs_key')
m2m_prefix     = get_var('m2m_spn_prefix', 'semantic-ground-truth-m2m')

# --- workspace host ---
workspace_host = ''
workspace_block = data.get('workspace', {})
if isinstance(workspace_block, dict):
    workspace_host = workspace_block.get('host', '')

def safe(v):
    return re.sub(r'[^a-zA-Z0-9_.\\-]', '', str(v))

def safe_url(v):
    return re.sub(r'[^a-zA-Z0-9_.\\-:/]', '', str(v))

print(f'CATALOG=\"{safe(catalog)}\"')
print(f'SCHEMA=\"{safe(schema)}\"')
print(f'SCOPE_NAME=\"{safe(scope)}\"')
print(f'WORKSPACE_HOST=\"{safe_url(workspace_host)}\"')
print(f'SQL_WAREHOUSE_ID=\"{safe(warehouse_id)}\"')
print(f'LAKEBASE_PROJECT_ID=\"{safe(project_id)}\"')
print(f'M2M_CLIENT_ID_KEY=\"{safe(m2m_id_key)}\"')
print(f'M2M_CLIENT_SECRET_KEY=\"{safe(m2m_secret_key)}\"')
print(f'M2M_SPN_PREFIX=\"{safe(m2m_prefix)}\"')
" 2>/dev/null)" || fail "Could not parse bundle summary JSON."

  if [[ -n "${RESOLVE_ERROR:-}" ]]; then
    fail "resolve_infra_vars failed: ${RESOLVE_ERROR}"
  fi

  # UC connections are metastore-level (flat names, no dots allowed)
  MCP_CONNECTION_NAME="${MCP_CONNECTION_SUFFIX}"

  ok "Resolved: catalog=${CATALOG}, schema=${SCHEMA}"
  ok "  scope=${SCOPE_NAME}, warehouse=${SQL_WAREHOUSE_ID}"
  ok "  workspace=${WORKSPACE_HOST}"
  ok "  mcp_connection=${MCP_CONNECTION_NAME}"
  ok "  m2m_spn_prefix=${M2M_SPN_PREFIX}"
  ok "  m2m_keys=${M2M_CLIENT_ID_KEY}, ${M2M_CLIENT_SECRET_KEY}"
}

# --------------------------------------------------------------------------- #
# ensure_http_connection — check if the HTTP connection exists for MCP service
#
# Connection creation requires valid M2M SPN credentials (admin-provisioned
# client_secret) and the app URL (only available after Bundle 2 deploys the
# app). The setup_gateway_connection notebook creates the connection via SQL
# DDL with secret() references to the M2M SPN keys (hi-genie pattern):
#
#   CREATE CONNECTION IF NOT EXISTS `name` TYPE HTTP OPTIONS (
#     host 'https://<app-url>',
#     base_path '/mcp',
#     client_id secret('<scope>', '<key>'),
#     client_secret secret('<scope>', '<key>'),
#     oauth_scope 'all-apis',
#     token_endpoint 'https://<workspace>/oidc/v1/token'
#   )
#
# This function only checks existence — creation is delegated to the notebook.
# --------------------------------------------------------------------------- #
ensure_http_connection() {
  local connection_name="${MCP_CONNECTION_NAME}"

  log "Checking HTTP connection: ${connection_name}"

  if databricks api get /api/2.1/unity-catalog/connections/"${connection_name}" >/dev/null 2>&1; then
    ok "Connection exists: ${connection_name}"
    return 0
  else
    warn "Connection '${connection_name}' does not exist yet."
    warn "It will be created by setup_gateway_connection after Bundle 2 deploys."
    return 1
  fi
}

# --------------------------------------------------------------------------- #
# check_m2m_credentials — verify the M2M SPN credential contract (non-fatal)
#
# The ensure_m2m_service_principal task (post_deploy_setup job) creates the
# bundle-owned OAuth M2M SPN and stores its client_id in the secret scope.
# The client_secret must be generated and stored by a workspace admin.
# This check NEVER fails the deploy — it reports status and prints admin
# instructions when the secret is missing. Secret values are never read.
# See: ground-truth-infra/docs/runbooks/m2m-service-principal.md
# --------------------------------------------------------------------------- #
check_m2m_credentials() {
  log "Checking M2M service principal credentials (scope: ${SCOPE_NAME})"

  if [[ -z "${M2M_CLIENT_ID_KEY}" || -z "${M2M_CLIENT_SECRET_KEY}" ]]; then
    warn "M2M secret key names not resolved from bundle summary — skipping check."
    return 0
  fi

  local secrets_json
  if ! secrets_json=$(databricks secrets list-secrets "${SCOPE_NAME}" --output json 2>/dev/null); then
    warn "Could not list secrets in scope '${SCOPE_NAME}' (missing scope or no access) — skipping check."
    return 0
  fi

  # Key names are passed via env vars (not interpolated into Python source)
  local key_status
  key_status=$(echo "${secrets_json}" | M2M_ID_KEY="${M2M_CLIENT_ID_KEY}" M2M_SECRET_KEY="${M2M_CLIENT_SECRET_KEY}" python3 -c '
import json, os, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("unknown unknown")
    sys.exit(0)
items = data if isinstance(data, list) else data.get("secrets", [])
keys = {i.get("key") for i in items if isinstance(i, dict)}
id_present = "yes" if os.environ["M2M_ID_KEY"] in keys else "no"
secret_present = "yes" if os.environ["M2M_SECRET_KEY"] in keys else "no"
print(f"{id_present} {secret_present}")
' 2>/dev/null) || key_status="unknown unknown"

  local id_present secret_present
  read -r id_present secret_present <<< "${key_status}"

  if [[ "${id_present}" == "unknown" || -z "${id_present}" ]]; then
    warn "Could not parse secret scope listing — skipping check."
    return 0
  fi

  if [[ "${id_present}" != "yes" ]]; then
    warn "M2M client_id key '${M2M_CLIENT_ID_KEY}' not found in scope."
    warn "The M2M SPN is created by the post_deploy_setup job. Re-run with:"
    warn "  ./deploy.sh --target ${TARGET} --infra --run-setup"
    return 0
  fi
  ok "M2M client_id present: ${M2M_CLIENT_ID_KEY}"

  if [[ "${secret_present}" == "yes" ]]; then
    ok "M2M client_secret present: ${M2M_CLIENT_SECRET_KEY}"
    ok "Token exchange is verified by ensure_m2m_service_principal on --run-setup deploys."
    return 0
  fi

  # Secret missing — resolve SPN details for the admin instructions
  local spn_display_name
  spn_display_name="${M2M_SPN_PREFIX}-$(safe "${TARGET}")"
  local spn_object_id="" spn_application_id="" spn_info
  if spn_info=$(databricks service-principals list --filter "displayName eq \"${spn_display_name}\"" --output json 2>/dev/null); then
    read -r spn_object_id spn_application_id <<< "$(echo "${spn_info}" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = []
items = data if isinstance(data, list) else data.get("Resources", [])
if items:
    print(items[0].get("id", ""), items[0].get("applicationId", ""))
' 2>/dev/null)"
  fi
  spn_object_id=$(safe "${spn_object_id:-UNKNOWN}")
  spn_application_id=$(safe "${spn_application_id:-UNKNOWN}")

  warn "M2M client_secret key '${M2M_CLIENT_SECRET_KEY}' not found in scope."
  cat <<EOF

  ┌─ ADMIN ACTION REQUIRED ────────────────────────────────────────────
  │ The M2M service principal exists but has no OAuth client secret yet.
  │   SPN display name:  ${spn_display_name}
  │   Application ID:    ${spn_application_id}
  │   Workspace obj ID:  ${spn_object_id}
  │
  │ 1. Generate the OAuth secret (workspace admin):
  │      Settings > Identity and access > Service principals > Manage
  │      > ${spn_display_name} > Secrets > Generate secret (<= 730 days)
  │    CLI alternative:
  │      databricks service-principal-secrets-proxy create ${spn_object_id}
  │
  │ 2. Store it in the bundle scope (interactive prompt, keeps it out of history):
  │      databricks secrets put-secret ${SCOPE_NAME} ${M2M_CLIENT_SECRET_KEY}
  │
  │ 3. Verify the token exchange:
  │      ./deploy.sh --target ${TARGET} --infra --run-setup
  │
  │ Runbook: ${INFRA_BUNDLE}/docs/runbooks/m2m-service-principal.md
  └──────────────────────────────────────────────────────────────────

EOF
  return 0
}

# =========================================================================== #
# Main
# =========================================================================== #

log "Semantic Ground Truth — Deploy (target: ${TARGET})"

# --------------------------------------------------------------------------- #
# Phase 1: Infrastructure bundle
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_INFRA}" == true ]]; then

  INFRA_EXTRA_ARGS=()
  if [[ "${RUN_SETUP}" == true ]]; then
    INFRA_EXTRA_ARGS+=("--var" "run_setup=true")
  fi

  # Step 1a: Resolve variables from bundle summary (works pre-deploy too)
  resolve_infra_vars

  # Step 1b: Check MCP connection status
  # Connection requires valid SPN credentials (only available after Bundle 2).
  # Pre-Bundle 2: MCP service resource will fail (expected, non-blocking).
  # Post-Bundle 2: setup_gateway_connection creates connection via SQL DDL,
  # then re-deploy infra succeeds for MCP service.
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    ensure_http_connection || true
  fi

  # Step 1c: Deploy the infra bundle
  deploy_bundle "${INFRA_BUNDLE}" "${INFRA_EXTRA_ARGS[@]+${INFRA_EXTRA_ARGS[@]}}"

  # Step 1d: Check the M2M SPN credential contract (non-fatal).
  # Prints the ADMIN ACTION block if the client_secret hasn't been provisioned.
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    check_m2m_credentials
  fi
fi

# --------------------------------------------------------------------------- #
# Phase 2: App bundle (Bundle 2)
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_APP}" == true ]]; then
  # TODO: After Bundle 2 is scaffolded:
  # 1. deploy_bundle "${APP_BUNDLE}"
  # 2. Resolve app URL from app bundle summary
  # 2b. Grant CAN_USE on the app to the M2M SPN (resolve application_id by
  #     display name "${M2M_SPN_PREFIX}-${TARGET}" and pass as --var, or via
  #     a post-process job — see m2m_service_principal_plan.md §7.1)
  # 3. Run post_deploy_setup job (creates connection via SQL DDL + registers MCP)
  # 4. Re-deploy infra to register MCP service DAB resource
  warn "Bundle 2 (${APP_BUNDLE}) not yet implemented — skipping."
fi

# --------------------------------------------------------------------------- #
# Phase 3: Agent bundle (Bundle 3)
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_AGENT}" == true ]]; then
  # TODO: After Bundle 3 is scaffolded:
  # 1. deploy_bundle "${AGENT_BUNDLE}"
  warn "Bundle 3 (${AGENT_BUNDLE}) not yet implemented — skipping."
fi

# --------------------------------------------------------------------------- #
# Done
# --------------------------------------------------------------------------- #
log "Deploy complete (target: ${TARGET})"
