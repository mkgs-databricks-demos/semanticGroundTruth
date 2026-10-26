# Session 36: Converge app: migration 009, skip/settings/steward APIs, MCP App

**Build 4 · wave `4-4` · converge (alone) · target `app`; the wave gate also checks `app_deploy_verification`**

## Carried in (added 2026-10-26, before the wave 4-4 repair)

The first session 36 attempt ended `blocked` (`8be12a8`). The owner then fixed both blockers interactively (see `docs/sessions/2026-10-26_agent-skills-volume-otel-grants.md`): the OTel tables are app `TABLE` resources, so the app SPN gets `USE CATALOG`/`USE SCHEMA` and telemetry flows again; agent skills load from the `agent_skills` UC volume; the app was deployed interactively (deployment `01f1d103d536117fab60caa95e43fdb8`, 2026-10-26 06:09 UTC). Do the two fixes below in step 0, then continue with step 1.

0. **Session 35 requests** (from `.build-status/110489694161084/35.json`):
   * MCP `structuredContent` must be an object. `review_add_synonym`, `review_add_example`, `campaign_list` and `metric_view_list` return a bare array: wrap it as `{ items: [...] }` in `server/mcp/tools/**`, change their `output` in `MCP_TOOL_CONTRACTS` (`shared/contracts/schemas.ts`) to match, regenerate `shared/contracts/generated/contracts.schema.json` and `tests/contract/manifest.json`, and remove the `knownDefect` / `it.fails` entries for them in `tests/contract/toolCases.ts`. Keep the text content unchanged.
   * `requireObo` in `server/mcp/tools/metricView.ts`: throw `forbidden()` from `server/lib/errors` instead of a plain `Error`, so `toToolError` maps it to the forbidden tool error; remove the 3 `oboErrorIsInternal` `knownDefect` entries (metric view tools, no OBO token).
   * Done when `tests/contract/toolCases.ts` has no `knownDefect` left (today 7: 4 `bareArrayStructuredContent`, 3 `oboErrorIsInternal`), `vitest run` reports 0 expected failures, and both `tsc -b` pass.

**Deploy limit (known):** from an unattended `genie_task`, `bundle deploy` fails at `apps update` with `Invalid delegation claim` (first attempt). If that is the only failure and the remaining plan diff is the no-op `config.env` diff (the API returns env entries without values), continue: `bundle deploy` has already synced files and other resources, and `bundle run app` deploys the new code. Record it as a suppression with the exact error. Any other `bundle deploy` failure stops the session.

## Steps

1. Before deploying, in `/tmp/gt-36/` (runbook toolchain): `pnpm install --frozen-lockfile`, `vitest run`, both `tsc -b`. Fix failures in owned paths first; the Apps build runs the same tests in `prebuild`.
2. From `ground-truth-app`: `bundle validate --strict --target dev`; `bundle deploy --target dev`; `bundle run app --target dev`. Migration 009 runs at app start; confirm `app._migrations` has `009_skips_settings_triage` in the app logs.
3. Runtime: zero `ERROR`/`FATAL` and zero `"level":"error"|"fatal"` after the active deployment starts; `listening on` present. Probes (manifest `runtime_targets.app.probes`): `/health`, `/api/me` (admin), `/api/campaigns`, `/api/config` (https dashboard URL), `/api/me/settings` (defaults: `"theme":"system"`), `/api/review/stats/me` (has `skippedCount`), `/fonts/dm-sans-regular.ttf`, MCP initialize.
4. `bundle run deploy_verification --target dev` passes all existing checks. Add nothing to it here; the live contract job is converged in session 40.
5. Manual checks for the owner (record in the session doc): in Genie One / Genie Code with MCP Apps preview, call `review_get_next` and confirm the card renders and Approve/Skip work; keyboard-only review in the web UI; light/dark.

## Stable when

Runtime gate passes for `app` (10-minute soak, 0 errors, ≥ 1 trace) and `app_deploy_verification`.

## Owned Paths

- `ground-truth-app/**` (excluding `ground-truth-app/.build-status/**`, `ground-truth-app/.databricks/**`)

## Dependencies

- 25, 26, 33, 34, 35
