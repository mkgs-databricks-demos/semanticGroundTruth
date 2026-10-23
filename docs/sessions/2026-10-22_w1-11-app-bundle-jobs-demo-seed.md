# Session 11 — App bundle: permissions, bootstrap env, M2M verification, demo seed job

**Wave 1 · edit · 2026-10-22**

## Summary

Added M2M OAuth integration across the app bundle: a secret resource for the M2M SPN client\_id, bootstrap env vars for RBAC admin seeding, a CAN\_USE grant for workspace users, a rewritten deploy\_verification notebook using M2M OAuth (replacing job-identity auth that returned 401s), and a new demo\_campaign\_seed job that imports real assets from wanderBricks and runs an end-to-end demo flow.

## Changes

### databricks.yml
- Added variables `m2m_client_id_key` and `m2m_client_secret_key`
- Added dev/prod/local target defaults for both

### resources/app.app.yml
- Added `m2m-client-id` secret resource (scope `semantic_ground_truth_credentials`, key from `var.m2m_client_id_key`, permission READ)

### app.yaml
- Added `GT_BOOTSTRAP_ADMIN_IDS` env (valueFrom: m2m-client-id) — injects M2M SPN client\_id at runtime for RBAC bootstrap
- Added `GT_ADMIN_EMAILS` env (value: matthew.giglia@databricks.com) — dev bootstrap admin

### src/notebooks/grant_app_permissions.ipynb
- Added cell: grant CAN\_USE to workspace `users` group (additive, preserves M2M SPN grant)

### src/notebooks/deploy_verification.ipynb
- Rewrote for M2M OAuth: reads credentials from secret scope, creates WorkspaceClient with client\_id/client\_secret
- Strict 200 checks: /health, /api/me (roles include admin), /api/campaigns, POST /mcp initialize
- Removed old job-identity pattern that accepted 401s, UI route checks, source-grep fallbacks

### resources/jobs/deploy_verification.job.yml
- Added parameters: scope_name, client_id_key, client_secret_key (defaults from variables)

### src/notebooks/demo_campaign_seed.ipynb (NEW)
- 8-cell notebook with task dispatch: grant_demo_access, seed, verify
- grant_demo_access: app SPN CAN\_READ on Git folder, M2M SPN UC grants + warehouse CAN\_USE
- seed: register source, scan, import 3 metric views + glossary, create campaign, cast votes
- verify: leaderboard non-empty + campaign asset count > 0

### resources/jobs/demo_campaign_seed.job.yml (NEW)
- 3-task job: grant_demo_access → seed → verify, each running the same notebook with different `task` param
- Parameters from variables + dev-specific defaults for git_folder_path, metric_view_schema

## Decisions
- No bundle `permissions` block on the app (would replace ACL, dropping M2M SPN's CAN\_USE)
- CAN\_USE for users group granted additively in grant_app_permissions.ipynb
- Secret scope name hardcoded in job YAML defaults (same across all targets)
- Demo seed uses existing wanderBricks repo as real data source

## Checks
- `bundle validate --strict --target dev`: **pass**
- All notebook paths in YAML resolve to files on disk: **pass**
- No secret values or SPN IDs hardcoded: **pass**
- Typecheck / lint / vitest: **skipped** (no Node toolchain in session)

## Assumptions
- API routes `/api/sources`, `/api/assets/import`, `/api/campaigns`, `/api/review/next`, `/api/review/vote`, `/api/leaderboard` exist per build_conventions §4 (built by sessions 08-10)
- Scan response shape `{metric_views: [], glossary_terms: []}` per build_conventions §4-5
- Campaign creation accepts `rbac_groups` field per build_conventions §3

## Files modified
- ground-truth-app/databricks.yml
- ground-truth-app/resources/app.app.yml
- ground-truth-app/app.yaml
- ground-truth-app/resources/jobs/deploy_verification.job.yml
- ground-truth-app/src/notebooks/grant_app_permissions.ipynb
- ground-truth-app/src/notebooks/deploy_verification.ipynb
- ground-truth-app/resources/jobs/demo_campaign_seed.job.yml (new)
- ground-truth-app/src/notebooks/demo_campaign_seed.ipynb (new)
