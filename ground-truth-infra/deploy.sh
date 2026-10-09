# MOVED — deploy.sh now lives at the solution root (semanticGroundTruth/deploy.sh).
# This file is intentionally empty. Delete when convenient.
#
# Deploys Declarative Automation Bundles in dependency order:
#   1. ground-truth-infra    (UC schema, warehouse, Lakebase, secret scope, MCP service, jobs)
#   2. ground-truth-app      (AppKit app: Node.js + React, migrations, MCP server)  [Bundle 2]
#   3. ground-truth-agent    (Genie Agent: operational agent, tool definitions)      [Bundle 3]
#
# Pre-deploy steps (before infra bundle deploy):
#   - Resolves catalog, schema, workspace URL from bundle summary
#   - Creates/updates the HTTP connection for the MCP service
#     (placeholder pointing to workspace URL until Bundle 2 provides app URL)
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
  # Then: admin provisions webhook secrets (see docs/runbooks/)
  ./deploy.sh --target dev --app
  # Then: re-run infra to update MCP connection with real app URL:
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
safe() { echo "$1" | sed 's/[^a-zA-Z0-9_.\-]//g'; }

# safe_url() — like safe() but preserves :// for workspace URLs
safe_url() { echo "$1" | sed 's/[^a-zA-Z0-9_.\-:\/]//g'; }

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
    if [[ ${#extra_args[@]} -gt 0 ]]; then
      (cd_bundle "${bundle_dir}" && databricks bundle deploy --target "${TARGET}" "${extra_args[@]}")
    else
      (cd_bundle "${bundle_dir}" && databricks bundle deploy --target "${TARGET}")
    fi
    ok "Deployed: ${bundle_name}"
  fi
}

# --------------------------------------------------------------------------- #
# resolve_infra_vars — extract resolved values from the infra bundle summary
# --------------------------------------------------------------------------- #
resolve_infra_vars() {
  local bundle_dir="${SCRIPT_DIR}/${INFRA_BUNDLE}"

  log "Resolving infrastructure variables (target: ${TARGET})"

  local summary_json
  summary_json=$(cd_bundle "${bundle_dir}" && databricks bundle summary --target "${TARGET}" --output json 2>/dev/null) || {
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
" 2>/dev/null)" || fail "Could not parse bundle summary JSON."

  if [[ -n "${RESOLVE_ERROR:-}" ]]; then
    fail "resolve_infra_vars failed: ${RESOLVE_ERROR}"
  fi

  MCP_CONNECTION_NAME="${CATALOG}.${SCHEMA}.${MCP_CONNECTION_SUFFIX}"

  ok "Resolved: catalog=${CATALOG}, schema=${SCHEMA}"
  ok "  scope=${SCOPE_NAME}, warehouse=${SQL_WAREHOUSE_ID}"
  ok "  workspace=${WORKSPACE_HOST}"
  ok "  mcp_connection=${MCP_CONNECTION_NAME}"
}

# --------------------------------------------------------------------------- #
# ensure_http_connection — create or update the HTTP connection for MCP service
#
# On first deploy (pre-Bundle 2): points to workspace URL as placeholder.
# After Bundle 2: called with real app URL to update the connection.
#
# Runs BEFORE `bundle deploy` so the MCP service resource finds the
# connection already in place.
# --------------------------------------------------------------------------- #
ensure_http_connection() {
  local connection_name="${MCP_CONNECTION_NAME}"
  local host_url="${1:-${WORKSPACE_HOST}}"

  log "Ensuring HTTP connection: ${connection_name}"

  # Check if connection exists
  if databricks api get /api/2.1/unity-catalog/connections/"${connection_name}" >/dev/null 2>&1; then
    ok "Connection exists — updating host to: ${host_url}"
    databricks api patch /api/2.1/unity-catalog/connections/"${connection_name}" --json "$(python3 -c "
import json
print(json.dumps({
    'options': {
        'host': '$(safe_url "${host_url}")',
        'port': '443',
        'httpPath': '${MCP_BASE_PATH}'
    }
}))
")" >/dev/null
    ok "Connection updated: ${connection_name}"
    return 0
  fi

  # Create new connection
  log "Creating HTTP connection: ${connection_name} -> ${host_url}"
  databricks api post /api/2.1/unity-catalog/connections --json "$(python3 -c "
import json
print(json.dumps({
    'name': '${connection_name}',
    'connection_type': 'HTTP',
    'comment': 'MCP server endpoint for Semantic Ground Truth app (managed by deploy.sh)',
    'options': {
        'host': '$(safe_url "${host_url}")',
        'port': '443',
        'httpPath': '${MCP_BASE_PATH}'
    }
}))
")" >/dev/null || fail "Failed to create HTTP connection: ${connection_name}"
  ok "Connection created: ${connection_name}"
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

  # Step 1b: Ensure HTTP connection exists before deploy (so MCP service succeeds)
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    ensure_http_connection "${WORKSPACE_HOST}"
  fi

  # Step 1c: Deploy the infra bundle
  deploy_bundle "${INFRA_BUNDLE}" "${INFRA_EXTRA_ARGS[@]+${INFRA_EXTRA_ARGS[@]}}"
fi

# --------------------------------------------------------------------------- #
# Phase 2: App bundle (Bundle 2)
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_APP}" == true ]]; then
  # TODO: After Bundle 2 is scaffolded:
  # 1. deploy_bundle "${APP_BUNDLE}"
  # 2. Resolve app URL from app bundle summary
  # 3. Update HTTP connection with real app URL:
  #    resolve_infra_vars  # refresh catalog/schema
  #    ensure_http_connection "${APP_URL}"
  # 4. Run configure_app_spn job to grant SPN access to secret scope
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
