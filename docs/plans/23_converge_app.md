# 23 — Converge app: branded UI, runtime config, clean runtime gate

**Wave 3 · converge (alone) · targets `app`, `app_deploy_verification`**

## Steps
1. Get the executive dashboard URL from session 22's summary (or `bundle summary` in `ground-truth-infra` → dashboard id → `https://<workspace>/dashboardsv3/<id>/published`).
2. From `ground-truth-app`: `bundle validate --strict --target dev`; `bundle deploy --target dev --var=exec_dashboard_url=<url>`; `bundle run app --target dev`.
3. Fix Apps build failures (`tsc -b`, vitest via prebuild) in the owned paths. Treat a failing `contrast.test.ts` as a token bug to fix in `theme/tokens.ts` + `index.css` together — never lower a threshold.
4. Runtime: zero `ERROR`/`FATAL` and zero `"level":"error"` lines after the active deployment starts; `listening on` marker present; probes `/health`, `/api/me` (admin), `/api/campaigns`, `/api/config` (https URL), `/fonts/dm-sans-regular.ttf`, MCP initialize all pass. If `error resolving resource m2m-client-id` still appears, the scope ACL is wrong: stop as `blocked` and name the ACL state; do not remove the secret resource or filter the log.
5. `bundle run deploy_verification --target dev` passes all checks (6 existing + ACL + /api/config).
6. Record in the session doc: screenshots are not possible from the job, so list the manual checks for the owner (light/dark toggle, keyboard-only vote, Lighthouse a11y score).

## Stable when
Runtime gate passes for `app` (10-minute soak, 0 errors, ≥ 1 trace) and `app_deploy_verification`.
