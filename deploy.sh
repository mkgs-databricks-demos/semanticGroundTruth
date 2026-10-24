#!/usr/bin/env bash
# deploy.sh — Shared deployment script for the Semantic Ground Truth solution.
#
# Deploys Declarative Automation Bundles in dependency order:
#   1. ground-truth-infra    (UC schema, warehouse, Lakebase, secret scope, jobs, MLflow experiment)
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
#   - report_secret_scope_keys: reads the setup_secrets task's JSON exit value from
#     this deploy's post_deploy_setup run and lists written / missing scope keys.
#
# NOTE on MCP connection & service:
#   HTTP connections require valid M2M SPN credentials at creation time.
#   The connection is created automatically in Phase 2 (app deploy) via SQL DDL
#   with secret() references to the M2M SPN keys (hi-genie-orchestrator pattern):
#     1. --infra --run-setup: creates M2M SPN + stores credentials (one-time)
#     2. --app: deploys app → resolves URL → creates connection → auto-redeploys
#              to register MCP service (all automatic in a single command)
#   The M2M SPN credentials (not the app's auto-provisioned SPN) are used.
#   See docs/plans/m2m_service_principal_plan.md.
#   The MCP service DAB resource lives in the app bundle (ground-truth-app).
#   On first deploy, the initial deploy_bundle will fail for the MCP service
#   (connection doesn't exist yet) — this is expected. After create_mcp_connection
#   succeeds, deploy.sh auto-redeploys to register the MCP service.
#
# Usage:
#   ./deploy.sh --target dev                             # deploy all bundles
#   ./deploy.sh --target dev --infra                     # deploy only infra bundle
#   ./deploy.sh --target dev --infra --run-setup         # deploy infra + force post-deploy setup
#   ./deploy.sh --target dev --app                       # deploy only app bundle
#   ./deploy.sh --target dev --agent                     # deploy only agent bundle
#   ./deploy.sh --target dev --agent --verify            # deploy agent + run agent_verification
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
M2M_OAUTH_SCOPES=""
POST_DEPLOY_JOB_ID=""
# App bundle support (§2a of app_bundle_support_plan.md)
MLFLOW_EXPERIMENT_ID=""
MLFLOW_EXPERIMENT_NAME=""
FRESHNESS_JOB_ID=""
LAKEBASE_BRANCH=""
LAKEBASE_DATABASE=""
EXEC_DASHBOARD_ID=""
EXEC_DASHBOARD_URL=""
APP_URL=""
APP_DISPLAY_NAME=""

# App SPN — resolved from `apps get` in Phase 1; used for secret scope READ ACL
APP_SPN_CLIENT_ID=""

# Set just before the infra deploy; used to pick this deploy's job run
DEPLOY_START_MS=""

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
RUN_VERIFY=false

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
  --verify           After deploy, run the verification job of each deployed bundle
                     (app: deploy_verification, agent: agent_verification).
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
  # Then: workspace admin generates the M2M OAuth secret and stores it
  #   (ground-truth-infra/docs/runbooks/m2m-service-principal.md),
  #   and provisions webhook secrets (see docs/runbooks/)
  ./deploy.sh --target dev --infra --run-setup
  # Verifies the M2M token exchange.
  ./deploy.sh --target dev --app
  # Deploys app → creates MCP connection → auto-redeploys to register
  # MCP service. All handled in a single command.

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
    --verify)      RUN_VERIFY=true; shift ;;
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
  if [[ ${#extra_args[@]} -gt 0 ]]; then
    (cd_bundle "${bundle_dir}" && databricks bundle validate --target "${TARGET}" "${extra_args[@]}")
  else
    (cd_bundle "${bundle_dir}" && databricks bundle validate --target "${TARGET}")
  fi
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
    local deploy_log
    deploy_log=$(mktemp)
    local deploy_rc=0
    local -a pipe_rc=()
    # Stream output live via tee; capture to log for post-deploy filtering.
    # Piping strips the CLI's colour, so "Error:" appears as plain text.
    # PIPESTATUS is captured INSIDE the group: a trailing `|| true` would
    # overwrite it with 0. The group's `|| true` only stops set -e aborting.
    {
      (cd_bundle "${bundle_dir}" && databricks bundle deploy --target "${TARGET}" ${extra_args[@]+"${extra_args[@]}"}) 2>&1 | tee "${deploy_log}"
      pipe_rc=("${PIPESTATUS[@]}")
    } || true
    deploy_rc=${pipe_rc[0]:-1}
    LAST_DEPLOY_RC=${deploy_rc}  # read by callers; function itself never fails

    if [[ ${deploy_rc} -eq 0 ]]; then
      ok "Deployed: ${bundle_name}"
    else
      # Classify errors: MCP-service / grant failures on first deploy are
      # expected (connection doesn't exist yet) and get a calm message.
      # Any other error is surfaced as a warning.
      # Expected = the MCP service failing ONLY because its connection is
      # missing, plus its grants failing as a dependency of that.
      local conn_missing_re='^Error: cannot create resources\.mcp_services\.ground_truth_mcp: Connection .* does not exist'
      local grants_dep_re='^Error: cannot create resources\.mcp_services\.ground_truth_mcp\.grants: dependency failed'
      local mcp_errors unexpected_errors
      mcp_errors=$(grep -cE "${conn_missing_re}|${grants_dep_re}" "${deploy_log}" || true)
      unexpected_errors=$(grep -E '^Error:' "${deploy_log}" | grep -cvE "${conn_missing_re}|${grants_dep_re}" || true)
      if ! grep -qE "${conn_missing_re}" "${deploy_log}"; then
        # Grants failing without the connection-missing cause is not expected.
        unexpected_errors=$(( unexpected_errors + mcp_errors )); mcp_errors=0
      fi
      if [[ ${unexpected_errors} -le 0 && ${mcp_errors} -gt 0 ]]; then
        log "Deploy note (${bundle_name})"
        ok "MCP service deferred: connection not created yet (expected on first deploy)."
        ok "deploy.sh will create the connection and auto-redeploy after this step."
      else
        warn "Deploy completed with errors (exit ${deploy_rc}). Some resources may have failed."
        if [[ ${mcp_errors} -gt 0 ]]; then
          ok "MCP service errors are expected on first deploy (connection not yet created)."
        fi
        if [[ ${unexpected_errors} -gt 0 ]]; then
          warn "${unexpected_errors} unexpected error(s) — review the output above."
        fi
      fi
    fi
    rm -f "${deploy_log}"
  fi
}

# --------------------------------------------------------------------------- #
# run_bundle_job — `bundle run <job>` inside a bundle (non-fatal)
#   $1 = bundle dir name, $2 = resource key, rest = extra args (e.g. --var)
#   Sets LAST_RUN_RC. Never exits the script.
# --------------------------------------------------------------------------- #
run_bundle_job() {
  local bundle_name="$1"
  local job_key="$2"
  shift 2
  local extra_args=("$@")
  local bundle_dir="${SCRIPT_DIR}/${bundle_name}"

  log "Running ${job_key} (${bundle_name}, target: ${TARGET})"
  LAST_RUN_RC=0
  (cd_bundle "${bundle_dir}" && \
    databricks bundle run "${job_key}" --target "${TARGET}" ${extra_args[@]+"${extra_args[@]}"}) || LAST_RUN_RC=$?
  if [[ ${LAST_RUN_RC} -eq 0 ]]; then
    ok "${job_key} succeeded"
  else
    warn "${job_key} failed (exit ${LAST_RUN_RC}) — see the run output above."
  fi
}

# --------------------------------------------------------------------------- #
# resolve_infra_vars — extract resolved values from the infra bundle summary
# --------------------------------------------------------------------------- #
resolve_infra_vars() {
  local bundle_dir="${SCRIPT_DIR}/${INFRA_BUNDLE}"

  log "Resolving infrastructure variables (target: ${TARGET})"

  local summary_json
  # Note: the CLI may print a one-time install banner to stdout before the JSON.
  # Use sed to strip any lines before the first '{' so the JSON parser succeeds.
  summary_json=$(cd "${bundle_dir}" && databricks bundle summary --target "${TARGET}" --output json 2>/dev/null | sed -n '/^{/,$p') || {
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
m2m_scopes     = get_var('m2m_oauth_scopes', 'all-apis')

# --- post_deploy_setup job ID (empty before the first deploy) ---
post_deploy_job_id = resources.get('jobs', {}).get('post_deploy_setup', {}).get('id', '')

# --- app bundle support (§2a of app_bundle_support_plan.md) ---
# Experiment: .id present in CLI >= 1.21; older CLIs omit it.
# Export name as well so bash can fall back to MLflow API lookup.
exp_block = resources.get('experiments', {}).get('app_agents_experiment', {})
mlflow_experiment_id = exp_block.get('id', '')
mlflow_experiment_name = exp_block.get('name', '')
freshness_job_id = resources.get('jobs', {}).get('freshness_resurfacing', {}).get('id', '')
# Lakebase: .name doesn't exist in the summary; .id is the full resource path
# (e.g. projects/<project>/branches/production)
# IMPORTANT: branch must match the branch that owns the database.
# app_db.parent = production branch, so we resolve production here.
lakebase_branch = resources.get('postgres_branches', {}).get('production', {}).get('id', '')
lakebase_database = resources.get('postgres_databases', {}).get('app_db', {}).get('id', '')

# --- executive dashboard ID (published URL resolved in bash from WORKSPACE_HOST) ---
exec_dashboard_id = resources.get('dashboards', {}).get('executive', {}).get('id', '')

# --- workspace host ---
workspace_host = ''
workspace_block = data.get('workspace', {})
if isinstance(workspace_block, dict):
    workspace_host = workspace_block.get('host', '')

def safe(v):
    return re.sub(r'[^a-zA-Z0-9_.\\-]', '', str(v))

def safe_url(v):
    return re.sub(r'[^a-zA-Z0-9_.\\-:/]', '', str(v))

def safe_name(v):
    # Preserve spaces and brackets for human-readable names (experiment paths).
    # Safe inside eval double-quotes; strips shell-active chars (dollar, backslash, etc).
    return re.sub(r'[^a-zA-Z0-9_.\\-:/ \\[\\]]', '', str(v))

print(f'CATALOG=\"{safe(catalog)}\"')
print(f'SCHEMA=\"{safe(schema)}\"')
print(f'SCOPE_NAME=\"{safe(scope)}\"')
print(f'WORKSPACE_HOST=\"{safe_url(workspace_host)}\"')
print(f'SQL_WAREHOUSE_ID=\"{safe(warehouse_id)}\"')
print(f'LAKEBASE_PROJECT_ID=\"{safe(project_id)}\"')
print(f'M2M_CLIENT_ID_KEY=\"{safe(m2m_id_key)}\"')
print(f'M2M_CLIENT_SECRET_KEY=\"{safe(m2m_secret_key)}\"')
print(f'M2M_SPN_PREFIX=\"{safe(m2m_prefix)}\"')
print(f'POST_DEPLOY_JOB_ID=\"{safe(post_deploy_job_id)}\"')
# App bundle support (§2a of app_bundle_support_plan.md)
print(f'MLFLOW_EXPERIMENT_NAME=\"{safe_name(mlflow_experiment_name)}\"')
print(f'MLFLOW_EXPERIMENT_ID=\"{safe(mlflow_experiment_id)}\"')
print(f'FRESHNESS_JOB_ID=\"{safe(freshness_job_id)}\"')
# Lakebase resource .name values are full paths containing '/' — safe() strips
# slashes; safe_url() preserves ':/' which covers path separators.
print(f'LAKEBASE_BRANCH=\"{safe_url(lakebase_branch)}\"')
print(f'LAKEBASE_DATABASE=\"{safe_url(lakebase_database)}\"')
print(f'EXEC_DASHBOARD_ID=\"{safe(exec_dashboard_id)}\"')
# Scopes are space-separated and may contain ':' (e.g. catalog.tables:read)
scopes_clean = re.sub(r'[^a-zA-Z0-9_.: -]', '', str(m2m_scopes)).strip()
print(f'M2M_OAUTH_SCOPES=\"{scopes_clean}\"')
" 2>/dev/null)" || fail "Could not parse bundle summary JSON."

  if [[ -n "${RESOLVE_ERROR:-}" ]]; then
    fail "resolve_infra_vars failed: ${RESOLVE_ERROR}"
  fi

  # Experiment ID fallback: CLI < 1.21 omits .id from bundle summary.
  # Use the experiment name (always present) to resolve via MLflow API.
  if [[ -z "${MLFLOW_EXPERIMENT_ID}" && -n "${MLFLOW_EXPERIMENT_NAME}" ]]; then
    MLFLOW_EXPERIMENT_ID=$(
      EXP_NAME="${MLFLOW_EXPERIMENT_NAME}" python3 -c '
import json, os, subprocess, sys
r = subprocess.run(
    ["databricks", "experiments", "get-by-name",
     os.environ["EXP_NAME"], "--output", "json"],
    capture_output=True, text=True)
try:
    d = json.loads(r.stdout) if r.returncode == 0 else {}
except Exception:
    d = {}
exp = d.get("experiment", d)
print(exp.get("experiment_id", ""))
' 2>/dev/null) || MLFLOW_EXPERIMENT_ID=""
    MLFLOW_EXPERIMENT_ID=$(safe "${MLFLOW_EXPERIMENT_ID}")
  fi

  # UC connections are metastore-level (flat names, no dots allowed)
  MCP_CONNECTION_NAME="${MCP_CONNECTION_SUFFIX}"

  ok "Resolved: catalog=${CATALOG}, schema=${SCHEMA}"
  ok "  scope=${SCOPE_NAME}, warehouse=${SQL_WAREHOUSE_ID}"
  ok "  workspace=${WORKSPACE_HOST}"
  ok "  mcp_connection=${MCP_CONNECTION_NAME}"
  ok "  m2m_spn_prefix=${M2M_SPN_PREFIX}"
  ok "  m2m_keys=${M2M_CLIENT_ID_KEY}, ${M2M_CLIENT_SECRET_KEY}"
  ok "  m2m_oauth_scopes=${M2M_OAUTH_SCOPES}"
  ok "  mlflow_experiment=${MLFLOW_EXPERIMENT_ID}"
  ok "  freshness_job=${FRESHNESS_JOB_ID}"
  ok "  lakebase_branch=${LAKEBASE_BRANCH}"
  ok "  lakebase_database=${LAKEBASE_DATABASE}"
  if [[ -n "${EXEC_DASHBOARD_ID}" ]]; then
    # Build the published dashboard URL from the workspace host and dashboard ID.
    EXEC_DASHBOARD_URL="${WORKSPACE_HOST}/dashboardsv3/${EXEC_DASHBOARD_ID}/published"
    ok "  exec_dashboard_url=${EXEC_DASHBOARD_URL}"
  else
    EXEC_DASHBOARD_URL=""
    warn "  executive dashboard not yet deployed — exec_dashboard_url will be empty."
  fi
}

# --------------------------------------------------------------------------- #
# check_mcp_connection — check if the MCP HTTP connection exists (status only)
#
# Used by Phase 1 to report connection status. Connection creation is handled
# in Phase 2 by running the create_mcp_connection job (Python task).
# Schema-level connections use a three-part name: catalog.schema.connection.
# --------------------------------------------------------------------------- #
check_mcp_connection() {
  local full_name="${CATALOG}.${SCHEMA}.${MCP_CONNECTION_NAME}"

  log "Checking MCP connection: ${full_name}"

  if databricks api get /api/2.1/unity-catalog/connections/"${full_name}" >/dev/null 2>&1; then
    ok "Connection exists: ${full_name}"
    return 0
  else
    warn "Connection '${full_name}' does not exist yet."
    warn "It will be created automatically on the next --app deploy."
    return 1
  fi
}

# --------------------------------------------------------------------------- #
# run_create_mcp_connection — run the Python task job to create/update the
# schema-level MCP HTTP connection (Phase 2)
#
# The create_mcp_connection job (app bundle) runs a Python script that:
#   1. Reads M2M credentials from the secret scope (dbutils.secrets.get)
#   2. POST /connections (create) or PATCH /connections/{full_name} (update)
#   3. GET /connections/{full_name} (verify)
#
# Schema-level connections need CREATE CONNECTION on the schema, which is
# covered by ALL PRIVILEGES on the catalog. No metastore grant needed.
# --------------------------------------------------------------------------- #
run_create_mcp_connection() {
  local app_url="$1"

  if [[ -z "${app_url}" ]]; then
    warn "App URL not available — cannot create MCP connection."
    return 1
  fi

  if [[ -z "${M2M_CLIENT_ID_KEY}" || -z "${M2M_CLIENT_SECRET_KEY}" ]]; then
    warn "M2M SPN key names not resolved — cannot create connection."
    warn "Deploy infra with --run-setup first to create the M2M SPN."
    return 1
  fi

  local connection_name="${MCP_CONNECTION_NAME}"
  local full_name="${CATALOG}.${SCHEMA}.${MCP_CONNECTION_NAME}"
  local token_endpoint="${WORKSPACE_HOST}/oidc/v1/token"

  log "Creating/updating MCP connection: ${full_name}"
  ok "  app_url=${app_url}"
  ok "  scope=${SCOPE_NAME}"
  ok "  token_endpoint=${token_endpoint}"

  if (cd_bundle "${SCRIPT_DIR}/${APP_BUNDLE}" && \
      databricks bundle run create_mcp_connection --target "${TARGET}" \
        "${APP_EXTRA_ARGS[@]}" \
        --params "connection_name=${connection_name}" \
        --params "catalog=${CATALOG}" \
        --params "schema_name=${SCHEMA}" \
        --params "app_url=${app_url}" \
        --params "base_path=${MCP_BASE_PATH}" \
        --params "scope_name=${SCOPE_NAME}" \
        --params "client_id_key=${M2M_CLIENT_ID_KEY}" \
        --params "client_secret_key=${M2M_CLIENT_SECRET_KEY}" \
        --params "oauth_scopes=${M2M_OAUTH_SCOPES}" \
        --params "token_endpoint=${token_endpoint}"); then
    ok "MCP connection ready: ${full_name}"
    return 0
  else
    warn "create_mcp_connection job failed — check the run output above."
    warn "Common causes:"
    warn "  - PERMISSION_DENIED: deployer lacks CREATE CONNECTION on the schema"
    warn "    (need CREATE CONNECTION on catalog or schema, not metastore)"
    warn "  - M2M client_secret not provisioned in the secret scope"
    warn "  - Serverless compute unavailable"
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
  │      Scope: select "Other APIs" and check: ${M2M_OAUTH_SCOPES}
  │      (must match var.m2m_oauth_scopes; scopes can't be changed later)
  │    CLI alternative:
  │      databricks service-principal-secrets-proxy create ${spn_object_id}
  │
  │ 2. Store it in the bundle scope (interactive prompt, keeps it out of history):
  │      databricks secrets put-secret ${SCOPE_NAME} ${M2M_CLIENT_SECRET_KEY}
  │
  │ 3. Verify the token exchange:
  │      ./deploy.sh --target ${TARGET} --infra --run-setup
  │
  │ NOTE: Bundle 2 uses OBO (user authorization). When the app declares
  │ user_api_scopes, regenerate the secret with the wider scope set and
  │ update var.m2m_oauth_scopes to match. See the runbook for details.
  │
  │ Runbook: ${INFRA_BUNDLE}/docs/runbooks/m2m-service-principal.md
  └──────────────────────────────────────────────────────────────────

EOF
  return 0
}

# --------------------------------------------------------------------------- #
# report_secret_scope_keys — surface the setup_secrets key report (non-fatal)
#
# setup_secrets (post_deploy_setup job) writes workspace_url and exits with a
# JSON report: {scope, written, present, missing[{key, provisioned_by, action}],
# unexpected}. This reads that report from the job run started by THIS deploy
# (start_time >= DEPLOY_START_MS) via `databricks jobs get-run-output`.
# Only key names are reported — secret values are never read.
# --------------------------------------------------------------------------- #
# --------------------------------------------------------------------------- #
# resolve_post_deploy_job_id — fill POST_DEPLOY_JOB_ID if the pre-deploy
# summary didn't have it (very first deploy)
# --------------------------------------------------------------------------- #
resolve_post_deploy_job_id() {
  if [[ -z "${POST_DEPLOY_JOB_ID}" ]]; then
    POST_DEPLOY_JOB_ID=$(cd "${SCRIPT_DIR}/${INFRA_BUNDLE}" && databricks bundle summary --target "${TARGET}" --output json 2>/dev/null | sed -n '/^{/,$p' | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
print(d.get("resources", {}).get("jobs", {}).get("post_deploy_setup", {}).get("id", ""))
' 2>/dev/null) || POST_DEPLOY_JOB_ID=""
    POST_DEPLOY_JOB_ID=$(safe "${POST_DEPLOY_JOB_ID}")
  fi
}

# --------------------------------------------------------------------------- #
# post_deploy_run_is_fresh — "yes" if the latest post_deploy_setup run started
# during this deploy (start_time >= DEPLOY_START_MS - 60 s), else "no"
# --------------------------------------------------------------------------- #
post_deploy_run_is_fresh() {
  PD_JOB_ID="${POST_DEPLOY_JOB_ID}" PD_START_MS="${DEPLOY_START_MS:-0}" python3 -c '
import json, os, subprocess
r = subprocess.run(["databricks", "jobs", "list-runs", "--job-id", os.environ["PD_JOB_ID"],
                    "--limit", "1", "--output", "json"], capture_output=True, text=True)
try:
    data = json.loads(r.stdout) if r.returncode == 0 else []
except Exception:
    data = []
items = data if isinstance(data, list) else data.get("runs", [])
start_ms = int(os.environ.get("PD_START_MS") or 0) - 60000
fresh = bool(items) and int(items[0].get("start_time") or 0) >= start_ms
print("yes" if fresh else "no")
' 2>/dev/null || echo "no"
}

# --------------------------------------------------------------------------- #
# ensure_post_deploy_run — with --run-setup, guarantee post_deploy_setup ran
#
# The run_post_deploy job_run resource only fires when its configuration
# changes (lifecycle trigger for "always" is still a TODO). When --run-setup is
# passed and the deploy didn't start a run, run the job explicitly. Group B
# tasks stay skipped (app_url is empty). Non-fatal.
# --------------------------------------------------------------------------- #
ensure_post_deploy_run() {
  [[ "${RUN_SETUP}" == true ]] || return 0

  resolve_post_deploy_job_id
  if [[ -z "${POST_DEPLOY_JOB_ID}" ]]; then
    warn "post_deploy_setup job ID not resolved — cannot force a setup run."
    return 0
  fi

  if [[ "$(post_deploy_run_is_fresh)" == "yes" ]]; then
    ok "post_deploy_setup ran as part of this deploy."
    return 0
  fi

  log "Running post_deploy_setup (job_run did not fire — no config change)"
  if (cd_bundle "${SCRIPT_DIR}/${INFRA_BUNDLE}" && \
      databricks bundle run post_deploy_setup --target "${TARGET}" --params run_setup=true); then
    ok "post_deploy_setup run completed."
  else
    warn "post_deploy_setup run finished with failures — see the run page above."
  fi
  return 0
}

report_secret_scope_keys() {
  log "Secret scope key report (setup_secrets task)"

  resolve_post_deploy_job_id
  if [[ -z "${POST_DEPLOY_JOB_ID}" ]]; then
    warn "post_deploy_setup job ID not resolved — skipping key report."
    return 0
  fi

  # Values passed via env vars (not interpolated into Python source).
  # Output lines: LEVEL|message  (LEVEL = OK | WARN | INFO)
  local report_lines
  report_lines=$(PD_JOB_ID="${POST_DEPLOY_JOB_ID}" PD_START_MS="${DEPLOY_START_MS:-0}" python3 -c '
import json, os, subprocess, sys

def cli(*args):
    r = subprocess.run(["databricks", *args, "--output", "json"], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        return None

job_id = os.environ["PD_JOB_ID"]
# 60 s margin for clock skew between this shell and the control plane
start_ms = int(os.environ.get("PD_START_MS") or 0) - 60000

runs = cli("jobs", "list-runs", "--job-id", job_id, "--limit", "1")
items = runs if isinstance(runs, list) else (runs or {}).get("runs", [])
if not items:
    print("WARN|No post_deploy_setup runs found.")
    sys.exit(0)
run = items[0]
if int(run.get("start_time") or 0) < start_ms:
    print("WARN|No post_deploy_setup run from this deploy (the job_run only fires on config changes).")
    print("WARN|  Re-run with --run-setup to force the setup run and key report.")
    sys.exit(0)

detail = cli("jobs", "get-run", str(run["run_id"])) or {}
task = next((t for t in detail.get("tasks", []) if t.get("task_key") == "setup_secrets"), None)
if task is None:
    print("WARN|setup_secrets task not found in run " + str(run["run_id"]) + ".")
    sys.exit(0)
state = task.get("state") or {}
result_state = state.get("result_state") or state.get("life_cycle_state") or "UNKNOWN"
if result_state != "SUCCESS":
    print("WARN|setup_secrets did not succeed (state: " + result_state + "); no key report.")
    print("WARN|  Common cause: ensure_m2m_service_principal failed, so setup_secrets was skipped.")
    sys.exit(0)

out = cli("jobs", "get-run-output", str(task["run_id"])) or {}
result = (out.get("notebook_output") or {}).get("result")
try:
    report = json.loads(result)
except Exception:
    print("WARN|setup_secrets returned no parsable report.")
    sys.exit(0)

scope = report.get("scope", "?")
written = report.get("written", [])
present = report.get("present", [])
missing = report.get("missing", [])
print("OK|Scope " + scope + ": wrote " + (", ".join(written) or "nothing"))
print("OK|Present: " + (", ".join(present) or "none"))
if missing:
    print("WARN|" + str(len(missing)) + " expected key(s) missing:")
    for m in missing:
        print("WARN|  " + m.get("key", "?") + " (" + m.get("provisioned_by", "?") + "): " + m.get("action", ""))
else:
    print("OK|All expected keys present.")
for k in report.get("unexpected", []):
    print("INFO|Unmanaged key in scope: " + k)
' 2>/dev/null) || {
    warn "Could not read the setup_secrets report — skipping."
    return 0
  }

  local level msg
  while IFS='|' read -r level msg; do
    case "${level}" in
      OK)   ok "${msg}" ;;
      WARN) warn "${msg}" ;;
      *)    if [[ -n "${msg}" ]]; then echo "     ${msg}"; fi ;;
    esac
  done <<< "${report_lines}"
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

  # Step 1a': Resolve the app SPN client ID from the running app.
  # The infra secret scope permissions block is authoritative. Without the
  # app SPN listed as READ, every infra deploy removes the ACL and the app
  # starts logging "[ERROR] error resolving resource m2m-client-id".
  # On first deploy (no app yet), fall back to the target default in
  # databricks.yml and, after Phase 2, re-deploy infra if the ID differs.
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    log "Resolving app service principal for secret scope ACL"
    # Resolve app display name from the app bundle (same as Phase 2, Step 2a')
    if [[ -z "${APP_DISPLAY_NAME}" ]]; then
      # Build minimal --var list so app bundle summary works
      _app_vars=(
        "--var" "catalog=$(safe "${CATALOG}")"
        "--var" "schema_name=$(safe "${SCHEMA}")"
        "--var" "sql_warehouse_id=$(safe "${SQL_WAREHOUSE_ID}")"
        "--var" "agents_mlflow_experiment_experimentId=$(safe "${MLFLOW_EXPERIMENT_ID}")"
        "--var" "job_id=$(safe "${FRESHNESS_JOB_ID}")"
        "--var" "postgres_branch=$(safe_url "${LAKEBASE_BRANCH}")"
        "--var" "postgres_database=$(safe_url "${LAKEBASE_DATABASE}")"
      )
      APP_DISPLAY_NAME=$(
        cd_bundle "${SCRIPT_DIR}/${APP_BUNDLE}" && \
        databricks bundle summary --target "${TARGET}" "${_app_vars[@]}" --output json 2>/dev/null | \
        sed -n '/^{/,$p' | \
        python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("variables", {}).get("app_display_name", {}).get("value", ""))
' 2>/dev/null) || APP_DISPLAY_NAME=""
      APP_DISPLAY_NAME=$(safe "${APP_DISPLAY_NAME}")
    fi

    if [[ -n "${APP_DISPLAY_NAME}" ]]; then
      APP_SPN_CLIENT_ID=$(
        databricks apps get "${APP_DISPLAY_NAME}" --output json 2>/dev/null | \
        python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("service_principal_client_id", ""))
' 2>/dev/null) || APP_SPN_CLIENT_ID=""
      APP_SPN_CLIENT_ID=$(safe "${APP_SPN_CLIENT_ID}")
    fi

    if [[ -n "${APP_SPN_CLIENT_ID}" ]]; then
      ok "App SPN resolved: ${APP_SPN_CLIENT_ID}"
      INFRA_EXTRA_ARGS+=("--var" "app_service_principal_id=$(safe "${APP_SPN_CLIENT_ID}")")
    else
      warn "App not found or SPN not resolved — using target default for app_service_principal_id."
      warn "After Phase 2 (app deploy), re-run --infra to update the scope ACL."
    fi
  fi

  # Step 1b: Check MCP connection status (informational only).
  # Connection is created by Phase 2 (app deploy) via the
  # create_mcp_connection job. This is just a status check.
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    check_mcp_connection || true
  fi

  # Step 1c: Deploy the infra bundle
  DEPLOY_START_MS=$(python3 -c 'import time; print(int(time.time() * 1000))')
  deploy_bundle "${INFRA_BUNDLE}" "${INFRA_EXTRA_ARGS[@]+${INFRA_EXTRA_ARGS[@]}}"

  # Step 1c': With --run-setup, make sure post_deploy_setup actually ran
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    ensure_post_deploy_run
  fi

  # Step 1d: Check the M2M SPN credential contract (non-fatal).
  # Prints the ADMIN ACTION block if the client_secret hasn't been provisioned.
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    check_m2m_credentials

    # Step 1e: Surface the setup_secrets key report from this deploy's job run
    report_secret_scope_keys
  fi
fi

# --------------------------------------------------------------------------- #
# Phase 2: App bundle (Bundle 2)
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_APP}" == true ]]; then

  # Step 2a: Ensure infra vars are resolved (--app only runs skip Phase 1)
  if [[ -z "${CATALOG}" ]]; then
    log "Resolving infra vars for app deploy (--app only)"
    resolve_infra_vars
  fi

  # Step 2b: Build the --var list for the app bundle.
  # Variables that deploy.sh resolves from infra are passed explicitly.
  # Variables that are static per-target (agents_serving_endpoint_name) stay
  # in the app's databricks.yml target block — not passed here.
  # Built BEFORE display-name resolution so bundle summary has required vars.
  APP_EXTRA_ARGS=(
    "--var" "catalog=${CATALOG}"
    "--var" "schema_name=${SCHEMA}"
    "--var" "sql_warehouse_id=${SQL_WAREHOUSE_ID}"
    "--var" "agents_mlflow_experiment_experimentId=${MLFLOW_EXPERIMENT_ID}"
    "--var" "job_id=${FRESHNESS_JOB_ID}"
    "--var" "postgres_branch=${LAKEBASE_BRANCH}"
    "--var" "postgres_database=${LAKEBASE_DATABASE}"
    "--var" "exec_dashboard_url=$(safe_url "${EXEC_DASHBOARD_URL}")"  # from infra bundle's executive dashboard
  )

  # Step 2a': Resolve the app display name from the app bundle's target variables.
  # The app name is target-specific (e.g. dev-semantic-ground-truth, semantic-ground-truth).
  # Requires APP_EXTRA_ARGS — bundle summary fails without resolved vars.
  APP_DISPLAY_NAME=$(
    cd_bundle "${SCRIPT_DIR}/${APP_BUNDLE}" && \
    databricks bundle summary --target "${TARGET}" "${APP_EXTRA_ARGS[@]}" --output json 2>/dev/null | \
    sed -n '/^{/,$p' | \
    python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("variables", {}).get("app_display_name", {}).get("value", ""))
' 2>/dev/null) || APP_DISPLAY_NAME=""
  APP_DISPLAY_NAME=$(safe "${APP_DISPLAY_NAME}")

  if [[ -z "${APP_DISPLAY_NAME}" ]]; then
    warn "Could not resolve app_display_name from app bundle summary."
    APP_DISPLAY_NAME="semantic-ground-truth"  # fallback
  fi
  ok "App display name: ${APP_DISPLAY_NAME}"

  log "Deploying app bundle with infra-resolved variables"
  ok "  catalog=${CATALOG}"
  ok "  schema_name=${SCHEMA}"
  ok "  sql_warehouse_id=${SQL_WAREHOUSE_ID}"
  ok "  mlflow_experiment=${MLFLOW_EXPERIMENT_ID}"
  ok "  job_id=${FRESHNESS_JOB_ID}"
  ok "  postgres_branch=${LAKEBASE_BRANCH}"
  ok "  postgres_database=${LAKEBASE_DATABASE}"

  # Step 2c: Deploy
  deploy_bundle "${APP_BUNDLE}" "${APP_EXTRA_ARGS[@]}"

   # Step 2d: Resolve the deployed app URL from the Apps API.
    # bundle summary doesn't include the live app URL — it's on the running app.
    if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    log "Resolving app URL from Apps API"
    APP_URL=""
    APP_URL=$(
      databricks apps get "${APP_DISPLAY_NAME}" 2>/dev/null | \
      python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("url", ""))
' 2>/dev/null) || APP_URL=""

    # Step 2e: Create/update the MCP HTTP connection.
    # Runs the create_mcp_connection notebook job (schema-level connection via REST).
    # On first deploy: creates the connection. On subsequent: updates if URL changed.
    if [[ -n "${APP_URL}" ]]; then
      ok "App URL: ${APP_URL}"

      # Check if connection already exists (for auto-redeploy decision)
      connection_existed=false
      if databricks api get /api/2.1/unity-catalog/connections/"${CATALOG}.${SCHEMA}.${MCP_CONNECTION_NAME}" >/dev/null 2>&1; then
        connection_existed=true
      fi

      if run_create_mcp_connection "${APP_URL}"; then
        # Step 2f: Auto-redeploy if connection was just created.
        # The MCP service resource needs the connection to exist.
        if [[ "${connection_existed}" == false ]]; then
          log "MCP connection created — redeploying app to register MCP service"
          deploy_bundle "${APP_BUNDLE}" "${APP_EXTRA_ARGS[@]}"
          if [[ "${LAST_DEPLOY_RC:-1}" -eq 0 ]]; then
            ok "MCP service registered (first-deploy deferral resolved)"
          else
            # Recovery: a 504 timeout can leave the MCP service created but
            # untracked by the bundle (no state entry, grants not applied).
            # If the service exists, bind it and deploy once more for grants.
            local mcp_full_name="${CATALOG}.${SCHEMA}.${MCP_CONNECTION_NAME}"
            if databricks api get /api/2.1/unity-catalog/mcp-services/"${mcp_full_name}" >/dev/null 2>&1; then
              log "MCP service exists despite deploy failure — binding to bundle state"
              if (cd_bundle "${SCRIPT_DIR}/${APP_BUNDLE}" && \
                  databricks bundle deployment bind ground_truth_mcp "${mcp_full_name}" \
                    --target "${TARGET}" --auto-approve \
                    ${APP_EXTRA_ARGS[@]+"${APP_EXTRA_ARGS[@]}"}) 2>&1; then
                ok "Bound MCP service to bundle state"
                log "Deploying once more to apply grants"
                deploy_bundle "${APP_BUNDLE}" "${APP_EXTRA_ARGS[@]}"
                if [[ "${LAST_DEPLOY_RC:-1}" -eq 0 ]]; then
                  ok "MCP service registered (recovered via bind after timeout)"
                else
                  warn "Grant deploy failed after bind — check output above."
                fi
              else
                warn "bundle deployment bind failed — run manually:"
                warn "  cd ${APP_BUNDLE} && databricks bundle deployment bind ground_truth_mcp '${mcp_full_name}' --target ${TARGET} --auto-approve"
              fi
            else
              warn "Redeploy after connection creation failed — MCP service may be unregistered."
              warn "Retry with: ./deploy.sh --target ${TARGET} --app"
            fi
          fi
        fi
      else
        warn "MCP connection not created — MCP service will remain unregistered."
        warn "Check M2M SPN credentials and retry: ./deploy.sh --target ${TARGET} --app"
      fi
    else
      warn "Could not resolve app URL from bundle summary."
      warn "The app may not have started yet. Check with:"
      warn "  databricks apps get ${APP_DISPLAY_NAME}"
    fi

    # Step 2g: Optional deploy_verification (M2M probes of /health, /api/*, /mcp)
    if [[ "${RUN_VERIFY}" == true ]]; then
      run_bundle_job "${APP_BUNDLE}" deploy_verification "${APP_EXTRA_ARGS[@]}"
    fi

    # Step 2h: Summary.
    log "App deploy complete: ${APP_DISPLAY_NAME}"
    echo "  App URL:        ${APP_URL:-UNKNOWN}"
    echo "  MCP connection: ${CATALOG}.${SCHEMA}.${MCP_CONNECTION_NAME}"
    echo "  Note: app_role update is NOT needed — AppKit CAN_CONNECT_AND_CREATE"
    echo "  auto-provisions a Lakebase role for the app SPN."

    # Step 2i: Re-deploy infra if the app SPN was not available in Phase 1.
    # On first deploy the app doesn't exist during Phase 1, so the scope ACL
    # uses the target default. After Phase 2 creates the app, check whether
    # the live SPN differs and, if so, re-deploy infra to fix the ACL.
    if [[ "${DEPLOY_INFRA}" == true ]] && [[ -z "${APP_SPN_CLIENT_ID}" ]]; then
      live_spn=$(
        # Resolve the live app SPN after Phase 2 created the app
        databricks apps get "${APP_DISPLAY_NAME}" --output json 2>/dev/null | \
        python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("service_principal_client_id", ""))
' 2>/dev/null) || live_spn=""
      live_spn=$(safe "${live_spn}")
      if [[ -n "${live_spn}" ]]; then
        log "Updating infra secret scope ACL with live app SPN: ${live_spn}"
        deploy_bundle "${INFRA_BUNDLE}" \
          ${INFRA_EXTRA_ARGS[@]+"${INFRA_EXTRA_ARGS[@]}"} \
          "--var" "app_service_principal_id=$(safe "${live_spn}")"
        APP_SPN_CLIENT_ID="${live_spn}"
      fi
    fi
  fi
fi

# --------------------------------------------------------------------------- #
# Phase 3: Agent bundle (Bundle 3)
# --------------------------------------------------------------------------- #
if [[ "${DEPLOY_AGENT}" == true ]]; then

  # Step 3a: Ensure infra vars are resolved (--agent only runs skip Phase 1)
  if [[ -z "${CATALOG}" ]]; then
    log "Resolving infra vars for agent deploy (--agent only)"
    resolve_infra_vars
  fi

  # Step 3b: The agent bundle reads metric views + OTel tables from the infra
  # schema and runs the Genie space on the infra warehouse. space_title stays
  # in the agent's databricks.yml (static per target).
  AGENT_EXTRA_ARGS=(
    "--var" "catalog=${CATALOG}"
    "--var" "schema_name=${SCHEMA}"
    "--var" "warehouse_id=${SQL_WAREHOUSE_ID}"
  )

  log "Deploying agent bundle with infra-resolved variables"
  ok "  catalog=${CATALOG}"
  ok "  schema_name=${SCHEMA}"
  ok "  warehouse_id=${SQL_WAREHOUSE_ID}"

  # Step 3c: Deploy (Genie space + agent_verification job)
  deploy_bundle "${AGENT_BUNDLE}" "${AGENT_EXTRA_ARGS[@]}"

  # Step 3d: Optional verification (11 checks: space config, data sources,
  # example SQL EXPLAIN, probe questions)
  if [[ "${VALIDATE_ONLY}" != true ]] && [[ "${DESTROY}" != true ]]; then
    if [[ "${LAST_DEPLOY_RC:-1}" -ne 0 ]]; then
      warn "Agent deploy reported errors — skipping agent_verification."
    elif [[ "${RUN_VERIFY}" == true ]]; then
      run_bundle_job "${AGENT_BUNDLE}" agent_verification "${AGENT_EXTRA_ARGS[@]}"
    else
      ok "Skipped agent_verification (pass --verify to run it)."
    fi
  fi
fi

# --------------------------------------------------------------------------- #
# Done
# --------------------------------------------------------------------------- #
log "Deploy complete (target: ${TARGET})"
