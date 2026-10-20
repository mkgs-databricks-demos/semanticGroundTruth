# Build Conventions — ground-truth-app (Genie Build Waves)

Read this before every session. It is the shared contract for all sessions in `docs/plans/waves.json`.
If this file and a plan file disagree, this file wins (except where the manifest `scope` says otherwise).

**Build root:** `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth/ground-truth-app`
**Repo root:** `/Workspace/Users/matthew.giglia@databricks.com/semanticGroundTruth`
**Branch:** `mg-genie-app-build-waves`
**Design docs:** `../docs/design/` (relative to build root). L200-C1..C9 and L300-09..13 are the source designs.

---

## 1. Build model (read carefully)

* **No Node toolchain in sessions.** There is no `node`, `pnpm`, `tsc`, `eslint` or `vitest` available in Genie Code serverless. Do **not** try to install or run them. Do not run `bundle deploy`.
* Type safety is verified later by the controller session, when the app is deployed to Databricks Apps compute (the Apps build runs `pnpm install` + `pnpm run build`, which runs `tsc -b`).
* Because nothing compiles during the build, **write code as if a strict compiler will read it tomorrow**. Every import must resolve, every exported name in a plan's "Exports" section must exist with that exact name and signature.
* The only checks a session can run: `databricks bundle validate --strict --target dev` (from build root), reading files, and static reasoning. Record unrun checks as `skipped`, never `pass`.

## 2. TypeScript rules (from `tsconfig.shared.json`, `tsconfig.server.json`, `tsconfig.client.json`)

* `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` are ON. Prefix intentionally unused params with `_`.
* Server: `moduleResolution: bundler`, ES2020 target. Import relative modules **without** file extensions (`import { x } from '../lib/db'`), matching the scaffold.
* Client: `verbatimModuleSyntax` + `erasableSyntaxOnly` are ON. Therefore, in `client/**` **and** `shared/**` (the client compiles shared files):
  * Use `import type { ... }` for type-only imports.
  * **No `enum`, no `namespace`, no constructor parameter properties.** Use string-literal unions and `as const` objects.
* Client path alias `@/*` -> `client/src/*`. Client imports shared contracts by relative path, e.g. `import type { Asset } from '../../../shared/contracts'` (adjust depth). Session 01 adds `shared/contracts` to `tsconfig.client.json` `include`.
* `express` is **not** a direct dependency (it comes through AppKit). Only ever `import type { Application, Request, Response, NextFunction, RequestHandler } from 'express'`. Never import runtime values from `express` (no `express.Router()`, no `express.json()`). AppKit's server already parses JSON bodies (the scaffold todo routes read `req.body`).
* `zod` v4 (`zod@4.3.6`) is available on both sides. Import as `import { z } from 'zod'`.
* Prefer named exports. No default exports except where AppKit requires them (agent files: `export default createAgent(...)`).
* Formatting: 2-space indent, single quotes, semicolons, trailing commas (see `.prettierrc.json`).

## 3. AppKit patterns (verified against the scaffold)

* Entry point `server/server.ts` uses `createApp({ plugins: [agents(), analytics(), jobs(), lakebase(), server()], async onPluginsReady(appkit) { ... } })`. Keep all five plugins.
* Lakebase: `appkit.lakebase.query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>`. Postgres placeholders `$1, $2...`. This is a pooled client: **do not** issue `BEGIN`/`COMMIT` as separate calls. Use the `Db.tx(sqlScript)` helper (one multi-statement, parameter-less string) for migrations, and single-statement CTEs (`WITH ... INSERT ... RETURNING`) for atomic writes in services.
* HTTP: `appkit.server.extend((app: Application) => { app.get(...); app.post(...); app.use(...) })`. All app routes live under `/api/*` (plus `/health` and `/mcp`).
* Agents: files under `server/agents/<id>/agent.md` (markdown, frontmatter `default`, `agents`, `skills`) or `server/agents/<id>/agent.ts` (`export default createAgent({ instructions, tools })` with `tool({ description, schema, annotations, execute })` from `@databricks/appkit/beta`). Auto-discovered; no registration code needed.
* Client: `@databricks/appkit-ui/react` components (`Card`, `Button`, `Badge`, `Input`, `Textarea`, `Select*`, `Skeleton`, `Sheet*`, `Tabs*`, `Progress`, `Table*`, `useIsMobile`, `useAnalyticsQuery`). `react-router` v7 `createBrowserRouter`. `lucide-react` icons. Tailwind 4 utility classes. Light/dark via `next-themes` (already installed).

## 4. Identity and auth (Databricks Apps headers)

The Apps reverse proxy forwards: `x-forwarded-user`, `x-forwarded-email`, `x-forwarded-preferred-username`, `x-forwarded-access-token` (OBO user token, scopes `sql genie files model-serving`), `x-request-id`.

* `server/middleware/identity.ts` (session 04) reads them into `res.locals.user: UserContext` (type in `server/lib/context.ts`, session 02).
* **Never log or return `x-forwarded-access-token`.**
* Local dev (`NODE_ENV=development`, no headers): fall back to `process.env.DEV_USER_EMAIL ?? 'local-dev@example.com'`.
* Requests arriving via `/mcp` come through Unity Gateway with the **M2M service principal** token; set `source: 'mcp'`. Use forwarded identity headers if present; otherwise attribute to the forwarded SPN identity. (Decision 4 — verify after deploy.)
* OBO SQL (metric view reads, `run-query`): use `server/lib/databricks.ts` `executeStatement()` (session 02), which calls `POST {host}/api/2.0/sql/statements` with the user's token and `process.env.DATABRICKS_WAREHOUSE_ID`. Host from `process.env.DATABRICKS_HOST` (prepend `https://` if missing).

## 5. Data contract decisions (approved 2026-10-20)

1. **Schema source of truth = L200-C1**, Postgres schema `app`, plus these additions:
   * `assets.display_name TEXT`, `assets.status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','CERTIFIED'))`, `assets.domain TEXT`, `assets.subdomain TEXT`.
   * `votes.source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','mcp','agent'))`.
   * Infra metric-view column drift (`votes.reviewer_id/comment`, `feedback_batches.asset_count/processing_time_seconds/SUCCESS`) is an **infra follow-up**, not fixed in this build. Do not rename app columns to match it.
2. **Campaigns = L200-C5** (`campaign_type IN ('automatic','manual','freshness')`, `scope_domain`, `scope_subdomain`, `scope_asset_type`, `scope_asset_ids UUID[]`, `freshness_interval_days` default 180, `campaign_assignments`), plus `campaign_assets (campaign_id, asset_id, status IN ('pending','reviewed','skipped'), PK both)` and `campaigns.completion_rule TEXT NOT NULL DEFAULT 'reviewed_once' CHECK (completion_rule IN ('reviewed_once','certified'))`.
3. **MCP tool names** must match the MCP service selectors `review_*`, `campaign_*`, `metric_view_*` (see `resources/ground_truth_mcp.mcp_service.yml`). Do **not** use the L200-C4 names (`get_next_review_card` etc.).
4. **MCP identity:** see section 4.
5. **Notifications:** in-app channel live. Slack/Teams/webhook destinations implemented but inactive unless `SLACK_WEBHOOK_URL` / `TEAMS_WEBHOOK_URL` / `GENERIC_WEBHOOK_URL` env vars are set. **No changes to `app.yaml` or `resources/*.yml` for secrets in this build.**
6. **New tables:** `app.app_config (key TEXT PK, value JSONB NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ)`, `app.mcp_sessions`, `app.user_activity`, `app.notification_preferences`.
7. **Defaults:** custom migration runner (no new dep), Wilson z = 1.96 stored in `app_config`, weighted-random surfacing with staleness bias, `@modelcontextprotocol/sdk` (stateless Streamable HTTP), React Query only (no Zustand), framer-motion drag for card swipe, keep planner (markdown) + worker (code) agents.

## 6. Directory map and owners (ownership is enforced per wave)

| Path | Owner session | Purpose |
|---|---|---|
| `shared/contracts/**` | 01 | Domain entities, API DTOs + zod schemas, MCP tool input schemas, error codes |
| `tsconfig.client.json` | 01 | Add `shared/contracts` to include |
| `server/lib/**` | 02 | Db, errors, http helpers, config store, context, events, databricks REST, logger |
| `package.json` | 02 | Add deps (lockfile regenerated by controller later) |
| `server/migrations/**` | 03 | Runner + SQL migrations |
| `server/middleware/**` | 04 | identity, roles, otel, request logging |
| `server/services/asset/**`, `server/services/metricView/**`, `server/seed/**` | 05 | Asset registry, metric view reader, dev seed |
| `server/services/review/**` | 06 | Wilson, surfacing, Review Engine (+ tests) |
| `server/services/campaign/**` | 07 | Campaign Manager |
| `server/services/notification/**` | 08 | Notification Service + destinations |
| `server/routes/**`, `server/server.ts`, `server/services/index.ts`, `server/mcp/index.ts` (stub only) | 09 | HTTP surface + composition root |
| `client/src/lib/api/**` | 10 | Typed fetch client + React Query hooks |
| `server/mcp/**` | 11 | MCP server (replaces 09's stub) |
| `client/src/App.tsx`, `client/src/main.tsx`, `client/src/components/layout/**`, `client/src/components/review/**`, `client/src/pages/review/**` | 12 | Shell + card-swipe review UX |
| `client/src/components/{leaderboard,admin,steward,executive}/**`, `client/src/pages/{leaderboard,admin,steward,executive}/**` | 13 | Secondary pages |
| `server/agents/**` | 14 | Ground-truth agents |
| tests + sample cleanup (see plan 15) | 15 | Wave 5 |
| `README.md`, `docs/runbooks/**` | 16 | Wave 5 |

Anything outside your owned paths goes into `requests` in your status file. Never edit `PROJECT_MEMORY.md`, `docs/plans/**`, `app.yaml`, `appkit.plugins.json`, `databricks.yml`, `resources/**`, `pnpm-lock.yaml`.

## 7. Cross-module contracts (signatures every session codes against)

```ts
// server/lib/db.ts (02)
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
  tx(script: string): Promise<void>; // multi-statement, no params, wrapped in BEGIN/COMMIT
}
export function createDb(lakebase: { query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }): Db;

// server/lib/errors.ts (02) — codes come from shared/contracts/errors.ts (01)
export class AppError extends Error { code: ErrorCode; status: number; details?: Record<string, unknown>; }
export const notFound, badRequest, forbidden, conflict: (message: string, details?) => AppError;

// server/lib/http.ts (02)
export function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler; // catches -> sendError
export function sendError(res: Response, err: unknown): void; // { error: { code, message, details } }
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S>; // throws badRequest
export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: unknown): z.infer<S>;

// server/lib/context.ts (02)
export type Role = 'reviewer' | 'steward' | 'admin';
export interface UserContext { userId: string; email: string; displayName: string; accessToken?: string; source: 'web' | 'mcp' | 'agent'; roles: Role[]; }
export function getUser(res: Response): UserContext; // throws AppError UNAUTHENTICATED if missing
export function requireRole(user: UserContext, role: Role): void; // throws forbidden

// server/lib/config.ts (02)
export interface AppSettings { wilsonZ: number; industryPrior: number; priorWeight: number; priorDecayThreshold: number; certificationThreshold: number; minVotesForCertification: number; stalenessDays: number; freshnessIntervalDays: number; adminEmails: string[]; stewardEmails: string[]; seedSampleAssets: boolean; }
export const DEFAULT_SETTINGS: AppSettings;
export class ConfigStore { constructor(db: Db); get(): Promise<AppSettings>; update(patch: Partial<AppSettings>, updatedBy: string): Promise<AppSettings>; } // reads app.app_config, 60s cache

// server/lib/events.ts (02)
export type DomainEvent =
  | { type: 'vote.recorded'; assetId: string; userId: string; voteType: VoteType; campaignIds: string[] }
  | { type: 'vote.milestone'; userId: string; badge: string }
  | { type: 'asset.certified'; assetId: string }
  | { type: 'asset.registered'; assetId: string; isNewVersion: boolean }
  | { type: 'campaign.created'; campaignId: string }
  | { type: 'campaign.completed'; campaignId: string };
export class EventBus { on(type, handler): void; emit(event: DomainEvent): void; } // handlers async, errors logged not thrown

// server/lib/databricks.ts (02)
export async function executeStatement(opts: { token: string; statement: string; parameters?: { name: string; value: string; type?: string }[]; rowLimit?: number }): Promise<{ columns: string[]; rows: unknown[][] }>;

// server/lib/logger.ts (02)
export const logger: { info(msg: string, meta?: object): void; warn(...): void; error(...): void };

// server/lib/deps.ts (02)
export interface ServiceDeps { db: Db; config: ConfigStore; events: EventBus; }
```

Service classes (constructor always `(deps: ServiceDeps)` unless stated):

* `AssetRegistry` (05, `server/services/asset/assetRegistry.ts`)
* `MetricViewService` (05, `server/services/metricView/metricViewService.ts`) — constructor `()`; methods take `user: UserContext`
* `ReviewEngine` (06, `server/services/review/reviewEngine.ts`) — constructor `(deps: ServiceDeps, assets: AssetRegistry, metricViews: MetricViewService)`
* `CampaignManager` (07, `server/services/campaign/campaignManager.ts`)
* `NotificationService` (08, `server/services/notification/notificationService.ts`)
* `createServices(deps): Services` (09, `server/services/index.ts`) returns `{ assets, metricViews, review, campaigns, notifications }`.
* `mountMcp(app: Application, services: Services): void` (11, `server/mcp/index.ts`).

## 8. Session hygiene

* Write your summary to `docs/sessions/<YYYY-MM-DD>_w<wave>-<id>-<slug>.md` using `datetime.now()`.
* In your summary, list every exported symbol you created with its signature — downstream sessions read it.
* If you must deviate from a contract above, implement the contract anyway and add the extra API alongside it; record the deviation under `assumptions`.
