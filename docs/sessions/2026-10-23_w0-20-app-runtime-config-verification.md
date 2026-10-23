# Session 20 — App runtime config, ACL safety net, verification checks

**Wave:** 0 · **Mode:** edit · **Branch:** `mg-genie-ui-brand-and-gaps` · **Run:** 745271774924215
**Date:** 2026-10-23

## Scope

GET /api/config (authenticated) returning `executive_dashboard_url` from env `GT_EXEC_DASHBOARD_URL`; app bundle variable `exec_dashboard_url` wired to that env; `grant_app_permissions` grants the app SPN READ on the secret scope (idempotent); `deploy_verification` checks the scope ACL and `/api/config`; `package.json` prebuild runs vitest (gap G17).

## Changes

### 1. Runtime config contract (`shared/contracts/config.ts`)

- Created `AppRuntimeConfig` type: `{ executive_dashboard_url: string | null }`
- Zod schema `AppRuntimeConfigSchema` with `z.string().url().nullable()`
- Re-exported from `shared/contracts/index.ts`

### 2. Config route (`server/routes/config.ts`)

- `GET /api/config` — any authenticated caller (requireRole 'reviewer')
- `resolveExecDashboardUrl()`: reads `process.env.GT_EXEC_DASHBOARD_URL`, trims whitespace, returns null for empty/missing/non-https values
- Registered in `server/routes/index.ts` as `registerConfigRoutes`

### 3. Config route tests (`server/routes/config.test.ts`)

- 7 vitest cases: valid https URL, unset env, empty string, whitespace-only, http:// (non-https), bare path, whitespace-trimming
- Saves/restores `process.env.GT_EXEC_DASHBOARD_URL` in beforeEach/afterEach

### 4. App bundle variable + env

- `databricks.yml`: added `exec_dashboard_url` variable (default `""`) with description noting it maps to `GT_EXEC_DASHBOARD_URL` in `app.yaml`
- Dev target value set to `""`
- `app.yaml`: added `GT_EXEC_DASHBOARD_URL` env with `value: ""` under a Runtime config section
- **Wiring note:** `app.yaml` does not support `${var.*}` interpolation. The variable serves as a deploy.sh override point (`--var exec_dashboard_url=<url>`). Session 23 (converge) will update `app.yaml` with the real dashboard URL from session 22b's summary before deploying.

### 5. Secret scope ACL safety net (`grant_app_permissions.ipynb`)

- New cell after the CAN_USE grant: resolves the app's own SPN via `w.apps.get(app_name).service_principal_client_id`, then `w.secrets.put_acl(scope, principal, READ)` (idempotent)
- Prints the full ACL list after the grant

### 6. Deploy verification checks (`deploy_verification.ipynb`)

- **Check 5 (scope ACL):** creates a standard `WorkspaceClient()`, resolves the app's SPN, lists ACLs on the scope, asserts the app SPN has READ or MANAGE
- **Check 6 (/api/config):** `GET /api/config` → 200, validates `executive_dashboard_url` is null or starts with `https://`
- MD header cell updated to list all 6 checks (was 4)

### 7. Prebuild vitest (`package.json`)

- `prebuild` script: `"pnpm run sync && appkit generate-types --wait && vitest run"`
- The Apps build runs `pnpm run build`, which triggers `prebuild` first (Node.js convention). This means tests run in every Apps build (gap G17).

## Checks

| Check | Result |
|---|---|
| `bundle validate --strict --target dev` | **pass** |

## Assumptions

- `app.yaml` does not support `${var.*}` interpolation; session 23 will update the `GT_EXEC_DASHBOARD_URL` value directly in `app.yaml` before deploy.
- The app's SPN client_id is accepted by `secrets.put_acl()` as the principal parameter (confirmed in Databricks docs).
- The Apps build chain is `prebuild` → `build` → (`build:server` + `build:client`), so appending `vitest run` to `prebuild` runs tests before every build.

## Files changed

| File | Action |
|---|---|
| `ground-truth-app/shared/contracts/config.ts` | created |
| `ground-truth-app/shared/contracts/index.ts` | updated (added config export) |
| `ground-truth-app/server/routes/config.ts` | created |
| `ground-truth-app/server/routes/config.test.ts` | created |
| `ground-truth-app/server/routes/index.ts` | updated (registered config route) |
| `ground-truth-app/databricks.yml` | updated (added exec_dashboard_url variable) |
| `ground-truth-app/app.yaml` | updated (added GT_EXEC_DASHBOARD_URL env) |
| `ground-truth-app/package.json` | updated (prebuild += vitest run) |
| `ground-truth-app/src/notebooks/grant_app_permissions.ipynb` | updated (added scope ACL cell) |
| `ground-truth-app/src/notebooks/deploy_verification.ipynb` | updated (added checks 5-6) |
