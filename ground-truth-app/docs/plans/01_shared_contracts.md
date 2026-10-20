# Session 01: Shared Domain Contracts

## Scope
Create `shared/contracts/` — the single source of domain types, API request/response DTOs (with zod schemas), MCP tool input schemas and error codes, shared by server and client. Add `shared/contracts` to `tsconfig.client.json` `include`. Types and schemas only: no runtime logic beyond zod schema definitions and `as const` value lists.

## Context
* Read `docs/plans/build_conventions.md` sections 2, 5 and 7 first. `shared/**` is compiled by the client config: **no enums, no namespaces, `import type` for type-only imports.**
* Schema sources: `../docs/design/L200-C1_asset_registry.md` (tables), `L200-C5_campaign_manager.md`, `L200-C7_notification_service.md`, `L200-C2_review_engine.md` (REST API), `L200-C4_mcp_server.md` (tool params only — names come from conventions §5.3).
* Column names are snake_case in Postgres; TypeScript DTOs are **camelCase**. Services map rows to DTOs.

## Tasks
1. `shared/contracts/values.ts` — `as const` arrays + derived unions:
   * `ASSET_TYPES = ['measure','dimension','page','domain','subdomain']` -> `AssetType`
   * `ASSET_STATUSES = ['PENDING','REVIEWED','CERTIFIED']` -> `AssetStatus`
   * `ENVIRONMENTS = ['dev','staging','production']` -> `Environment`
   * `VOTE_TYPES = ['approve','reject','edit']` -> `VoteType`; `VOTE_SOURCES = ['web','mcp','agent']` -> `VoteSource`
   * `CAMPAIGN_TYPES = ['automatic','manual','freshness']`, `CAMPAIGN_STATUSES = ['active','paused','completed','archived']`, `COMPLETION_RULES = ['reviewed_once','certified']`, `CAMPAIGN_ASSET_STATUSES = ['pending','reviewed','skipped']`
   * `NOTIFICATION_CHANNELS = ['in_app','slack','teams','webhook']`, `NOTIFICATION_STATUSES = ['pending','sent','failed','read']`, `RECIPIENT_TYPES = ['user','group','role']`
   * `NOTIFICATION_EVENT_TYPES = ['asset.certified','campaign.created','campaign.completed','vote.milestone','feedback.branch_ready','feedback.failed']`
   * `ROLES = ['reviewer','steward','admin']` -> `Role`
2. `shared/contracts/entities.ts` — interfaces (camelCase, ISO-string timestamps): `Asset` (all L200-C1 columns + `displayName`, `status`, `domain`, `subdomain`), `AssetVersion`, `AssetSynonym` (+ `approvals`, `rejections` counts), `Vote` (+ `source`), `ExampleQuestion`, `ConfidenceScore`, `FeedbackBatch`, `Campaign` (L200-C5 + `completionRule`, `rbacGroups: string[]`, progress fields `totalAssets`, `reviewedAssets`), `CampaignAsset`, `Notification`, `NotificationPreference` (`userId`, `eventType`, `channels: NotificationChannel[]`, `digest: boolean`), `UserActivity` (`userId`, `email`, `totalVotes`, `currentStreakDays`, `longestStreakDays`, `lastVoteDate`, `badges: string[]`), `LeaderboardEntry`, `UserStats` (`totalVotes`, `approvals`, `rejections`, `edits`, `currentStreakDays`, `rank`, `coveragePct`), `ExecutiveSummary` (`totalAssets`, `reviewedAssets`, `certifiedAssets`, `coveragePct`, `certificationPct`, `activeReviewers7d`, `votes7d`, `activeCampaigns`), `MetricViewSummary` (`fullName`, `comment`, `measureCount`, `dimensionCount`), `MetricViewDetail` (+ `measures`/`dimensions` arrays of `{ name, expr, displayName?, comment?, synonyms?: string[] }`, `yaml?: string`), `QueryResult` (`columns: string[]`, `rows: unknown[][]`, `truncated: boolean`).
3. `shared/contracts/review.ts` — `ReviewCard` (`asset: Asset`, `synonyms`, `examples`, `confidence: ConfidenceScore | null`, `campaign?: { campaignId, name }`, `reason: 'low_confidence' | 'stale' | 'new_version' | 'campaign' | 'random'`, `progress: { reviewed: number; total: number }`).
4. `shared/contracts/api.ts` — zod schemas **and** inferred types for every route in plan 09:
   * `GetNextQuery { campaignId?: uuid; assetType?: AssetType }` -> `ReviewCard | null`
   * `VoteBody { assetId: uuid; voteType: VoteType; feedback?: string (max 4000); edits?: { description?: string; plainEnglishLogic?: string; displayName?: string } }` -> `VoteResult { vote: Vote; confidence: ConfidenceScore; assetStatus: AssetStatus; next?: ReviewCard | null }`
   * `SynonymBody { assetId; action: 'add'|'remove'|'approve'|'reject'; synonym: string(1..200) }` -> `AssetSynonym[]`
   * `ExampleBody { assetId; action: 'add'|'approve'|'reject'; questionText?: string; questionId?: uuid }` (refine: add needs questionText, approve/reject need questionId) -> `ExampleQuestion[]`
   * `RunQueryBody { assetId: uuid }` -> `QueryResult`
   * `CreateCampaignBody { name; campaignType: CampaignType; scopeDomain?; scopeSubdomain?; scopeAssetType?; scopeAssetIds?: uuid[]; rbacGroups?: string[]; freshnessIntervalDays?: int; completionRule?: CompletionRule }`, `UpdateCampaignStatusBody { status: CampaignStatus }`
   * `RegisterAssetBody` (L200-C1 registration: `assetType, name, displayName?, description?, plainEnglishLogic?, yamlContent, repoUrl, fixturePath, branch?, environment, targetCatalog, targetSchema, domain?, subdomain?, synonyms?: string[], exampleQuestions?: string[]`) -> `RegisterAssetResult { asset: Asset; created: boolean; newVersion: boolean }`
   * `ReviewableQuery { assetType?; status?; limit?: int (1..200, default 50); offset?: int }` -> `Paged<Asset>` (`{ items, total, limit, offset }`)
   * `UpdatePreferencesBody { preferences: NotificationPreference[] }`, `UpdateConfigBody` = partial of `AppSettingsDto` (mirror of `AppSettings` in conventions §7, minus `seedSampleAssets`)
   * `MeResponse { userId, email, displayName, roles: Role[] }`
   * `MarkReadBody { ids: uuid[] | 'all' }` -> `{ updated: number }`; `UnreadCountResponse { count: number }`; `NotificationListQuery { unreadOnly?: boolean (coerced from 'true'/'false'); limit?: int 1..100 }`
   * `LeaderboardQuery { period: '7d' | '30d' | 'all' (default '7d'); limit?: int 1..100 }`
   * `MetricViewListQuery { catalog?: string; schema?: string }`; `ValidateResult { valid: boolean; error?: string }`
   * `CampaignListQuery { status?: CampaignStatus }`; `FreshnessCheckResult { campaignId: string | null; added: number }`
   * Query-string schemas must use `z.coerce` for numbers/booleans (Express query values are strings).
   * `HealthResponse { status: 'ok' | 'degraded'; db: boolean; migrations: number; version: string }`
5. `shared/contracts/mcp.ts` — `MCP_TOOL_NAMES` (`review_get_next`, `review_submit_vote`, `review_add_synonym`, `review_add_example`, `review_get_stats`, `review_run_query`, `campaign_list`, `campaign_create`, `campaign_update_status`, `metric_view_list`, `metric_view_get`, `metric_view_validate`) and a zod **raw shape** object per tool (`McpToolShapes.review_get_next = { campaign_id: z.string().uuid().optional(), asset_type: ... }`), reusing api.ts field definitions (snake_case keys for LLM friendliness).
6. `shared/contracts/errors.ts` — `ERROR_CODES = ['BAD_REQUEST','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','CONFLICT','UPSTREAM_ERROR','INTERNAL']` -> `ErrorCode`; `ERROR_STATUS: Record<ErrorCode, number>`; `ErrorResponse { error: { code: ErrorCode; message: string; details?: Record<string, unknown> } }`.
7. `shared/contracts/index.ts` — re-export everything (`export * from './values'` etc.; types via `export type *` where needed).
8. `tsconfig.client.json` — change `"include": ["client/src", "shared/appkit-types"]` to `["client/src", "shared/appkit-types", "shared/contracts"]`. Change nothing else.

## Acceptance Criteria
- [ ] All 7 files exist under `shared/contracts/`; `index.ts` re-exports all modules.
- [ ] No `enum`, `namespace`, or default export anywhere in `shared/`.
- [ ] Every DTO named in Task 4 exists as both `XxxSchema` (zod) and `Xxx` (`z.infer`) exports.
- [ ] `MCP_TOOL_NAMES` has exactly the 12 names above; all start with `review_`, `campaign_` or `metric_view_`.
- [ ] `tsconfig.client.json` include contains `shared/contracts`.
- [ ] `databricks bundle validate --strict --target dev` passes.

## Owned Paths / Assets
- `shared/contracts/**`
- `tsconfig.client.json`

## Dependencies
- None (wave 0). Session 02 runs in parallel and imports `ErrorCode`/`ERROR_STATUS` from `shared/contracts/errors.ts` and `Role` from `values.ts` — keep those names exact.
