# Session 09: REST Routes + Composition Root (Phase G)

## Scope
Build the HTTP surface and wire the whole server: `server/services/index.ts` (`createServices`), all `/api/*` routes, `GET /health`, a stub `server/mcp/index.ts`, and the new `server/server.ts` startup sequence. Remove the sample todo routes. This is the **only** session that edits `server/server.ts`.

## Context
* `build_conventions.md` §3 (AppKit `server.extend`), §4, §7 (all service signatures). Session summaries of 02-08 in `docs/sessions/` list the actual exported symbols — read them and code against what exists.
* `../docs/design/L200-C2_review_engine.md` § REST API.
* Current `server/server.ts` registers `setupSampleLakebaseRoutes` from `server/routes/lakebase/todo-routes.ts`.

## Route table (contract for session 10's client)

| Method + path | Role | Request DTO | Response DTO | Service call |
|---|---|---|---|---|
| `GET /health` | none | — | `HealthResponse` | `SELECT 1` + `_migrations` count |
| `GET /api/me` | reviewer | — | `MeResponse` | context |
| `GET /api/review/next` | reviewer | `GetNextQuery` (query) | `ReviewCard \| null` | `review.getNext` |
| `POST /api/review/vote` | reviewer | `VoteBody` | `VoteResult` | `review.submitVote` |
| `POST /api/review/synonym` | reviewer (`remove` = steward) | `SynonymBody` | `AssetSynonym[]` | `assets.addSynonym/voteSynonym/removeSynonym` |
| `POST /api/review/example` | reviewer | `ExampleBody` | `ExampleQuestion[]` | `assets.addExample/voteExample` |
| `POST /api/review/run-query` | reviewer | `RunQueryBody` | `QueryResult` | `review.runQuery` |
| `GET /api/review/stats/me` | reviewer | — | `UserStats` | `review.getUserStats` |
| `GET /api/leaderboard` | reviewer | `LeaderboardQuery` | `LeaderboardEntry[]` | `review.getLeaderboard` |
| `GET /api/assets` | reviewer | `ReviewableQuery` | `Paged<Asset>` | `assets.list` |
| `GET /api/assets/:assetId` | reviewer | — | `Asset` | `assets.get` |
| `GET /api/assets/:assetId/versions` | reviewer | — | `AssetVersion[]` | `assets.listVersions` |
| `POST /api/assets/register` | steward | `RegisterAssetBody` | `RegisterAssetResult` | `assets.register` |
| `GET /api/campaigns` | reviewer | `CampaignListQuery` | `Campaign[]` | `campaigns.list` |
| `POST /api/campaigns` | steward | `CreateCampaignBody` | `Campaign` | `campaigns.create` |
| `GET /api/campaigns/:campaignId` | reviewer | — | `Campaign` | `campaigns.get` |
| `PATCH /api/campaigns/:campaignId/status` | steward | `UpdateCampaignStatusBody` | `Campaign` | `campaigns.updateStatus` |
| `POST /api/campaigns/freshness-check` | admin | — | `FreshnessCheckResult` | `campaigns.runFreshnessCheck` |
| `GET /api/notifications` | reviewer | `NotificationListQuery` | `Notification[]` | `notifications.list` |
| `GET /api/notifications/unread-count` | reviewer | — | `UnreadCountResponse` | `notifications.unreadCount` |
| `POST /api/notifications/read` | reviewer | `MarkReadBody` | `{ updated: number }` | `notifications.markRead` |
| `GET /api/notifications/preferences` | reviewer | — | `NotificationPreference[]` | `notifications.getPreferences` |
| `PUT /api/notifications/preferences` | reviewer | `UpdatePreferencesBody` | `NotificationPreference[]` | `notifications.updatePreferences` |
| `GET /api/admin/config` | admin | — | `AppSettingsDto` | `config.get` |
| `PUT /api/admin/config` | admin | `UpdateConfigBody` | `AppSettingsDto` | `config.update` |
| `GET /api/admin/summary` | steward | — | `ExecutiveSummary` | `review.getExecutiveSummary` |
| `POST /api/admin/recompute/:assetId` | admin | — | `ConfidenceScore` | `review.recompute` |
| `GET /api/metric-views` | reviewer | `MetricViewListQuery` | `MetricViewSummary[]` | `metricViews.list` |
| `GET /api/metric-views/:fullName` | reviewer | — | `MetricViewDetail` | `metricViews.get` |
| `POST /api/metric-views/:fullName/validate` | reviewer | — | `ValidateResult` | `metricViews.validate` |

All handlers: `asyncRoute`, `parseBody`/`parseQuery` with the session 01 zod schemas, `getUser(res)`, `requireRole`, `addSpanAttributes` for asset/campaign ids. Responses are JSON DTOs with no wrapper (errors use `ErrorResponse`).

## Tasks
1. `server/services/index.ts` — `interface Services { assets; metricViews; review; campaigns; notifications; config: ConfigStore; db: Db; events: EventBus }` and `createServices(deps: ServiceDeps): Services` (instantiate in dependency order; call `campaigns.subscribe()` and `notifications.subscribe()`). Also store the instance in a module-level singleton and export `getServices(): Services` (throws `Error('Services not initialised')` before `createServices` runs) — session 14's auto-discovered agent tools use it.
2. `server/routes/health.ts`, `me.ts`, `review.ts`, `leaderboard.ts`, `assets.ts`, `campaigns.ts`, `notifications.ts`, `admin.ts`, `metricViews.ts` — each exports `registerXxxRoutes(app: Application, services: Services): void`.
3. `server/routes/index.ts` — `registerRoutes(app, services)` calling all of the above.
4. `server/mcp/index.ts` — **stub** `export function mountMcp(app: Application, services: Services): void` that registers `POST /mcp` returning 503 `{ error: { code: 'UPSTREAM_ERROR', message: 'MCP not yet implemented' } }`. Session 11 replaces this file.
5. Delete `server/routes/lakebase/todo-routes.ts` (and the empty `server/routes/lakebase/` folder).
6. Rewrite `server/server.ts` (keep the five plugins and the `createApp` shape):
   * `onPluginsReady(appkit)`: `const db = createDb(appkit.lakebase)`; `await runMigrations(db)`; `const config = new ConfigStore(db)`; `const events = new EventBus()`; `const services = createServices({ db, config, events })`; `await seedSampleAssets(services.assets, db, await config.get())`.
   * `appkit.server.extend((app) => { registerMiddleware(app, { config }); registerRoutes(app, services); mountMcp(app, services); })`.
   * Background timers (`setInterval(...).unref()`): `campaigns.runFreshnessCheck()` every 24 h, `notifications.flushDigests()` every 1 h; errors logged.
   * Keep the existing `.catch(console.error)`.

## Acceptance Criteria
- [ ] Every row of the route table is implemented with the listed role check and schema.
- [ ] `server/server.ts` imports resolve to files that exist after waves 0-2 plus this session (the `server/mcp/index.ts` stub included).
- [ ] No reference to `todo-routes` or `setupSampleLakebaseRoutes` remains in `server/`.
- [ ] `GET /health` is exempt from identity middleware and returns `HealthResponse`.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `server/routes/**`
- `server/server.ts`
- `server/services/index.ts`
- `server/mcp/index.ts`

## Dependencies
- All of waves 0-2 (sessions 01-08).
