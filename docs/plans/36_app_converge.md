# Session 36: Converge app: migration 009, skip/settings/steward APIs, MCP App

**Build 4 · wave `4-4` · converge (alone) · target `app`; the wave gate also checks `app_deploy_verification`**

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
