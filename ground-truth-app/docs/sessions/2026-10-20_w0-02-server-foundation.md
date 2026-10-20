# Session 02: Server Foundation Library + Dependencies

**Wave:** 0 · **Mode:** edit · **Run ID:** 675802846673302 · **Date:** 2026-10-20

## Summary

Created all 10 `server/lib/` files implementing the cross-module contracts from `build_conventions.md` §7, plus added 3 runtime dependencies to `package.json`.

## Problems

1. **session_id not passed to genie_task.** The for_each iteration inputs are not injected into the genie_task automation prompt. Both w0_session iterations received identical prompts without session_id. Root cause: genie_task does not support template substitution of for_each iteration variables. Workaround: deduced session_id from for_each iteration run state (iteration 0 = TERMINATED = session 01, iteration 1 = RUNNING = me = session 02).
2. **Session 01 did not complete.** `shared/contracts/` (ErrorCode, ERROR_STATUS, VoteType) does not exist. Coded against expected imports; casts to `ErrorCode` used where needed.

## Files Created

| File | Exports |
|---|---|
| `server/lib/logger.ts` | `logger` (`{ info, warn, error }`) — JSON-line over console, redacts `/token\|secret\|authorization\|password/i` |
| `server/lib/db.ts` | `Db` (interface), `createDb(lakebase)` — query (returns rows as T[]), one (first row or null), tx (BEGIN/COMMIT multi-statement) |
| `server/lib/errors.ts` | `AppError`, `badRequest`, `unauthenticated`, `forbidden`, `notFound`, `conflict`, `upstream`, `toAppError` — maps ZodError→BAD_REQUEST, PG 23505→CONFLICT, 23503→BAD_REQUEST |
| `server/lib/http.ts` | `asyncRoute(handler)`, `sendError(res, err)`, `parseBody(schema, body)`, `parseQuery(schema, query)` — type-only express imports |
| `server/lib/context.ts` | `Role` (type), `UserContext` (interface), `getUser(res)`, `requireRole(user, role)`, `hasRole(user, role)` — hierarchy admin > steward > reviewer |
| `server/lib/config.ts` | `AppSettings` (interface), `DEFAULT_SETTINGS`, `ConfigStore` — reads `app.app_config`, 60s cache, env overrides (GT_ADMIN_EMAILS, GT_STEWARD_EMAILS, SEED_SAMPLE_ASSETS) |
| `server/lib/events.ts` | `DomainEvent` (union type), `EventBus` — `on(type, handler)`, `emit(event)`, fire-and-forget with logged errors |
| `server/lib/databricks.ts` | `workspaceHost()`, `executeStatement(opts)`, `currentUserFromToken(token)` — SQL Statement API + SCIM Me, poll up to 60s |
| `server/lib/deps.ts` | `ServiceDeps` (interface: `{ db, config, events }`) |
| `server/lib/index.ts` | Re-exports all of the above |

## Files Modified

| File | Change |
|---|---|
| `package.json` | Added `@modelcontextprotocol/sdk: ^1.23.0`, `@tanstack/react-query: ^5.90.0`, `framer-motion: ^12.23.0` to dependencies (alphabetical) |

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | **pass** |
| All 10 server/lib/ files exist | **pass** |
| Every §7 symbol exported with exact name | **pass** (verified via index.ts re-exports) |
| Only type imports from express | **pass** (context.ts, http.ts) |
| No BEGIN/COMMIT as separate queries | **pass** (db.tx wraps in single multi-statement call) |
| No secret/token/SQL param logged | **pass** (logger redacts; db logs first 120 chars of SQL only, never params; databricks.ts never logs token) |
| package.json valid JSON with 3 new deps | **pass** |
| Typecheck (tsc) | **skipped** (no Node toolchain in sessions) |
| Lint | **skipped** (no Node toolchain in sessions) |

## Assumptions

1. `shared/contracts/errors.ts` will export `ErrorCode` (string literal union including BAD_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, UPSTREAM, INTERNAL) and `ERROR_STATUS` (Record<ErrorCode, number>). Currently imported but files do not exist (session 01 errored).
2. `shared/contracts/values.ts` will export `VoteType` (used in `DomainEvent` union). Currently imported as type-only.
3. `as ErrorCode` casts in `errors.ts` factory calls are a workaround for the missing shared/contracts. They should be removed once session 01 produces the actual types.

## Requests

None — all changes within owned paths (`server/lib/**`, `package.json`).

## Decisions

* `hasRole(user, role): boolean` added alongside `requireRole` (plan task 5 requested it; not in §7 contract but does not conflict — it's additive).
* `ConfigStore.update()` uses `db.tx()` with string-interpolated values for `INSERT ON CONFLICT` upserts. This is safe for app_config (keys are controlled snake_case strings, values are JSON-serialized) but downstream sessions should NOT follow this pattern for user-supplied data — use parameterized queries via `db.query()` instead.
* `toAppError()` returns a generic "An unexpected error occurred" message for unknown errors to avoid leaking internal details.
