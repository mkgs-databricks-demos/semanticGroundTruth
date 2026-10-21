# Session 02: Server Foundation Library + Dependencies

## Scope
Create `server/lib/` with the helpers every server session codes against (signatures fixed in `build_conventions.md` §7): `db.ts`, `errors.ts`, `http.ts`, `context.ts`, `config.ts`, `events.ts`, `databricks.ts`, `logger.ts`, `deps.ts`, `index.ts`. Add the new runtime dependencies to `package.json`. Do not touch `server/server.ts` or any route.

## Context
* Read `docs/plans/build_conventions.md` fully. Section 7 signatures are the contract; implement them exactly.
* Session 01 (same wave) creates `shared/contracts/errors.ts` (`ErrorCode`, `ERROR_STATUS`) and `shared/contracts/values.ts` (`Role`, `VoteType`). Import from `'../../shared/contracts'` and code against the names in plan 01.
* `appkit.lakebase.query()` returns `{ rows }` (see `server/routes/lakebase/todo-routes.ts`). It is pooled.
* `pnpm-lock.yaml` is NOT updated in this build (no pnpm). The controller session regenerates it before deploy. Only edit `package.json`.

## Tasks
1. `server/lib/logger.ts` — JSON-line logger over `console` (`{ level, msg, ts, ...meta }`), redacting any meta key matching `/token|secret|authorization|password/i`.
2. `server/lib/db.ts` — `Db` interface + `createDb(lakebase)`:
   * `query` returns `rows as T[]`; `one` returns first row or `null`.
   * `tx(script)` runs `appkit.lakebase.query('BEGIN;\n' + script + '\nCOMMIT;')` as one call (simple-protocol multi-statement), and on error attempts `ROLLBACK` then rethrows.
   * Log slow queries (> 500 ms) at `warn` with the first 120 chars of SQL (never params).
3. `server/lib/errors.ts` — `AppError` (fields `code`, `status` from `ERROR_STATUS`, `details`), factories `badRequest`, `unauthenticated`, `forbidden`, `notFound`, `conflict`, `upstream`, and `toAppError(err: unknown): AppError` (maps zod `ZodError` -> BAD_REQUEST with `issues` in details; Postgres error code `23505` -> CONFLICT; `23503` -> BAD_REQUEST; else INTERNAL with a generic message).
4. `server/lib/http.ts` — `asyncRoute`, `sendError`, `parseBody`, `parseQuery` (signatures §7). `sendError` writes `ErrorResponse` JSON and logs 5xx at `error` including `x-request-id`. Type-only express imports.
5. `server/lib/context.ts` — `UserContext` (use `Role` from shared contracts), `getUser(res)` (reads `res.locals.user`), `requireRole(user, role)` with hierarchy admin > steward > reviewer, `hasRole(user, role): boolean`.
6. `server/lib/config.ts` — `AppSettings`, `DEFAULT_SETTINGS` = `{ wilsonZ: 1.96, industryPrior: 0.5, priorWeight: 4, priorDecayThreshold: 30, certificationThreshold: 0.8, minVotesForCertification: 5, stalenessDays: 90, freshnessIntervalDays: 180, adminEmails: [], stewardEmails: [], seedSampleAssets: false }`. `ConfigStore` reads `SELECT key, value FROM app.app_config` (snake_case keys, e.g. `wilson_z`), merges over defaults, caches 60 s; `update()` upserts each key (`INSERT ... ON CONFLICT (key) DO UPDATE`) and clears cache. Env overrides applied last: `GT_ADMIN_EMAILS` and `GT_STEWARD_EMAILS` (comma lists, merged/deduped), `SEED_SAMPLE_ASSETS=true`. If the table does not exist yet (`42P01`), return defaults.
7. `server/lib/events.ts` — `DomainEvent` union (§7) + `EventBus` (`on(type, handler)`, `emit(event)` fire-and-forget, handler errors logged).
8. `server/lib/databricks.ts` — `workspaceHost()` (normalizes `DATABRICKS_HOST`), `executeStatement(opts)` via global `fetch` to `/api/2.0/sql/statements` with `{ warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID, statement, parameters, wait_timeout: '30s', disposition: 'INLINE', format: 'JSON_ARRAY', row_limit }`; poll `GET /api/2.0/sql/statements/{id}` every 1 s up to 60 s while `PENDING`/`RUNNING`; map `manifest.schema.columns[].name` + `result.data_array`. Throw `upstream()` on non-2xx or `FAILED` (include `status.error.message`, never the token). Also `currentUserFromToken(token): Promise<{ userName: string; groups: string[] }>` via `GET /api/2.0/preview/scim/v2/Me` (best-effort; return `{ userName: '', groups: [] }` on failure).
9. `server/lib/deps.ts` — `ServiceDeps { db; config; events }`.
10. `server/lib/index.ts` — re-export all of the above.
11. `package.json` — add to `dependencies` (keep alphabetical order): `"@modelcontextprotocol/sdk": "^1.23.0"`, `"@tanstack/react-query": "^5.90.0"`, `"framer-motion": "^12.23.0"`. Change nothing else.

## Acceptance Criteria
- [ ] All 10 files exist; every symbol in conventions §7 for `server/lib/*` is exported with that exact name.
- [ ] Only type imports from `express`; no `BEGIN`/`COMMIT` issued as separate queries.
- [ ] No secret, token or SQL parameter is ever logged.
- [ ] `package.json` is valid JSON with exactly 3 new dependencies.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/lib/**`
- `package.json`

## Dependencies
- Session 01 (parallel): `shared/contracts/errors.ts`, `shared/contracts/values.ts`.
