// shared/contracts/schemas.ts — executable contracts for every REST route and MCP tool
// Session 25 · Wave 4-0 · No enum, no namespace, no default export
//
// One zod schema per request body, query string, path param set and response
// body. ROUTE_CONTRACTS lists every route (server/routes/*.ts plus the routes
// planned for session 33); MCP_TOOL_CONTRACTS lists every MCP tool (inputs and
// the JSON in structuredContent). Server routes validate requests with these
// schemas; contract tests (plan 35) validate responses with them.
// renderContractSchemas() is the single source for
// generated/contracts.schema.json (shared with the Python contract job).
//
// Timestamps are ISO strings on the wire; they are typed as plain strings here
// so DATE and TIMESTAMPTZ columns both validate.

import { z } from 'zod';
import type {
  AppGroup,
  AppGroupMember,
  Asset,
  AssetSource,
  AssetSynonym,
  AssetVersion,
  Campaign,
  ConfidenceScore,
  ConflictGroup,
  ConflictResolutionResult,
  EditProposal,
  ExampleQuestion,
  ExecutiveSummary,
  FeedbackBatch,
  FeedbackBranch,
  FeedbackQueueItem,
  LeaderboardEntry,
  MetricViewColumn,
  MetricViewDetail,
  MetricViewSummary,
  Notification,
  NotificationPreference,
  QueryResult,
  ReviewSkip,
  UserActivity,
  UserSettings,
  UserStats,
  Vote,
} from './entities';
import type { ReviewCard, SkipResponse } from './review';
import { SURFACING_REASONS } from './review';
import type {
  CatalogEntry,
  FreshnessCheckResult,
  HealthResponse,
  ImportAssetsResponse,
  MarkReadResponse,
  MeResponse,
  RegisterAssetResult,
  ScanSourceResponse,
  SchemaEntry,
  ShareSlackResponse,
  SlackChannel,
  UnreadCountResponse,
  ValidateResult,
  VoteResult,
} from './api';
import {
  AddGroupMemberBodySchema,
  AssetIdParamSchema,
  BatchIdParamSchema,
  CampaignIdParamSchema,
  CampaignListQuerySchema,
  CatalogMetricViewsQuerySchema,
  CatalogSchemasQuerySchema,
  ConflictsQuerySchema,
  CreateCampaignBodySchema,
  ExampleBodySchema,
  FeedbackBranchListQuerySchema,
  FeedbackQueueQuerySchema,
  GetNextQuerySchema,
  GroupNameParamSchema,
  ImportAssetsBodySchema,
  LeaderboardQuerySchema,
  MarkReadBodySchema,
  MetricViewFullNameParamSchema,
  MetricViewListQuerySchema,
  NotificationIdParamSchema,
  NotificationListQuerySchema,
  RegisterAssetBodySchema,
  RegisterSourceBodySchema,
  RemoveGroupMemberParamSchema,
  ResolveConflictRequestSchema,
  ReviewableQuerySchema,
  RunQueryBodySchema,
  ShareSlackRequestSchema,
  SkipRequestSchema,
  SlackChannelsQuerySchema,
  SourceIdParamSchema,
  SynonymBodySchema,
  UpdateCampaignStatusBodySchema,
  UpdateConfigBodySchema,
  UpdateFeedbackBranchStatusRequestSchema,
  UpdatePreferencesBodySchema,
  UpdateUserSettingsRequestSchema,
  UpsertFeedbackBranchRequestSchema,
  VoteBodySchema,
} from './api';
import { AppRuntimeConfigSchema, ScoringConfigSchema } from './config';
import type { ScoringConfig } from './config';
import { ERROR_CODES } from './errors';
import type { ErrorResponse } from './errors';
import { MCP_TOOL_NAMES, MCP_TOOL_NAMES_BUILD_4, McpToolShapes } from './mcp';
import type { McpToolName, McpToolNameBuild4 } from './mcp';
import {
  APP_GROUP_NAMES,
  ASSET_STATUSES,
  ASSET_TYPES,
  CAMPAIGN_ASSET_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  COMPLETION_RULES,
  CONFLICT_RESOLUTIONS,
  DENSITIES,
  EDIT_FIELDS,
  ENVIRONMENTS,
  FEEDBACK_BATCH_STATUSES,
  MOTION_PREFS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_STATUSES,
  ROLES,
  SKIP_REASONS,
  SLACK_SHARE_STATUSES,
  SOURCE_TYPES,
  THEMES,
  VOTE_SOURCES,
  VOTE_TYPES,
} from './values';
import type { Role } from './values';

// ── Primitives ──────────────────────────────────────────────────────────────

const id = z.string().min(1);
const ts = z.string().min(1);
const count = z.number().int().min(0);
const jsonObject = z.record(z.string(), z.unknown());

// ── Error envelope (errors.ts) ──────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: jsonObject.optional(),
  }),
});

// ── Entities (entities.ts) ──────────────────────────────────────────────────

export const AssetSynonymSchema = z.object({
  id,
  assetId: id,
  synonym: z.string(),
  proposedBy: z.string(),
  approvals: count,
  rejections: count,
  createdAt: ts,
});

export const AssetSchema = z.object({
  id,
  assetType: z.enum(ASSET_TYPES),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  plainEnglishLogic: z.string().nullable(),
  yamlContent: z.string().nullable(),
  repoUrl: z.string().nullable(),
  fixturePath: z.string().nullable(),
  branch: z.string().nullable(),
  environment: z.enum(ENVIRONMENTS),
  targetCatalog: z.string(),
  targetSchema: z.string(),
  status: z.enum(ASSET_STATUSES),
  domain: z.string().nullable(),
  subdomain: z.string().nullable(),
  synonyms: z.array(AssetSynonymSchema),
  sourceId: z.string().nullable(),
  sourceMetadata: jsonObject.nullable(),
  createdAt: ts,
  updatedAt: ts,
});

export const AssetVersionSchema = z.object({
  id,
  assetId: id,
  version: z.number().int(),
  yamlContent: z.string().nullable(),
  description: z.string().nullable(),
  plainEnglishLogic: z.string().nullable(),
  createdAt: ts,
  createdBy: z.string().nullable(),
});

export const VoteSchema = z.object({
  id,
  assetId: id,
  userId: z.string(),
  voteType: z.enum(VOTE_TYPES),
  source: z.enum(VOTE_SOURCES),
  feedback: z.string().nullable(),
  editDescription: z.string().nullable(),
  editPlainEnglishLogic: z.string().nullable(),
  editDisplayName: z.string().nullable(),
  createdAt: ts,
});

export const ExampleQuestionSchema = z.object({
  id,
  assetId: id,
  questionText: z.string(),
  proposedBy: z.string(),
  approved: z.boolean(),
  createdAt: ts,
});

export const ConfidenceScoreSchema = z.object({
  assetId: id,
  totalVotes: count,
  approvals: count,
  rejections: count,
  edits: count,
  wilsonLower: z.number(),
  wilsonUpper: z.number(),
  confidence: z.number(),
  lastVoteAt: ts.nullable(),
  computedAt: ts,
});

export const FeedbackBatchSchema = z.object({
  id,
  triggeredBy: z.string(),
  branchName: z.string().nullable(),
  status: z.enum(FEEDBACK_BATCH_STATUSES),
  assetCount: count,
  processingTimeSeconds: z.number().nullable(),
  files: z.array(z.string()),
  summary: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedAt: ts.nullable(),
  createdAt: ts,
  completedAt: ts.nullable(),
});

export const CampaignSchema = z.object({
  id,
  name: z.string(),
  campaignType: z.enum(CAMPAIGN_TYPES),
  status: z.enum(CAMPAIGN_STATUSES),
  completionRule: z.enum(COMPLETION_RULES),
  scopeDomain: z.string().nullable(),
  scopeSubdomain: z.string().nullable(),
  scopeAssetType: z.enum(ASSET_TYPES).nullable(),
  scopeAssetIds: z.array(z.string()).nullable(),
  rbacGroups: z.array(z.string()),
  freshnessIntervalDays: z.number().int().nullable(),
  totalAssets: count,
  reviewedAssets: count,
  createdBy: z.string(),
  createdAt: ts,
  updatedAt: ts,
  completedAt: ts.nullable(),
});

export const CampaignAssetSchema = z.object({
  campaignId: id,
  assetId: id,
  status: z.enum(CAMPAIGN_ASSET_STATUSES),
});

export const NotificationSchema = z.object({
  id,
  userId: z.string(),
  eventType: z.enum(NOTIFICATION_EVENT_TYPES),
  channel: z.enum(NOTIFICATION_CHANNELS),
  status: z.enum(NOTIFICATION_STATUSES),
  title: z.string(),
  body: z.string(),
  metadata: jsonObject.nullable(),
  createdAt: ts,
  readAt: ts.nullable(),
});

export const NotificationPreferenceSchema = z.object({
  userId: z.string(),
  eventType: z.enum(NOTIFICATION_EVENT_TYPES),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)),
  digest: z.boolean(),
});

export const UserActivitySchema = z.object({
  userId: z.string(),
  email: z.string(),
  totalVotes: count,
  totalSkips: count,
  currentStreakDays: count,
  longestStreakDays: count,
  lastVoteDate: ts.nullable(),
  lastSkipAt: ts.nullable(),
  badges: z.array(z.string()),
});

export const LeaderboardEntrySchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string(),
  totalVotes: count,
  approvals: count,
  rejections: count,
  edits: count,
  skippedCount: count,
  currentStreakDays: count,
  rank: z.number().int().min(1),
});

export const UserStatsSchema = z.object({
  totalVotes: count,
  approvals: count,
  rejections: count,
  edits: count,
  skippedCount: count,
  skippedToday: count,
  currentStreakDays: count,
  rank: z.number().int().min(0),
  coveragePct: z.number().min(0),
});

export const ExecutiveSummarySchema = z.object({
  totalAssets: count,
  reviewedAssets: count,
  certifiedAssets: count,
  coveragePct: z.number().min(0),
  certificationPct: z.number().min(0),
  activeReviewers7d: count,
  votes7d: count,
  activeCampaigns: count,
});

export const MetricViewSummarySchema = z.object({
  fullName: z.string(),
  comment: z.string().nullable(),
  measureCount: count,
  dimensionCount: count,
});

export const MetricViewColumnSchema = z.object({
  name: z.string(),
  expr: z.string(),
  displayName: z.string().optional(),
  comment: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
});

export const MetricViewDetailSchema = z.object({
  fullName: z.string(),
  comment: z.string().nullable(),
  measureCount: count,
  dimensionCount: count,
  measures: z.array(MetricViewColumnSchema),
  dimensions: z.array(MetricViewColumnSchema),
  yaml: z.string().optional(),
});

export const AppGroupMemberSchema = z.object({
  groupName: z.enum(APP_GROUP_NAMES),
  memberId: z.string(),
  addedBy: z.string(),
  addedAt: ts,
});

export const AppGroupSchema = z.object({
  name: z.enum(APP_GROUP_NAMES),
  role: z.enum(ROLES),
  description: z.string().nullable(),
  members: z.array(AppGroupMemberSchema),
  createdAt: ts,
});

export const AssetSourceSchema = z.object({
  id,
  sourceType: z.enum(SOURCE_TYPES),
  workspacePath: z.string(),
  displayName: z.string().nullable(),
  metricViewGlob: z.string(),
  glossaryGlob: z.string(),
  createdBy: z.string(),
  createdAt: ts,
  lastScannedAt: ts.nullable(),
});

export const QueryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  truncated: z.boolean(),
});

// ── Build 4 entities (plan 25) ──────────────────────────────────────────────

export const ReviewSkipSchema = z.object({
  id,
  assetId: id,
  campaignId: z.string().nullable(),
  reason: z.enum(SKIP_REASONS).nullable(),
  versionHash: z.string().nullable(),
  source: z.enum(VOTE_SOURCES),
  createdAt: ts,
});

export const SkipStatsSchema = z.object({
  skippedCount: count,
  skippedToday: count,
});

export const SkipResponseSchema = z.object({
  skip: ReviewSkipSchema,
  stats: SkipStatsSchema,
});

export const UserSettingsSchema = z.object({
  theme: z.enum(THEMES),
  density: z.enum(DENSITIES),
  motion: z.enum(MOTION_PREFS),
  defaultCampaignId: z.string().nullable(),
  defaultAssetType: z.enum(ASSET_TYPES).nullable(),
  showKeyboardHints: z.boolean(),
  cardsPerSession: z.number().int().min(5).max(100),
  updatedAt: ts.nullable(),
});

export const FeedbackQueueItemSchema = z.object({
  assetId: id,
  displayName: z.string(),
  assetType: z.enum(ASSET_TYPES),
  campaignId: z.string().nullable(),
  votes: z.object({ approve: count, reject: count, edit: count }),
  skips: count,
  pendingEdits: count,
  lastActivityAt: ts.nullable(),
});

export const EditProposalSchema = z.object({
  voteId: id,
  userId: z.string(),
  field: z.enum(EDIT_FIELDS),
  value: z.string(),
  createdAt: ts,
});

export const ConflictGroupSchema = z.object({
  assetId: id,
  displayName: z.string(),
  edits: z.array(EditProposalSchema),
  rejectCount: count,
  approveCount: count,
});

export const ConflictResolutionResultSchema = z.object({
  assetId: id,
  resolution: z.enum(CONFLICT_RESOLUTIONS),
  resolvedVotes: count,
  resolvedBy: z.string(),
  resolvedAt: ts,
});

export const FeedbackBranchSchema = z.object({
  batchId: id,
  branchName: z.string(),
  status: z.enum(FEEDBACK_BATCH_STATUSES),
  assetCount: count,
  files: z.array(z.string()),
  summary: z.string().nullable(),
  createdAt: ts,
  completedAt: ts.nullable(),
  reviewedBy: z.string().nullable(),
  htmlUrl: z.string().url().nullable(),
});

// ── Composite responses (review.ts, api.ts) ──────────────────────────────────

export const ReviewCardSchema = z.object({
  asset: AssetSchema,
  synonyms: z.array(AssetSynonymSchema),
  examples: z.array(ExampleQuestionSchema),
  confidence: ConfidenceScoreSchema.nullable(),
  campaign: z.object({ campaignId: id, name: z.string() }).optional(),
  reason: z.enum(SURFACING_REASONS),
  progress: z.object({ reviewed: count, total: count }),
  resurfacedFromSkip: z.boolean().optional(),
});

export const VoteResultSchema = z.object({
  vote: VoteSchema,
  confidence: ConfidenceScoreSchema,
  assetStatus: z.enum(ASSET_STATUSES),
  next: ReviewCardSchema.nullable().optional(),
});

/** Paged<T> envelope (GET /api/assets, GET /api/steward/feedback-queue). */
export function pagedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: count,
    limit: z.number().int().min(1),
    offset: count,
  });
}

export const PagedAssetsSchema = pagedSchema(AssetSchema);
export const PagedFeedbackQueueSchema = pagedSchema(FeedbackQueueItemSchema);

export const RegisterAssetResultSchema = z.object({
  asset: AssetSchema,
  created: z.boolean(),
  newVersion: z.boolean(),
});

export const FreshnessCheckResultSchema = z.object({
  campaignId: z.string().nullable(),
  added: count,
});

// ── Share to Slack (build 5 session 44; handlers session 50) ──

export const ShareSlackResponseSchema = z.object({
  status: z.enum(SLACK_SHARE_STATUSES),
  permalink: z.string().url().optional(),
  loginUrl: z.string().url().optional(),
});

export const SlackChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
});

export const MarkReadResponseSchema = z.object({ updated: count });
export const UnreadCountResponseSchema = z.object({ count });

export const MeResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string(),
  roles: z.array(z.enum(ROLES)),
});

export const ValidateResultSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.boolean(),
  migrations: count,
  version: z.string(),
});

export const CatalogEntrySchema = z.object({
  name: z.string(),
  comment: z.string().nullable(),
});

export const SchemaEntrySchema = z.object({
  name: z.string(),
  fullName: z.string(),
  comment: z.string().nullable(),
});

export const ScanSourceResponseSchema = z.object({
  metricViewFiles: z.array(z.object({ filePath: z.string(), viewName: z.string() })),
  glossaryTerms: z.array(z.object({
    filePath: z.string(),
    term: z.string(),
    domain: z.string().optional(),
    subdomain: z.string().optional(),
    definition: z.string(),
  })),
});

export const ImportAssetsResponseSchema = z.object({
  created: z.array(z.string()),
  updated: z.array(z.string()),
  skipped: z.array(z.object({ ref: z.string(), reason: z.string() })),
});

// ── Route contracts ─────────────────────────────────────────────────────────

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface RouteContract {
  method: HttpMethod;
  /** Express path, e.g. /api/assets/:assetId */
  path: string;
  /** Minimum role (requireRole); 'public' = no identity check (GET /health). */
  role: Role | 'public';
  request?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
  response: z.ZodType;
  /** HTTP status on success. */
  status: number;
  /** HTTP statuses the route can return with the ErrorResponse envelope. */
  errors: number[];
  /** Set while the route is planned but not yet registered (e.g. 'session 33'). */
  plannedIn?: string;
}

// Error status sets. Every authenticated route can return 401 (no identity),
// 403 (role) and 500. Body/query/params validation adds 400; lookups add 404;
// Unity Catalog / SQL warehouse calls add 502.
const AUTH = [401, 403, 500];
const AUTH_400 = [400, 401, 403, 500];
const AUTH_404 = [400, 401, 403, 404, 500];
const UPSTREAM = [400, 401, 403, 404, 500, 502];
const SLACK = [400, 401, 403, 404, 429, 500, 502];

export const ROUTE_CONTRACTS: readonly RouteContract[] = [
  // ── health.ts, config.ts, me.ts ──
  { method: 'GET', path: '/health', role: 'public', response: HealthResponseSchema, status: 200, errors: [500] },
  { method: 'GET', path: '/api/config', role: 'reviewer', response: AppRuntimeConfigSchema, status: 200, errors: AUTH },
  { method: 'GET', path: '/api/me', role: 'reviewer', response: MeResponseSchema, status: 200, errors: AUTH },

  // ── review.ts ──
  { method: 'GET', path: '/api/review/next', role: 'reviewer', query: GetNextQuerySchema, response: ReviewCardSchema.nullable(), status: 200, errors: AUTH_404 },
  { method: 'POST', path: '/api/review/vote', role: 'reviewer', request: VoteBodySchema, response: VoteResultSchema, status: 200, errors: AUTH_404 },
  { method: 'POST', path: '/api/review/synonym', role: 'reviewer', request: SynonymBodySchema, response: z.array(AssetSynonymSchema), status: 200, errors: AUTH_404 },
  { method: 'POST', path: '/api/review/example', role: 'reviewer', request: ExampleBodySchema, response: z.array(ExampleQuestionSchema), status: 200, errors: AUTH_404 },
  { method: 'POST', path: '/api/review/run-query', role: 'reviewer', request: RunQueryBodySchema, response: QueryResultSchema, status: 200, errors: UPSTREAM },
  { method: 'GET', path: '/api/review/stats/me', role: 'reviewer', response: UserStatsSchema, status: 200, errors: AUTH },

  // ── leaderboard.ts ──
  { method: 'GET', path: '/api/leaderboard', role: 'reviewer', query: LeaderboardQuerySchema, response: z.array(LeaderboardEntrySchema), status: 200, errors: AUTH_400 },

  // ── assets.ts ──
  { method: 'GET', path: '/api/assets', role: 'reviewer', query: ReviewableQuerySchema, response: PagedAssetsSchema, status: 200, errors: AUTH_400 },
  { method: 'GET', path: '/api/assets/:assetId', role: 'reviewer', params: AssetIdParamSchema, response: AssetSchema, status: 200, errors: AUTH_404 },
  { method: 'GET', path: '/api/assets/:assetId/versions', role: 'reviewer', params: AssetIdParamSchema, response: z.array(AssetVersionSchema), status: 200, errors: AUTH_404 },
  { method: 'POST', path: '/api/assets/register', role: 'steward', request: RegisterAssetBodySchema, response: RegisterAssetResultSchema, status: 201, errors: AUTH_400 },
  { method: 'POST', path: '/api/assets/import', role: 'steward', request: ImportAssetsBodySchema, response: ImportAssetsResponseSchema, status: 200, errors: UPSTREAM },
  { method: 'GET', path: '/api/sources', role: 'steward', response: z.array(AssetSourceSchema), status: 200, errors: AUTH },
  { method: 'POST', path: '/api/sources', role: 'steward', request: RegisterSourceBodySchema, response: AssetSourceSchema, status: 201, errors: [400, 401, 403, 409, 500, 502] },
  { method: 'POST', path: '/api/sources/:id/scan', role: 'steward', params: SourceIdParamSchema, response: ScanSourceResponseSchema, status: 200, errors: UPSTREAM },

  // ── campaigns.ts ──
  { method: 'GET', path: '/api/campaigns', role: 'reviewer', query: CampaignListQuerySchema, response: z.array(CampaignSchema), status: 200, errors: AUTH_400 },
  { method: 'POST', path: '/api/campaigns', role: 'steward', request: CreateCampaignBodySchema, response: CampaignSchema, status: 201, errors: AUTH_400 },
  { method: 'GET', path: '/api/campaigns/:campaignId', role: 'reviewer', params: CampaignIdParamSchema, response: CampaignSchema, status: 200, errors: AUTH_404 },
  { method: 'PATCH', path: '/api/campaigns/:campaignId/status', role: 'steward', params: CampaignIdParamSchema, request: UpdateCampaignStatusBodySchema, response: CampaignSchema, status: 200, errors: [400, 401, 403, 404, 409, 500] },
  { method: 'POST', path: '/api/campaigns/freshness-check', role: 'admin', response: FreshnessCheckResultSchema, status: 200, errors: AUTH },

  // ── metricViews.ts ──
  { method: 'GET', path: '/api/catalog/catalogs', role: 'steward', response: z.array(CatalogEntrySchema), status: 200, errors: [401, 403, 500, 502] },
  { method: 'GET', path: '/api/catalog/schemas', role: 'steward', query: CatalogSchemasQuerySchema, response: z.array(SchemaEntrySchema), status: 200, errors: UPSTREAM },
  { method: 'GET', path: '/api/catalog/metric-views', role: 'steward', query: CatalogMetricViewsQuerySchema, response: z.array(MetricViewSummarySchema), status: 200, errors: UPSTREAM },
  { method: 'GET', path: '/api/metric-views', role: 'reviewer', query: MetricViewListQuerySchema, response: z.array(MetricViewSummarySchema), status: 200, errors: UPSTREAM },
  { method: 'GET', path: '/api/metric-views/:fullName', role: 'reviewer', params: MetricViewFullNameParamSchema, response: MetricViewDetailSchema, status: 200, errors: UPSTREAM },
  { method: 'POST', path: '/api/metric-views/:fullName/validate', role: 'reviewer', params: MetricViewFullNameParamSchema, response: ValidateResultSchema, status: 200, errors: UPSTREAM },

  // ── notifications.ts ──
  { method: 'GET', path: '/api/notifications', role: 'reviewer', query: NotificationListQuerySchema, response: z.array(NotificationSchema), status: 200, errors: AUTH_400 },
  { method: 'GET', path: '/api/notifications/unread-count', role: 'reviewer', response: UnreadCountResponseSchema, status: 200, errors: AUTH },
  { method: 'POST', path: '/api/notifications/read', role: 'reviewer', request: MarkReadBodySchema, response: MarkReadResponseSchema, status: 200, errors: AUTH_400 },
  { method: 'GET', path: '/api/notifications/preferences', role: 'reviewer', response: z.array(NotificationPreferenceSchema), status: 200, errors: AUTH },
  { method: 'PUT', path: '/api/notifications/preferences', role: 'reviewer', request: UpdatePreferencesBodySchema, response: z.array(NotificationPreferenceSchema), status: 200, errors: AUTH_400 },

  // ── admin.ts ──
  { method: 'GET', path: '/api/admin/config', role: 'admin', response: ScoringConfigSchema, status: 200, errors: AUTH },
  { method: 'PUT', path: '/api/admin/config', role: 'admin', request: UpdateConfigBodySchema, response: ScoringConfigSchema, status: 200, errors: AUTH_400 },
  { method: 'GET', path: '/api/admin/summary', role: 'steward', response: ExecutiveSummarySchema, status: 200, errors: AUTH },
  { method: 'POST', path: '/api/admin/recompute/:assetId', role: 'admin', params: AssetIdParamSchema, response: ConfidenceScoreSchema, status: 200, errors: AUTH_404 },
  { method: 'GET', path: '/api/admin/groups', role: 'admin', response: z.array(AppGroupSchema), status: 200, errors: AUTH },
  { method: 'POST', path: '/api/admin/groups/:name/members', role: 'admin', params: GroupNameParamSchema, request: AddGroupMemberBodySchema, response: AppGroupSchema, status: 200, errors: AUTH_404 },
  { method: 'DELETE', path: '/api/admin/groups/:name/members/:memberId', role: 'admin', params: RemoveGroupMemberParamSchema, response: AppGroupSchema, status: 200, errors: [400, 401, 403, 404, 409, 500] },

  // ── Planned (session 33): skip, user settings, steward triage ──
  { method: 'POST', path: '/api/review/skip', role: 'reviewer', request: SkipRequestSchema, response: SkipResponseSchema, status: 201, errors: AUTH_404 },
  { method: 'GET', path: '/api/me/settings', role: 'reviewer', response: UserSettingsSchema, status: 200, errors: AUTH },
  { method: 'PUT', path: '/api/me/settings', role: 'reviewer', request: UpdateUserSettingsRequestSchema, response: UserSettingsSchema, status: 200, errors: AUTH_404 },
  { method: 'GET', path: '/api/steward/feedback-queue', role: 'steward', query: FeedbackQueueQuerySchema, response: PagedFeedbackQueueSchema, status: 200, errors: AUTH_400 },
  { method: 'GET', path: '/api/steward/conflicts', role: 'steward', query: ConflictsQuerySchema, response: z.array(ConflictGroupSchema), status: 200, errors: AUTH_400 },
  { method: 'POST', path: '/api/steward/conflicts/:assetId/resolve', role: 'steward', params: AssetIdParamSchema, request: ResolveConflictRequestSchema, response: ConflictResolutionResultSchema, status: 200, errors: [400, 401, 403, 404, 409, 500] },
  { method: 'GET', path: '/api/steward/feedback-branches', role: 'steward', query: FeedbackBranchListQuerySchema, response: z.array(FeedbackBranchSchema), status: 200, errors: AUTH_400 },
  { method: 'POST', path: '/api/steward/feedback-branches', role: 'admin', request: UpsertFeedbackBranchRequestSchema, response: FeedbackBranchSchema, status: 201, errors: AUTH_404 },
  { method: 'POST', path: '/api/steward/feedback-branches/:batchId/status', role: 'steward', params: BatchIdParamSchema, request: UpdateFeedbackBranchStatusRequestSchema, response: FeedbackBranchSchema, status: 200, errors: [400, 401, 403, 404, 409, 500] },

  // ── slack.ts (build 5: contract session 44, handlers session 50) ──
  // Steward or admin (requireRole is a minimum). 404 = unknown notification /
  // asset or GT_SLACK_SHARE_ENABLED=false; 429 = Unity Gateway / Slack rate
  // limit; 502 = system.ai.slack error. Live contract job: skipped (OBO only).
  { method: 'POST', path: '/api/notifications/:id/share-slack', role: 'steward', params: NotificationIdParamSchema, request: ShareSlackRequestSchema, response: ShareSlackResponseSchema, status: 200, errors: SLACK },
  { method: 'POST', path: '/api/assets/:assetId/share-slack', role: 'steward', params: AssetIdParamSchema, request: ShareSlackRequestSchema, response: ShareSlackResponseSchema, status: 200, errors: SLACK },
  { method: 'GET', path: '/api/slack/channels', role: 'steward', query: SlackChannelsQuerySchema, response: z.array(SlackChannelSchema), status: 200, errors: SLACK },
];

/** Stable key for a route contract, e.g. "GET /api/assets/:assetId". */
export function routeKey(c: Pick<RouteContract, 'method' | 'path'>): string {
  return `${c.method} ${c.path}`;
}

// ── MCP tool contracts ─────────────────────────────────────────────────────

export interface McpToolContract {
  name: McpToolName | McpToolNameBuild4;
  /** Minimum role. review_add_synonym action=remove additionally needs steward. */
  role: Role;
  /** Tool input (the arguments object). */
  input: z.ZodObject;
  /** JSON in the result's structuredContent (null = text only). */
  output: z.ZodType | null;
  /** Text-only result returned instead of structuredContent (e.g. empty queue). */
  emptyText?: string;
  plannedIn?: string;
}

export const MCP_TOOL_CONTRACTS: readonly McpToolContract[] = [
  { name: 'review_get_next', role: 'reviewer', input: z.object(McpToolShapes.review_get_next), output: ReviewCardSchema, emptyText: 'No more assets to review.' },
  // asset_id is optional at runtime: it defaults to the current MCP review session asset.
  { name: 'review_submit_vote', role: 'reviewer', input: z.object({ ...McpToolShapes.review_submit_vote, asset_id: z.string().uuid().optional() }), output: VoteResultSchema },
  // structuredContent must be an object (MCP CallToolResult): list tools wrap their array as { items } (session 36).
  { name: 'review_add_synonym', role: 'reviewer', input: z.object(McpToolShapes.review_add_synonym), output: z.object({ items: z.array(AssetSynonymSchema) }) },
  { name: 'review_add_example', role: 'reviewer', input: z.object(McpToolShapes.review_add_example), output: z.object({ items: z.array(ExampleQuestionSchema) }) },
  { name: 'review_get_stats', role: 'reviewer', input: z.object(McpToolShapes.review_get_stats), output: UserStatsSchema },
  { name: 'review_run_query', role: 'reviewer', input: z.object(McpToolShapes.review_run_query), output: QueryResultSchema },
  { name: 'campaign_list', role: 'reviewer', input: z.object(McpToolShapes.campaign_list), output: z.object({ items: z.array(CampaignSchema) }) },
  { name: 'campaign_create', role: 'steward', input: z.object(McpToolShapes.campaign_create), output: CampaignSchema },
  { name: 'campaign_update_status', role: 'steward', input: z.object(McpToolShapes.campaign_update_status), output: CampaignSchema },
  { name: 'metric_view_list', role: 'reviewer', input: z.object(McpToolShapes.metric_view_list), output: z.object({ items: z.array(MetricViewSummarySchema) }) },
  { name: 'metric_view_get', role: 'reviewer', input: z.object(McpToolShapes.metric_view_get), output: MetricViewDetailSchema },
  { name: 'metric_view_validate', role: 'reviewer', input: z.object(McpToolShapes.metric_view_validate), output: ValidateResultSchema },
  { name: 'review_skip_card', role: 'reviewer', input: z.object(McpToolShapes.review_skip_card), output: SkipResponseSchema, plannedIn: 'session 34' },
];

/** Every tool name with a contract (12 deployed + build 4 additions). */
export const ALL_MCP_TOOL_NAMES: readonly (McpToolName | McpToolNameBuild4)[] = [
  ...MCP_TOOL_NAMES,
  ...MCP_TOOL_NAMES_BUILD_4,
];

// ── JSON Schema export ──────────────────────────────────────────────────────

type JsonSchema = Record<string, unknown>;
type JsonRef = { $ref: string };

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

// Named entity schemas: emitted once under $defs/<name> and referenced from
// every route and tool that uses them.
const NAMED_SCHEMAS: readonly [string, z.ZodType][] = [
  ['ErrorResponse', ErrorResponseSchema],
  ['Asset', AssetSchema],
  ['AssetSynonym', AssetSynonymSchema],
  ['AssetVersion', AssetVersionSchema],
  ['Vote', VoteSchema],
  ['ExampleQuestion', ExampleQuestionSchema],
  ['ConfidenceScore', ConfidenceScoreSchema],
  ['FeedbackBatch', FeedbackBatchSchema],
  ['Campaign', CampaignSchema],
  ['CampaignAsset', CampaignAssetSchema],
  ['Notification', NotificationSchema],
  ['NotificationPreference', NotificationPreferenceSchema],
  ['UserActivity', UserActivitySchema],
  ['LeaderboardEntry', LeaderboardEntrySchema],
  ['UserStats', UserStatsSchema],
  ['ExecutiveSummary', ExecutiveSummarySchema],
  ['MetricViewSummary', MetricViewSummarySchema],
  ['MetricViewColumn', MetricViewColumnSchema],
  ['MetricViewDetail', MetricViewDetailSchema],
  ['AppGroupMember', AppGroupMemberSchema],
  ['AppGroup', AppGroupSchema],
  ['AssetSource', AssetSourceSchema],
  ['QueryResult', QueryResultSchema],
  ['ReviewSkip', ReviewSkipSchema],
  ['SkipStats', SkipStatsSchema],
  ['SkipResponse', SkipResponseSchema],
  ['UserSettings', UserSettingsSchema],
  ['FeedbackQueueItem', FeedbackQueueItemSchema],
  ['EditProposal', EditProposalSchema],
  ['ConflictGroup', ConflictGroupSchema],
  ['ConflictResolutionResult', ConflictResolutionResultSchema],
  ['FeedbackBranch', FeedbackBranchSchema],
  ['ReviewCard', ReviewCardSchema],
  ['VoteResult', VoteResultSchema],
  ['ScoringConfig', ScoringConfigSchema],
  ['AppRuntimeConfig', AppRuntimeConfigSchema],
  ['ShareSlackResponse', ShareSlackResponseSchema],
  ['SlackChannel', SlackChannelSchema],
];

/** $defs key for a route part, e.g. "GET /api/assets/:assetId" -> res_GET_api_assets_assetId. */
function defKey(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
}

export interface ContractJsonSchemas {
  $schema: typeof JSON_SCHEMA_DIALECT;
  version: 1;
  routes: Record<string, {
    method: HttpMethod;
    path: string;
    role: Role | 'public';
    status: number;
    errors: number[];
    plannedIn?: string;
    request?: JsonRef;
    query?: JsonRef;
    params?: JsonRef;
    response: JsonRef;
  }>;
  mcpTools: Record<string, {
    role: Role;
    plannedIn?: string;
    emptyText?: string;
    input: JsonRef;
    output: JsonRef | null;
  }>;
  errorResponse: JsonRef;
  /** Every schema, keyed by name; all $ref values point here (#/$defs/<name>). */
  $defs: Record<string, JsonSchema>;
}

/**
 * JSON Schema (draft 2020-12) for every route and MCP tool. Requests, queries,
 * params and tool inputs use the input side of each schema (what a client
 * sends); responses and tool outputs use the output side, where objects are
 * closed (additionalProperties: false) so contract tests catch extra fields.
 *
 * Validate an instance against `{ ...entry.response, $defs: doc.$defs }`.
 */
export function toJsonSchemas(): ContractJsonSchemas {
  const input = z.registry<{ id: string }>();
  const output = z.registry<{ id: string }>();
  for (const [name, schema] of NAMED_SCHEMAS) output.add(schema, { id: name });

  const ref = (reg: typeof input, schema: z.ZodType, id: string): JsonRef => {
    if (!reg.has(schema)) reg.add(schema, { id });
    return { $ref: `#/$defs/${reg.get(schema)!.id}` };
  };

  const routes: ContractJsonSchemas['routes'] = {};
  for (const c of ROUTE_CONTRACTS) {
    const key = routeKey(c);
    routes[key] = {
      method: c.method,
      path: c.path,
      role: c.role,
      status: c.status,
      errors: [...c.errors],
      ...(c.plannedIn ? { plannedIn: c.plannedIn } : {}),
      ...(c.request ? { request: ref(input, c.request, defKey('req', key)) } : {}),
      ...(c.query ? { query: ref(input, c.query, defKey('query', key)) } : {}),
      ...(c.params ? { params: ref(input, c.params, defKey('params', key)) } : {}),
      response: ref(output, c.response, defKey('res', key)),
    };
  }
  const mcpTools: ContractJsonSchemas['mcpTools'] = {};
  for (const t of MCP_TOOL_CONTRACTS) {
    mcpTools[t.name] = {
      role: t.role,
      ...(t.plannedIn ? { plannedIn: t.plannedIn } : {}),
      ...(t.emptyText ? { emptyText: t.emptyText } : {}),
      input: ref(input, t.input, `mcp_in_${t.name}`),
      output: t.output ? ref(output, t.output, `mcp_out_${t.name}`) : null,
    };
  }

  const uri = (id: string) => `#/$defs/${id}`;
  const opts = { unrepresentable: 'any', uri } as const;
  const inDefs = z.toJSONSchema(input, { ...opts, io: 'input' }).schemas;
  const outDefs = z.toJSONSchema(output, { ...opts, io: 'output' }).schemas;
  const $defs: Record<string, JsonSchema> = {};
  for (const [id, schema] of [...Object.entries(inDefs), ...Object.entries(outDefs)]) {
    if ($defs[id]) throw new Error(`Duplicate contract $defs id: ${id}`);
    // The document declares the dialect once; a fragment-only $id is invalid.
    const { $schema: _dialect, $id: _id, ...rest } = schema as JsonSchema;
    $defs[id] = rest;
  }

  return {
    $schema: JSON_SCHEMA_DIALECT,
    version: 1,
    routes,
    mcpTools,
    errorResponse: { $ref: '#/$defs/ErrorResponse' },
    $defs,
  };
}

/**
 * Exact text of generated/contracts.schema.json: valid JSON with one route or
 * tool per line (compact entries keep the file small and diffs readable).
 */
export function renderContractSchemas(): string {
  const doc = toJsonSchemas();
  const entries = (obj: Record<string, unknown>) =>
    Object.entries(obj).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  return [
    '{',
    `  "$schema": ${JSON.stringify(doc.$schema)},`,
    `  "version": ${doc.version},`,
    '  "routes": {',
    entries(doc.routes),
    '  },',
    '  "mcpTools": {',
    entries(doc.mcpTools),
    '  },',
    `  "errorResponse": ${JSON.stringify(doc.errorResponse)},`,
    '  "$defs": {',
    entries(doc.$defs),
    '  }',
    '}',
    '',
  ].join('\n');
}

// ── Compile-time drift checks: every schema matches its TypeScript type ──────

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;
type Out<S extends z.ZodType> = z.output<S>;

export type ContractTypeChecks = [
  Expect<Same<Out<typeof AssetSchema>, Asset>>,
  Expect<Same<Out<typeof AssetSynonymSchema>, AssetSynonym>>,
  Expect<Same<Out<typeof AssetVersionSchema>, AssetVersion>>,
  Expect<Same<Out<typeof VoteSchema>, Vote>>,
  Expect<Same<Out<typeof ExampleQuestionSchema>, ExampleQuestion>>,
  Expect<Same<Out<typeof ConfidenceScoreSchema>, ConfidenceScore>>,
  Expect<Same<Out<typeof FeedbackBatchSchema>, FeedbackBatch>>,
  Expect<Same<Out<typeof CampaignSchema>, Campaign>>,
  Expect<Same<Out<typeof NotificationSchema>, Notification>>,
  Expect<Same<Out<typeof NotificationPreferenceSchema>, NotificationPreference>>,
  Expect<Same<Out<typeof UserActivitySchema>, UserActivity>>,
  Expect<Same<Out<typeof LeaderboardEntrySchema>, LeaderboardEntry>>,
  Expect<Same<Out<typeof UserStatsSchema>, UserStats>>,
  Expect<Same<Out<typeof ExecutiveSummarySchema>, ExecutiveSummary>>,
  Expect<Same<Out<typeof MetricViewSummarySchema>, MetricViewSummary>>,
  Expect<Same<Out<typeof MetricViewColumnSchema>, MetricViewColumn>>,
  Expect<Same<Out<typeof MetricViewDetailSchema>, MetricViewDetail>>,
  Expect<Same<Out<typeof AppGroupMemberSchema>, AppGroupMember>>,
  Expect<Same<Out<typeof AppGroupSchema>, AppGroup>>,
  Expect<Same<Out<typeof AssetSourceSchema>, AssetSource>>,
  Expect<Same<Out<typeof QueryResultSchema>, QueryResult>>,
  Expect<Same<Out<typeof ReviewSkipSchema>, ReviewSkip>>,
  Expect<Same<Out<typeof SkipResponseSchema>, SkipResponse>>,
  Expect<Same<Out<typeof UserSettingsSchema>, UserSettings>>,
  Expect<Same<Out<typeof FeedbackQueueItemSchema>, FeedbackQueueItem>>,
  Expect<Same<Out<typeof EditProposalSchema>, EditProposal>>,
  Expect<Same<Out<typeof ConflictGroupSchema>, ConflictGroup>>,
  Expect<Same<Out<typeof ConflictResolutionResultSchema>, ConflictResolutionResult>>,
  Expect<Same<Out<typeof FeedbackBranchSchema>, FeedbackBranch>>,
  Expect<Same<Out<typeof ReviewCardSchema>, ReviewCard>>,
  Expect<Same<Out<typeof VoteResultSchema>, VoteResult>>,
  Expect<Same<Out<typeof RegisterAssetResultSchema>, RegisterAssetResult>>,
  Expect<Same<Out<typeof FreshnessCheckResultSchema>, FreshnessCheckResult>>,
  Expect<Same<Out<typeof MarkReadResponseSchema>, MarkReadResponse>>,
  Expect<Same<Out<typeof UnreadCountResponseSchema>, UnreadCountResponse>>,
  Expect<Same<Out<typeof MeResponseSchema>, MeResponse>>,
  Expect<Same<Out<typeof ValidateResultSchema>, ValidateResult>>,
  Expect<Same<Out<typeof HealthResponseSchema>, HealthResponse>>,
  Expect<Same<Out<typeof CatalogEntrySchema>, CatalogEntry>>,
  Expect<Same<Out<typeof SchemaEntrySchema>, SchemaEntry>>,
  Expect<Same<Out<typeof ScanSourceResponseSchema>, ScanSourceResponse>>,
  Expect<Same<Out<typeof ImportAssetsResponseSchema>, ImportAssetsResponse>>,
  Expect<Same<Out<typeof ErrorResponseSchema>, ErrorResponse>>,
  Expect<Same<Out<typeof ScoringConfigSchema>, ScoringConfig>>,
  Expect<Same<Out<typeof ShareSlackResponseSchema>, ShareSlackResponse>>,
  Expect<Same<Out<typeof SlackChannelSchema>, SlackChannel>>,
];
