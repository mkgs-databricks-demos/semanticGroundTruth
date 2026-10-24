# Session 04: Auth + Middleware (Phase D)

## Scope
Create `server/middleware/` — identity extraction, role resolution, OpenTelemetry span enrichment and request logging — plus `registerMiddleware(app, deps)` that session 09 calls first inside `appkit.server.extend`. Error handling is done per-route by `asyncRoute`/`sendError` (session 02), not by an Express error middleware.

## Context
* `build_conventions.md` §4 (headers, local-dev fallback, MCP identity) and §7 (`UserContext`, `getUser`, `ConfigStore`).
* `../docs/design/L300-10_backend_implementation.md` Step 6; `L100_semantic_ground_truth_app.md` § auth (hybrid OBO + SP).
* AppKit already initialises OpenTelemetry (spans exported to `semantic_ground_truth_otel_spans`). Use `@opentelemetry/api` **only if** it is resolvable: it is NOT a direct dependency, so do **not** import it. Instead, implement span attributes by writing the attributes into `res.locals.otelAttributes` and a structured request log line; record an assumption that richer span attributes need `@opentelemetry/api` added later.

## Tasks
1. `server/middleware/identity.ts` — `identityMiddleware(config: ConfigStore): RequestHandler`:
   * Read `x-forwarded-user`, `x-forwarded-email`, `x-forwarded-preferred-username`, `x-forwarded-access-token`.
   * `source = req.path.startsWith('/mcp') ? 'mcp' : 'web'`.
   * No headers and `NODE_ENV === 'development'` -> dev identity from `DEV_USER_EMAIL` (default `local-dev@example.com`), roles `['reviewer','steward','admin']`.
   * No headers in production on `/api/*` -> 401 `UNAUTHENTICATED` via `sendError`. `/health` is exempt.
   * Roles: `resolveRoles(email, settings)` from `roles.ts`.
   * Set `res.locals.user: UserContext`. Never log the token.
2. `server/middleware/roles.ts` — `resolveRoles(email: string, settings: AppSettings): Role[]` (always `reviewer`; `steward` if in `stewardEmails`; `admin` (+ `steward`) if in `adminEmails`; case-insensitive) and `requireRoleMiddleware(role: Role): RequestHandler`.
3. `server/middleware/requestLog.ts` — `requestLogMiddleware(): RequestHandler` logging `{ method, path, status, durationMs, requestId, userId, source }` on `res.on('finish')`; attaches `res.locals.requestId` from `x-request-id` (or a `crypto.randomUUID()`).
4. `server/middleware/otel.ts` — `otelAttributesMiddleware(): RequestHandler` that initialises `res.locals.otelAttributes = { 'gt.user_id', 'gt.source', 'http.route' }` and exports `addSpanAttributes(res, attrs: Record<string, string | number | boolean>)` for routes to add `gt.asset_id`, `gt.campaign_id`. Included in the request log line.
5. `server/middleware/index.ts` — `registerMiddleware(app: Application, deps: { config: ConfigStore }): void` applying, in order: requestLog -> otel -> identity (scoped to `/api` and `/mcp` via `app.use('/api', ...)`, `app.use('/mcp', ...)`). Re-export all middleware.
6. Add a `res.locals` type augmentation in `server/middleware/locals.d.ts`: `declare global { namespace Express { interface Locals { user?: UserContext; requestId?: string; otelAttributes?: Record<string, string | number | boolean>; } } } export {};` (server-only file; `namespace` is allowed here because server tsconfig does not set `erasableSyntaxOnly`).

## Acceptance Criteria
- [ ] `registerMiddleware`, `identityMiddleware`, `resolveRoles`, `requireRoleMiddleware`, `requestLogMiddleware`, `otelAttributesMiddleware`, `addSpanAttributes` exported from `server/middleware/index.ts`.
- [ ] No runtime import from `express` or `@opentelemetry/*`.
- [ ] Access token is never logged or placed in `otelAttributes`.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/middleware/**`

## Dependencies
- Session 02: `server/lib/context.ts`, `config.ts`, `http.ts`, `logger.ts`.
- Session 01: `Role` type.
