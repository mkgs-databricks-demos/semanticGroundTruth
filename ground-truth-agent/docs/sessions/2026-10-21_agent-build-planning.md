# 2026-10-21 — Agent build planning: waves 0–1, branch creation, project memory

## Summary

Interactive controller session to plan the Bundle 3 (Genie Agent) build. Created the feature branch, wrote plan files for 3 sessions across 2 waves, wrote the waves.json manifest, and created this project’s `PROJECT_MEMORY.md`. The build can’t start until Part A wave 8 (app deploy + verification) completes, so planning is the full scope of this session.

## Problems and root causes

### 1. genie_spaces DAB resource format was unknown
**Problem:** L300-14 (design doc) proposed a `genie_agents` resource key that doesn’t match the actual DAB schema. The open question in the design doc itself flagged this.
**Root cause:** Design was written before the DAB `genie_spaces` resource type was confirmed.
**Resolution:** Searched Databricks docs and confirmed the correct type is `genie_spaces` (not `genie_agents`), requires `engine: direct` (already set), and takes a `file_path` pointing to a `.geniespace.json`. Added in Databricks CLI 1.3.0. Updated plans accordingly.

### 2. Lakehouse Sync tables (`lb_*_history`) don’t exist yet
**Problem:** All 4 business metric views reference `lb_*_history` CDF tables. These tables don’t exist in the dev schema yet.
**Root cause:** Lakehouse Sync tables are created automatically after the app deploys and Lakebase migrations run. The app (Part A) hasn’t been deployed yet — wave 7 session 19 is the converge deploy and was still running during this session.
**Resolution:** Documented as a known blocker in plan 03 (converge session). The converge session must wait for tables and retry. OTel tables already exist and are available immediately for operational metric views.

### 3. Column drift risk
**Problem:** Infra metric view fixtures (`mv_*.yaml`) reference columns like `vote_type`, `reviewer_id`, `asset_type`, `status` that were designed before the app’s actual migration schema was written.
**Root cause:** The infra fixtures were written in the design phase (L300-05) against a conceptual schema, not the actual Lakebase migrations from session 03 of the app build.
**Resolution:** Plan 03 (converge) explicitly tasks the session with running `DESCRIBE TABLE` on each `lb_*_history` table and comparing column names to the metric view DDL before executing. Column drift is an expected issue to fix in-session.

### 4. Branch cross-contamination on commit
**Problem:** The initial commit to `mg-genie-agent-build` included 16 stray app code files from `ground-truth-app/` (session 17/18 changes).
**Root cause:** When switching from `mg-genie-app-first-deploy` to `main` and then creating `mg-genie-agent-build`, the workspace git integration carried over uncommitted working-tree changes from the app branch (session 17/18 edits that the build integrator had made but the workspace hadn’t yet committed to disk at the time of checkout).
**Resolution:** Not fixed in this session — the agent plan files are correctly committed. Cleanup (removing the stray app files from this branch) should happen before raising a PR.

## Changes made

### New files
| File | Description |
|------|-------------|
| `docs/plans/01_bundle_config_and_genie_resource.md` | Plan: `databricks.yml` variables + `genie_spaces` resource + `.geniespace.json` |
| `docs/plans/02_metric_views_and_deploy_jobs.md` | Plan: metric view deploy notebook + agent verification notebook + 2 job YAMLs |
| `docs/plans/03_converge_deploy_and_verify.md` | Plan: converge deploy agent, wait for Lakehouse Sync, fix column drift, verify |
| `docs/plans/waves.json` | Manifest: 2 waves, 3 sessions, 3 runtime_targets (`agent`, `deploy_metric_views`, `agent_verification`) |
| `docs/plans/INDEX.md` | Wave map + data sources + known risks |
| `PROJECT_MEMORY.md` | Bundle project memory (this file’s sibling) |
| `docs/sessions/INDEX.md` | Sessions index (reverse-chronological) |
| `docs/sessions/2026-10-21_agent-build-planning.md` | This file |

### Modified files
| File | Changes |
|------|--------|
| `databricks.yml` | Unchanged in this session — sessions 01/02 will edit it |

## Key decisions

1. **DAB resource type: `genie_spaces`, not `genie_agents`**
   Confirmed from docs. Requires `engine: direct` (already set). Use `file_path` (not `serialized_space`) for maintainability.

2. **6 metric views (4 business + 2 operational)**
   Added 2 OTel metric views (`mv_otel_error_rate`, `mv_otel_request_latency`) beyond the 4 originally planned in L200-C9. These are available immediately (OTel tables already exist) and give the agent operational coverage.

3. **Column drift goes to the converge session, not wave 0**
   Sessions 01+02 only write files. Actual column verification requires runtime access to `lb_*_history` schemas — only possible in the converge session (03) after Part A deploys.

4. **Separate genie-build-waves instance (`-sgt-agent` suffix)**
   Follows the Rule 9 guardrail: each project gets its own build-waves instance. The agent build uses `--var="instance_suffix=-sgt-agent"` to avoid colliding with the app build instance.

5. **max_attempts=6, timeout_minutes=120 for converge**
   Smaller than app converge (8/180) — the agent bundle is simpler (no TypeScript build). The extra budget is mainly for Lakehouse Sync wait time.

## Build state at session end

| Item | Value |
|------|-------|
| Branch | `mg-genie-agent-build` (from main at `6af87be`) |
| Committed | 5 plan files (+ 16 stray app files — cleanup needed) |
| genie-build-waves | Not deployed for this bundle yet |
| Next action | Wait for Part A wave 8 to complete, then deploy + run setup + start build |

## Next steps

1. Wait for Part A wave 7–8 to complete (session 19 converge deploy is running as of this planning session).
2. Clean up stray app files from branch before starting the build.
3. Deploy genie-build-waves with `-sgt-agent` suffix.
4. Run setup with `run_smoke=true` and verify capability_probe.
5. Start build for waves 0–1.
