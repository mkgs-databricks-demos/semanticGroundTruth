# 20 — App runtime config, ACL safety net, verification checks

**Wave 0 · edit · bundle `ground-truth-app` · gaps G1 (safety net), G3 (app half), G17**

## Steps
1. Contract: in `shared/contracts/`, add `AppRuntimeConfig` (`{ executive_dashboard_url: string | null }`) + zod schema. No `enum` / `namespace`.
2. `server/routes/config.ts`: `GET /api/config` for any authenticated caller, returning the contract from `process.env.GT_EXEC_DASHBOARD_URL` (empty string → `null`; reject values that are not `https://`). Register in `server/routes/index.ts`. `config.test.ts` covers set, unset, and non-https.
3. App bundle: variable `exec_dashboard_url` (default `""`), passed to the app as env `GT_EXEC_DASHBOARD_URL` (follow how existing env values are declared in `resources/app.app.yml` / `app.yaml`). Session 23 supplies the real URL.
4. `src/notebooks/grant_app_permissions.ipynb`: after the existing `CAN_USE` step, resolve the app's `service_principal_client_id` and `w.secrets.put_acl(scope=<secret_scope_name>, principal=<spn>, permission=READ)`; idempotent; print the resulting ACL list. This is the safety net if an infra deploy runs without the session 18 variable.
5. `src/notebooks/deploy_verification.ipynb`: add two checks — (a) `secrets.list_acls(scope)` contains the app SPN with READ or MANAGE; (b) `GET /api/config` returns 200 and matches the contract. Keep the existing 6 checks and the fail-on-any-failure behaviour.
6. `package.json`: `prebuild` already exists (`pnpm run sync && appkit generate-types --wait`); append ` && vitest run` so tests run after type generation in every Apps build. Confirm in the summary that the Apps build invokes `build` (and therefore `prebuild`). Do not add or upgrade dependencies.
7. `bundle validate --strict --target dev`.

## Done when
Wave 0 gate lines for 20 hold and validate passes.
