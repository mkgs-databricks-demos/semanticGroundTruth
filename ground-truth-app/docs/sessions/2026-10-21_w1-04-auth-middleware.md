# Session 04: Auth + Middleware

**Wave:** 1 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `server/middleware/` with 6 files implementing identity extraction from Databricks Apps forwarded headers, role resolution, request logging, OpenTelemetry attribute collection, Express locals typing, and a `registerMiddleware` composition function. No runtime imports from `express` or `@opentelemetry/*`. Access token is never logged or placed in otelAttributes.

## Files Created

| File | Exports |
|---|---|
| `server/middleware/locals.d.ts` | Global augmentation: `Express.Locals.user`, `.requestId`, `.otelAttributes` |
| `server/middleware/roles.ts` | `resolveRoles(email, settings): Role[]`, `requireRoleMiddleware(role): RequestHandler` |
| `server/middleware/identity.ts` | `identityMiddleware(config): RequestHandler` |
| `server/middleware/requestLog.ts` | `requestLogMiddleware(): RequestHandler` |
| `server/middleware/otel.ts` | `otelAttributesMiddleware(): RequestHandler`, `addSpanAttributes(res, attrs)` |
| `server/middleware/index.ts` | `registerMiddleware(app, deps)` + re-exports all above |

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| All 7 symbols exported from index.ts | pass |
| No runtime import from express | pass |
| No import from @opentelemetry/* | pass |
| Access token never logged or in otelAttributes | pass |
| TypeScript compilation | skipped (no Node toolchain) |

## Assumptions

* `@opentelemetry/api` is NOT a direct dependency. Span attributes are written to `res.locals.otelAttributes` and included in the structured request log. Richer OTel span attributes require adding `@opentelemetry/api` later.
* `namespace` keyword in `locals.d.ts` is acceptable — server tsconfig does not set `erasableSyntaxOnly` (per conventions §2).
* Identity middleware is scoped to `/api` and `/mcp` via `app.use('/api', identity)` and `app.use('/mcp', identity)`. `/health` is exempt (not under `/api`).

## Requests

None.
