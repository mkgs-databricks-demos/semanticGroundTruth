# Session 15: Tests + Scaffold Cleanup (Wave 5)

## Scope
Remove the remaining AppKit scaffold samples, update the Assistant page copy for the new agents, and add vitest unit tests for pure modules not yet covered. Tests are written, not run (no toolchain) — the controller runs `pnpm test` after the lockfile is regenerated.

## Context
* `build_conventions.md` §1 (no toolchain), §6 (owners). `vitest.config.ts` (globals on, node env, alias `@` -> `client/src`).
* Session summaries in `docs/sessions/` for waves 0-4 — read them to find exported pure functions and any `requests` addressed to cleanup.
* Existing tests: `server/example.test.ts` (sample) and the tests written by sessions 06, 07, 08, 11.

## Tasks
1. Delete scaffold pages: `client/src/pages/analytics/`, `client/src/pages/lakebase/`, `client/src/pages/jobs/`. First confirm (by reading `client/src/App.tsx`) nothing imports them; if something does, do not delete — add a `requests` entry instead.
2. Update `client/src/pages/agents/AgentChat.tsx` **copy and comments only**: replace references to `planner` / `helper` / `current_time` / `count_words` with the Review Assistant (`review-assistant`) and `review-worker`; keep all logic and exports identical.
3. Delete `server/example.test.ts`.
4. Add tests (each in the same folder as the module under test):
   * `shared/contracts/api.test.ts` — zod schemas: `VoteBodySchema` rejects bad `voteType`; `ExampleBodySchema` refinement; query schemas coerce strings.
   * `server/lib/errors.test.ts` — `toAppError` maps ZodError, pg `23505`, unknown.
   * `server/services/asset/versionHash.test.ts` — CRLF vs LF + trailing spaces produce the same hash.
   * `server/services/metricView/parseMetricViewYaml.test.ts` — measures/dimensions extraction from a 2-measure 2-dimension sample.
   * `server/middleware/roles.test.ts` — `resolveRoles` case-insensitivity and hierarchy.
   * `server/migrations/migrations.test.ts` — `MIGRATIONS` ids unique, ordered, every SQL contains no `DROP ` and every `CREATE TABLE` has `IF NOT EXISTS`.
   * `server/mcp/toolNames.test.ts` — `MCP_TOOL_NAMES` all match `/^(review|campaign|metric_view)_/` and are unique.
5. Do not touch `config/queries/**` (the analytics plugin stays registered).

## Acceptance Criteria
- [ ] Scaffold pages removed (or a request logged explaining why not); no dangling imports in `client/src`.
- [ ] `AgentChat.tsx` diff is limited to comments/strings.
- [ ] 7 new test files exist; each imports only modules that exist.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `client/src/pages/analytics/**`
- `client/src/pages/lakebase/**`
- `client/src/pages/jobs/**`
- `client/src/pages/agents/**`
- `server/example.test.ts`
- `shared/contracts/api.test.ts`
- `server/lib/errors.test.ts`
- `server/services/asset/versionHash.test.ts`
- `server/services/metricView/parseMetricViewYaml.test.ts`
- `server/middleware/roles.test.ts`
- `server/migrations/migrations.test.ts`
- `server/mcp/toolNames.test.ts`

## Dependencies
- Waves 0-4.
