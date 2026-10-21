# Session 09: REST Routes + Composition Root

**Wave:** 3 · **Run:** 16400513324108 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Implemented the full HTTP surface and composition root for the ground-truth app. Created `server/services/index.ts` (composition root with `createServices` and `getServices` singleton), `server/mcp/index.ts` (503 stub for session 11 to replace), 9 route modules covering all 30 route table rows, a barrel `server/routes/index.ts`, and rewrote `server/server.ts` with the full startup sequence (migrations → services → seed → middleware → routes → MCP → timers). Deleted the sample `server/routes/lakebase/todo-routes.ts` and its empty parent folder.

## Files Created

| File | Exports |
|---|---|
| `server/services/index.ts` | `Services` (interface), `createServices(deps: ServiceDeps): Services`, `getServices(): Services` |
| `server/mcp/index.ts` | `mountMcp(app: Application, services: Services): void` (POST /mcp → 503 stub) |
| `server/routes/health.ts` | `registerHealthRoutes(app, services)` — GET /health |
| `server/routes/me.ts` | `registerMeRoutes(app, services)` — GET /api/me |
| `server/routes/review.ts` | `registerReviewRoutes(app, services)` — GET /api/review/next, POST vote/synonym/example/run-query, GET stats/me |
| `server/routes/leaderboard.ts` | `registerLeaderboardRoutes(app, services)` — GET /api/leaderboard |
| `server/routes/assets.ts` | `registerAssetRoutes(app, services)` — GET /api/assets, GET :assetId, GET :assetId/versions, POST register |
| `server/routes/campaigns.ts` | `registerCampaignRoutes(app, services)` — GET/POST /api/campaigns, GET :campaignId, PATCH :campaignId/status, POST freshness-check |
| `server/routes/notifications.ts` | `registerNotificationRoutes(app, services)` — GET /api/notifications, GET unread-count, POST read, GET/PUT preferences |
| `server/routes/admin.ts` | `registerAdminRoutes(app, services)` — GET/PUT config, GET summary, POST recompute/:assetId |
| `server/routes/metricViews.ts` | `registerMetricViewRoutes(app, services)` — GET /api/metric-views, GET :fullName, POST :fullName/validate |
| `server/routes/index.ts` | `registerRoutes(app, services)` — calls all 9 register functions above |

## Files Modified

| File | Changes |
|---|---|
| `server/server.ts` | Full rewrite: removed setupSampleLakebaseRoutes import; added imports for createDb, ConfigStore, EventBus, logger, runMigrations, createServices, seedSampleAssets, registerMiddleware, registerRoutes, mountMcp; onPluginsReady now runs full startup sequence with background timers |

## Files Deleted

| File | Reason |
|---|---|
| `server/routes/lakebase/todo-routes.ts` | Sample scaffold code replaced by real routes |
| `server/routes/lakebase/` (directory) | Empty after file deletion |

## Route Table Coverage (30/30)

All 30 rows from the plan 09 route table are implemented with:
- `asyncRoute` error boundary on every handler
- `parseBody`/`parseQuery` with session 01 zod schemas for input validation
- `getUser(res)` + `requireRole(user, role)` per the role column
- `addSpanAttributes(res, { assetId/campaignId })` for tracing where applicable
- `/health` is exempt from identity middleware (lives outside `/api` and `/mcp`)

## Composition Root Pattern

`createServices` instantiates in dependency order:
1. `AssetRegistry(deps)` — no service deps
2. `MetricViewService()` — no deps
3. `ReviewEngine(deps, assets, metricViews)` — depends on assets + metricViews
4. `CampaignManager(deps)` — no service deps
5. `NotificationService(deps)` — no service deps

Then calls `campaigns.subscribe()` and `notifications.subscribe()` to wire event handlers.

Module-level singleton stored via `getServices()` for session 14's agent tools.

## server.ts Startup Sequence

1. `createDb(appkit.lakebase)` → `runMigrations(db)`
2. `new ConfigStore(db)` + `new EventBus()`
3. `createServices({ db, config, events })` (subscribes campaigns + notifications)
4. `seedSampleAssets(services.assets, db, settings)`
5. `appkit.server.extend` → `registerMiddleware` → `registerRoutes` → `mountMcp`
6. `setInterval(...).unref()`: freshness check (24h), digest flush (1h)

## Checks

| Check | Result |
|---|---|
| `databricks bundle validate --strict --target dev` | pass |
| All 30 route table rows implemented | pass (regex-verified) |
| No reference to `todo-routes` or `setupSampleLakebaseRoutes` in server/ | pass (grep) |
| All relative imports in 13 session files resolve to existing files | pass (script) |
| server.ts calls runMigrations, createServices, registerMiddleware, registerRoutes, mountMcp | pass |
| GET /health registered in health.ts | pass |
| server/mcp/index.ts exports mountMcp | pass |
| server/services/index.ts exports createServices and getServices | pass |
| TypeScript compilation | skipped (no Node toolchain) |

## Decisions

* **Health check implementation**: queries `SELECT 1` for DB liveness and counts `app._migrations` rows. Returns `HealthResponse` with `status: 'ok' | 'degraded'`, `db: boolean`, `migrations: number`, `version` from `APP_VERSION` env var.
* **Synonym/example dispatch**: review routes use switch statements to dispatch to the correct AssetRegistry method based on `body.action`. The `remove` action on synonyms requires `steward` role per the route table.
* **MetricViewService user context**: `list`, `get`, and `validate` receive the full `UserContext` (not just the token) since MetricViewService uses the OBO token for SQL Statement API calls.
* **Background timer interval constants**: `ONE_HOUR_MS` and `ONE_DAY_MS` as module-level constants for readability.
* **Notification list/count roles**: passes `user.roles` to `notifications.list` and `unreadCount` so role-addressed notifications are visible to role holders (per session 08's design).

## Assumptions

* Session 04's `registerMiddleware(app, { config })` accepts `{ config: ConfigStore }` as the deps argument. The exact type is not documented in session 04's summary but the middleware index.ts exports `registerMiddleware(app, deps)` and the plan specifies `registerMiddleware(app, { config })`.
* Session 05's `AssetRegistry.register(body, userId)` returns `RegisterAssetResult` with `{ asset, created, newVersion }`. The `created` flag controls 201 vs 200 status.
* Session 06's `ReviewEngine.getNext(user, query)` accepts `UserContext` as first arg for user-scoped surfacing.
* Session 07's `CampaignManager.list(user, opts)` accepts `UserContext` for RBAC visibility filtering.
* Session 05's `MetricViewService` methods take `user: UserContext` as first arg per build_conventions §7.
* Session 05's `AssetRegistry.list(query)` accepts the `ReviewableQuery` shape and returns `Paged<Asset>`.

## Requests

None.
