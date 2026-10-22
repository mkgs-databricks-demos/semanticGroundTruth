# 2026-10-21 — First deploy planning: waves 6–8 + lockfile + build launch

## Summary

Interactive controller session to prepare the follow-up converge build (waves 6–8) that takes the edit-only codebase from PR #4 through first deploy and verification. This session regenerated the pnpm lockfile, wrote plan files for 4 new sessions, updated the manifest, and launched the build.

## Problems and root causes

### 1. No Node/pnpm toolchain on serverless compute
**Problem:** Serverless compute has Node v22.9.0 as a bare binary but npm/pnpm/corepack are broken symlinks. Cannot run `pnpm install` to regenerate the lockfile.
**Root cause:** Serverless Node is installed for Databricks internal use; package manager symlinks point to non-existent targets.
**Resolution:** Bootstrapped via `nodeenv --node=22.16.0 /tmp/nodeenv2216` + `npm install -g pnpm@11.0.8 --force`. Successfully ran `pnpm install --no-frozen-lockfile` to produce a 10,107-line `pnpm-lock.yaml`.

### 2. Potential zod v4 peer conflict with @modelcontextprotocol/sdk
**Problem:** Session 02 added `@modelcontextprotocol/sdk@^1.23.0`; the codebase uses zod 4.3.6. Older MCP SDK versions only accept zod v3 as a peer.
**Root cause:** Peer dependency version range in the SDK package.
**Resolution:** No conflict. `pnpm install` resolved MCP SDK to **1.32.1**, which accepts zod v4 natively. All 13 zod references resolve to 4.3.6. No overrides needed.

### 3. TypeScript errors (50 total: 43 server, 7 client)
**Problem:** `tsc -b tsconfig.server.json` reports 50 errors. Categorized into 9 groups (see plan 19 for full breakdown).
**Root cause:** Sessions 01–16 were edit-only with no tsc available. Errors accumulated across sessions — especially Express `req.query` type mismatches (12 errors), MCP SDK `tool()` overload changes (10 errors), missing AssetRegistry methods (4 errors), and unused imports (6 errors).
**Resolution:** Full error catalog written into plan 19 for the converge session to fix.

### 4. Known bugs carried from initial build
**Problem:** `server/lib/errors.ts` has `as ErrorCode` casts hiding a real bug (`'UPSTREAM'` instead of `'UPSTREAM_ERROR'`). Campaign entity missing `completedAt` field despite migration 003 having the column.
**Root cause:** Session 02 (errors.ts) was written before session 01 (contracts) completed; session 07 (campaigns) used `updated_at` as a proxy for `completed_at` and the stale comment was never updated.
**Resolution:** Dedicated sessions 17 and 18 (wave 6) to fix these before the converge deploy.

### 5. Smoke job `smoke_result: null` after setup
**Problem:** Running `setup_build_waves` with `run_smoke=true` reported `smoke_result: null`.
**Root cause:** The setup job's `run_smoke` parameter added the `capability_probe` task to the smoke job but didn't trigger a new smoke run. The latest smoke run predated the task addition.
**Resolution:** Manually triggered the smoke job via `jobs run-now`. Both `smoke_sessions` (2/2) and `capability_probe` passed.

## Changes made

### New files
| File | Description |
|------|-------------|
| `docs/plans/17_fix_error_code_casts.md` | Plan: remove `as ErrorCode` casts, fix `'UPSTREAM'` → `'UPSTREAM_ERROR'` |
| `docs/plans/18_campaign_completed_at_rbac.md` | Plan: wire `completedAt` through entity/mapper/manager, audit RBAC passthrough |
| `docs/plans/19_converge_app.md` | Plan: deploy app + post-deploy job, fix tsc/runtime errors, repeat until stable |
| `docs/plans/20_converge_deploy_verification.md` | Plan: write + deploy verification notebook/job, run until all checks pass |
| `pnpm-lock.yaml` | Regenerated (10,107 lines, lockfileVersion 9.0) |

### Modified files
| File | Changes |
|------|--------|
| `docs/plans/waves.json` | Branch → `mg-genie-app-first-deploy`; added `runtime_targets` block (app, app_post_deploy_setup, deploy_verification); appended waves 6–8 with sessions 17–20 |
| `docs/plans/INDEX.md` | Added wave 6–8 rows; updated branch/description; struck through resolved risks (lockfile, zod); added 3 new risks |

## Key decisions

1. **Wave structure for follow-up build:**
   * Wave 6 (parallel edit, static gate): 2 sessions fixing known compile bugs
   * Wave 7 (converge, runtime_gate: app + post-deploy): 1 session, 8 attempts, 180 min timeout
   * Wave 8 (converge, runtime_gate: deploy_verification + app): 1 session, 4 attempts, 120 min timeout

2. **Lockfile strategy:** Regenerated interactively rather than in a build session. This avoids Node toolchain issues inside Genie Code sessions.

3. **Zod v4 compatibility:** No conflict — MCP SDK 1.32.1 accepts zod v4 natively. No `pnpm.overrides` needed. Decision: use as-is.

4. **tsc errors go to the converge session (19), not wave 6:** Wave 6 fixes only the 2 known architectural bugs. The remaining 50 tsc errors are better handled in the converge loop where the session can deploy, see build output, and iterate.

5. **No vitest in build pipeline:** Tests stay as a manual pre-merge step. `pnpm run build` does `tsc -b` + `tsdown` + `vite build` only. Converge verifies runtime stability.

## Build infrastructure

| Item | Value |
|------|-------|
| Branch | `mg-genie-app-first-deploy` (from main at `6af87be`) |
| genie-build-waves deploy | SUCCESS — 3 jobs updated |
| Setup run | `926412486950350` — 36 tasks patched, skills republished |
| Smoke run | `378720959095828` — smoke_sessions 2/2 + capability_probe passed |
| Build run | `294202284707072` — waves 6–8 only (12 task keys) |
| Build job | `1079028753739581` |
| App | `dev-semantic-ground-truth` on `fevm-hls-fde` |

## Git status at session end

7 changed files on `mg-genie-app-first-deploy` (uncommitted — the build integrator will commit):
```
 M ground-truth-app/docs/plans/INDEX.md
 M ground-truth-app/docs/plans/waves.json
 M ground-truth-app/pnpm-lock.yaml
?? ground-truth-app/docs/plans/17_fix_error_code_casts.md
?? ground-truth-app/docs/plans/18_campaign_completed_at_rbac.md
?? ground-truth-app/docs/plans/19_converge_app.md
?? ground-truth-app/docs/plans/20_converge_deploy_verification.md
```

## Next steps

1. **Monitor build run `294202284707072`** — wave 6 sessions 17+18 should complete quickly (small edits). Wave 7 session 19 is the heavy converge loop.
2. **Part B: ground-truth-agent** — plan the Bundle 3 (Genie agent) build on a separate feature branch with instance suffix `-sgt-agent`. Depends on wave 8 passing.
