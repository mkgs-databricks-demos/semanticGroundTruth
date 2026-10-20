# 2026-10-19 — App Bundle Phase B: First Deploy + Lakebase SPN Investigation

**Branch:** `mg-genie-app-scaffold`
**Commits:** ~15 ahead of `origin/main`

---

## Summary

Deployed `dev-semantic-ground-truth` to the platform. All five AppKit plugins operational. Investigated Lakebase SPN auto-provisioning — discovered AppKit `CAN_CONNECT_AND_CREATE` handles identity mapping automatically, eliminating the manual `app_role` update step.

---

## Problems & Root Causes

### 1. App ALREADY_EXISTS on redeploy after rename
**Symptom:** `bundle deploy` returned 409 ALREADY_EXISTS for `dev-semantic-ground-truth`.  
**Root cause:** Bundle state file (`~/.bundle/ground-truth-app/dev/state/resources.json`) still tracked the old app name `ground-truth-app`. After renaming to `dev-semantic-ground-truth`, the bundle tried to CREATE instead of UPDATE.  
**Fix:** Delete the workspace state file + delete the old app, then fresh deploy.

### 2. CLI version mismatch warning
**Symptom:** `State was last deployed with CLI version 1.21.0 but current version is 1.20.0`.  
**Root cause:** Bundle editor uses workspace CLI (1.20.0), terminal has 1.21.0.  
**Impact:** Non-fatal warning, safe to ignore.

### 3. MCP service fails on every deploy (expected)
**Symptom:** `Connection 'semantic-ground-truth-mcp' does not exist`.  
**Root cause:** HTTP connection requires valid M2M SPN credentials + app URL. Created post-deploy by `post_deploy_setup` job.  
**Impact:** Expected on first deploy. Will resolve after `--infra --run-setup` then `--app` redeploy.

---

## Changes Made

### deploy.sh
- Fixed post-deploy checklist: step 4 is `--app` (not `--infra`) for MCP service
- Fixed usage block: first-deploy sequence now shows correct `--infra --run-setup` then `--app`
- Removed SPN update step from checklist — AppKit auto-provisions
- Added explanatory note about `CAN_CONNECT_AND_CREATE`

### ground-truth-app/databricks.yml
- Renamed `default` target to `local`, moved to bottom
- Target order: `dev` (default: true) → `prod` → `local`

### ground-truth-app/PROJECT_MEMORY.md
- Full refresh: targets, variables (with dev values), OTel tables, MCP dependency chain
- Post-deploy checklist with corrected steps
- Remaining work split into completed (Phase A+B) and remaining (Phase C+)
- Critical deploy findings (8 items)
- Status log

### PROJECT_MEMORY.md (solution root)
- Added Phase B deploy status to status log
- Added 7 new critical deploy findings (#10–16)
- Added Post-Deploy Checklist section with `--app` fix and SPN explanation

### ground-truth-infra/resources/lakebase/app_role.postgres_role.yml
- Replaced stale TODO comment ("Update to SERVICE_PRINCIPAL after Bundle 2") with accurate explanation of AppKit auto-provisioning pattern

---

## Key Decisions

### app_role update NOT needed
**Investigation:** Queried Lakebase roles, schemas, tables, grants, and database privileges via SDK + psycopg3.

**Findings:**
- AppKit `CAN_CONNECT_AND_CREATE` resource binding auto-provisions `dbrx-apps-55882972-...` role (SERVICE_PRINCIPAL, OAuth)
- App SPN creates its own schemas (`app`, `appkit`) on startup via migrations
- `app_role` is a plain PG role that owns the `ground_truth_app` database but zero objects
- M2M SPN (`16f8923c-...`) has no Lakebase role — only used for MCP HTTP connection token exchange

**Decision:** Keep `app_role` as vestigial database owner. No manual SPN mapping needed. Post-deploy checklist reduced from 5 to 3 steps.

### Target naming: `default` → `local`
The `default` target was only for localhost proxy (`pnpm run dev`). Renamed to `local` and moved to bottom. `dev` is the only true default (`default: true`).

---

## Files Modified

| File | Change |
|------|--------|
| `deploy.sh` | Post-deploy checklist fix (`--app` not `--infra`), usage block, SPN note |
| `ground-truth-app/databricks.yml` | Rename `default`→`local`, reorder targets |
| `ground-truth-app/PROJECT_MEMORY.md` | Full refresh (targets, vars, OTel, checklist, findings, status) |
| `PROJECT_MEMORY.md` | Phase B status, 7 findings, post-deploy checklist |
| `ground-truth-infra/resources/lakebase/app_role.postgres_role.yml` | Comment update (auto-provisioning) |

---

## App Deploy Details

| Field | Value |
|-------|-------|
| App name | `dev-semantic-ground-truth` |
| App UUID | `55882972-924d-42cd-ab3d-d10c730629c2` |
| URL | `https://dev-semantic-ground-truth-7474657291520070.aws.databricksapps.com` |
| SPN workspace ID | `76147310788512` |
| SPN client ID | `55882972-924d-42cd-ab3d-d10c730629c2` |
| SPN display name | `app-4ibqav dev-semantic-ground-truth` |
| Status | RUNNING |
| Compute | MEDIUM, ACTIVE |
| OBO scopes | sql, genie, files, model-serving |

---

## Remaining Post-Deploy Steps

1. ✅ Verify app health
2. ✅ SPN investigation (NOT needed)
3. ⬜ `./deploy.sh --target dev --infra --run-setup` (MCP connection)
4. ⬜ `./deploy.sh --target dev --app` (MCP service registration)
5. ⬜ Verify MCP service in Unity Gateway
