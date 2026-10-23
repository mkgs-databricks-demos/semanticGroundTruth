# 10 — App client: import wizard + members page

**Wave 1 · edit · owns `ground-truth-app/client/**`**

## Context
* React 19 + Vite + Tailwind 4 + TanStack Query; API layer under `client/src/api/`; pages under `client/src/pages/{admin,steward,review,leaderboard,executive,agents}/`. Types come only from `shared/contracts` (plan 01).
* Load the Databricks brand skills for colors/typography/accessibility (contrast ≥ 4.5:1).

## Steps
1. API hooks for every route in build_conventions §4.
2. Steward → **New campaign from assets** wizard: (a) pick catalog → schema → multi-select metric views; (b) optionally pick or register a Git folder source and see matched YAML files; (c) optional glossary terms from the source scan (checkbox list with definition preview); (d) import → show created/updated/skipped; (e) campaign form pre-filled with the imported asset ids and app-group assignments → `POST /api/campaigns`.
3. Admin → **Members** page: three app groups, add member by email / SPN application id, remove with confirm; show the 409 last-admin message.
4. Hide steward/admin navigation for callers without the role (`/api/me` roles).

## Done when
* `pnpm exec tsc --noEmit -p tsconfig.client.json` passes and `pnpm run build:client` (or the repo's client build script) succeeds.
* No client file imports from `server/`.
