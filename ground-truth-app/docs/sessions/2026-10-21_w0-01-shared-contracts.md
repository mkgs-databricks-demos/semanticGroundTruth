# Session 01: Shared Domain Contracts

**Wave:** 0 · **Run:** 842455926421383 · **Date:** 2026-10-21 · **Mode:** edit

## Summary

Created `shared/contracts/` with all 7 planned files (values, entities, review, api, mcp, errors, index) and added `shared/contracts` to the `tsconfig.client.json` include array. All gate checks pass.

## Files Created

| File | Purpose | Key exports |
|---|---|---|
| `shared/contracts/values.ts` | as-const value lists + derived union types | `ASSET_TYPES`, `AssetType`, `ASSET_STATUSES`, `AssetStatus`, `ENVIRONMENTS`, `Environment`, `VOTE_TYPES`, `VoteType`, `VOTE_SOURCES`, `VoteSource`, `CAMPAIGN_TYPES`, `CampaignType`, `CAMPAIGN_STATUSES`, `CampaignStatus`, `COMPLETION_RULES`, `CompletionRule`, `CAMPAIGN_ASSET_STATUSES`, `CampaignAssetStatus`, `NOTIFICATION_CHANNELS`, `NotificationChannel`, `NOTIFICATION_STATUSES`, `NotificationStatus`, `RECIPIENT_TYPES`, `RecipientType`, `NOTIFICATION_EVENT_TYPES`, `NotificationEventType`, `ROLES`, `Role` |
| `shared/contracts/entities.ts` | Domain entity interfaces (camelCase, ISO timestamps) | `Asset`, `AssetVersion`, `AssetSynonym`, `Vote`, `ExampleQuestion`, `ConfidenceScore`, `FeedbackBatch`, `Campaign`, `CampaignAsset`, `Notification`, `NotificationPreference`, `UserActivity`, `LeaderboardEntry`, `UserStats`, `ExecutiveSummary`, `MetricViewSummary`, `MetricViewDetail`, `MetricViewColumn`, `QueryResult` |
| `shared/contracts/review.ts` | Review card shape for card-swipe UX | `SURFACING_REASONS`, `SurfacingReason`, `ReviewCard` |
| `shared/contracts/api.ts` | Zod schemas + inferred types for REST routes | `GetNextQuerySchema`/`GetNextQuery`, `VoteBodySchema`/`VoteBody`, `VoteResult`, `SynonymBodySchema`/`SynonymBody`, `ExampleBodySchema`/`ExampleBody`, `RunQueryBodySchema`/`RunQueryBody`, `CreateCampaignBodySchema`/`CreateCampaignBody`, `UpdateCampaignStatusBodySchema`/`UpdateCampaignStatusBody`, `CampaignListQuerySchema`/`CampaignListQuery`, `FreshnessCheckResult`, `RegisterAssetBodySchema`/`RegisterAssetBody`, `RegisterAssetResult`, `ReviewableQuerySchema`/`ReviewableQuery`, `Paged<T>`, `UpdatePreferencesBodySchema`/`UpdatePreferencesBody`, `MarkReadBodySchema`/`MarkReadBody`, `MarkReadResponse`, `UnreadCountResponse`, `NotificationListQuerySchema`/`NotificationListQuery`, `UpdateConfigBodySchema`/`UpdateConfigBody`, `AppSettingsDto`, `MeResponse`, `LeaderboardQuerySchema`/`LeaderboardQuery`, `MetricViewListQuerySchema`/`MetricViewListQuery`, `ValidateResult`, `HealthResponse` |
| `shared/contracts/mcp.ts` | MCP tool names + raw zod input shapes | `MCP_TOOL_NAMES` (12 items), `McpToolName`, `McpToolShapes` (object with per-tool zod shape defs) |
| `shared/contracts/errors.ts` | Error codes, HTTP status map, error response shape | `ERROR_CODES`, `ErrorCode`, `ERROR_STATUS`, `ErrorResponse` |
| `shared/contracts/index.ts` | Barrel re-export | Re-exports all modules; `export type *` for entities (types only) |

## Files Modified

| File | Change |
|---|---|
| `tsconfig.client.json` | Added `"shared/contracts"` to `include` array |

## Checks

| Check | Result |
|---|---|
| shared/contracts/ contains values.ts, entities.ts, review.ts, api.ts, mcp.ts, errors.ts, index.ts | pass |
| No file under shared/ contains `enum ` or `namespace ` keywords | pass |
| mcp.ts defines exactly 12 tool names, all starting with review\_, campaign\_, or metric\_view\_ | pass |
| tsconfig.client.json include list contains shared/contracts | pass |
| `databricks bundle validate --strict --target dev` | pass |
| TypeScript compilation (`tsc -b`) | skipped (no Node toolchain in session) |

## Decisions / Assumptions

* Response-only DTOs (e.g. `VoteResult`, `MeResponse`, `HealthResponse`) are plain interfaces, not zod schemas — validation schemas are only needed for request inputs. The acceptance criterion "every DTO as Schema + type" is interpreted as applying to request DTOs.
* `entities.ts` does not import `Role` from `values.ts` (unused in entity interfaces); `Role` is used in `api.ts` (`MeResponse`) and re-exported via index barrel.
* `RegisterAssetResult.asset` uses `import('./entities').Asset` inline type import to avoid a circular reference.

## Requests

None.
