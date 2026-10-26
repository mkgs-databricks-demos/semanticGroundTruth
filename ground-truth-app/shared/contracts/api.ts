// shared/contracts/api.ts — zod schemas + inferred types for every REST route
// Session 01 · Wave 0 · No enum, no namespace, no default export
// Query-string schemas use z.coerce for numbers/booleans (Express values are strings).

import { z } from 'zod';
import type {
  AppGroup,
  AssetSource,
  AssetSynonym,
  ConfidenceScore,
  ExampleQuestion,
  MetricViewSummary,
  Vote,
} from './entities';
import type { ReviewCard } from './review';
import {
  APP_GROUP_NAMES,
  ASSET_STATUSES,
  ASSET_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  CARDS_PER_SESSION_MAX,
  CARDS_PER_SESSION_MIN,
  COMPLETION_RULES,
  CONFLICT_RESOLUTIONS,
  DENSITIES,
  ENVIRONMENTS,
  FEEDBACK_BATCH_STATUSES,
  FEEDBACK_BRANCH_REVIEW_STATUSES,
  MOTION_PREFS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
  SKIP_COOLDOWN_HOURS_MAX,
  SKIP_COOLDOWN_HOURS_MIN,
  SKIP_REASONS,
  THEMES,
  VOTE_TYPES,
} from './values';
import type { AssetStatus, Role } from './values';

// ── Shared primitives ───────────────────────────────────────────────────

const uuid = z.string().uuid();

// ── Review: GET /api/review/next ───────────────────────────────────────

export const GetNextQuerySchema = z.object({
  campaignId: uuid.optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
});
export type GetNextQuery = z.infer<typeof GetNextQuerySchema>;
export type GetNextResponse = ReviewCard | null;

// ── Review: POST /api/review/vote ──────────────────────────────────────

export const VoteBodySchema = z.object({
  assetId: uuid,
  voteType: z.enum(VOTE_TYPES),
  feedback: z.string().max(4000).optional(),
  edits: z.object({
    description: z.string().optional(),
    plainEnglishLogic: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
});
export type VoteBody = z.infer<typeof VoteBodySchema>;

export interface VoteResult {
  vote: Vote;
  confidence: ConfidenceScore;
  assetStatus: AssetStatus;
  next?: ReviewCard | null;
}

// ── Review: POST /api/review/synonym ───────────────────────────────────

export const SynonymBodySchema = z.object({
  assetId: uuid,
  action: z.enum(['add', 'remove', 'approve', 'reject']),
  synonym: z.string().min(1).max(200),
});
export type SynonymBody = z.infer<typeof SynonymBodySchema>;
export type SynonymResponse = AssetSynonym[];

// ── Review: POST /api/review/example ───────────────────────────────────

export const ExampleBodySchema = z.object({
  assetId: uuid,
  action: z.enum(['add', 'approve', 'reject']),
  questionText: z.string().min(1).optional(),
  questionId: uuid.optional(),
}).refine(
  (d) => d.action === 'add' ? !!d.questionText : !!d.questionId,
  { message: 'add requires questionText; approve/reject require questionId' },
);
export type ExampleBody = z.infer<typeof ExampleBodySchema>;
export type ExampleResponse = ExampleQuestion[];

// ── Review: POST /api/review/run-query ────────────────────────────────

export const RunQueryBodySchema = z.object({
  assetId: uuid,
});
export type RunQueryBody = z.infer<typeof RunQueryBodySchema>;
// Response: QueryResult (from entities)

// ── Campaigns: POST /api/campaigns ─────────────────────────────────────

export const CreateCampaignBodySchema = z.object({
  name: z.string().min(1),
  campaignType: z.enum(CAMPAIGN_TYPES),
  scopeDomain: z.string().optional(),
  scopeSubdomain: z.string().optional(),
  scopeAssetType: z.enum(ASSET_TYPES).optional(),
  scopeAssetIds: z.array(uuid).optional(),
  rbacGroups: z.array(z.string()).optional(),
  freshnessIntervalDays: z.number().int().positive().optional(),
  completionRule: z.enum(COMPLETION_RULES).optional(),
});
export type CreateCampaignBody = z.infer<typeof CreateCampaignBodySchema>;

// ── Campaigns: PATCH /api/campaigns/:id/status ────────────────────────

export const UpdateCampaignStatusBodySchema = z.object({
  status: z.enum(CAMPAIGN_STATUSES),
});
export type UpdateCampaignStatusBody = z.infer<typeof UpdateCampaignStatusBodySchema>;

// ── Campaigns: GET /api/campaigns ──────────────────────────────────────

export const CampaignListQuerySchema = z.object({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
});
export type CampaignListQuery = z.infer<typeof CampaignListQuerySchema>;

// ── Campaigns: POST /api/campaigns/freshness-check ────────────────────

export interface FreshnessCheckResult {
  campaignId: string | null;
  added: number;
}

// ── Assets: POST /api/assets/register ──────────────────────────────────

export const RegisterAssetBodySchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  name: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  plainEnglishLogic: z.string().optional(),
  yamlContent: z.string(),
  repoUrl: z.string().url().optional(),
  fixturePath: z.string().optional(),
  branch: z.string().optional(),
  environment: z.enum(ENVIRONMENTS),
  targetCatalog: z.string().min(1),
  targetSchema: z.string().min(1),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  exampleQuestions: z.array(z.string()).optional(),
});
export type RegisterAssetBody = z.infer<typeof RegisterAssetBodySchema>;

export interface RegisterAssetResult {
  asset: import('./entities').Asset;
  created: boolean;
  newVersion: boolean;
}

// ── Assets: GET /api/assets ────────────────────────────────────────────

export const ReviewableQuerySchema = z.object({
  assetType: z.enum(ASSET_TYPES).optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ReviewableQuery = z.infer<typeof ReviewableQuerySchema>;

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Notifications: PATCH /api/notifications/preferences ────────────────

export const UpdatePreferencesBodySchema = z.object({
  preferences: z.array(z.object({
    eventType: z.enum(NOTIFICATION_EVENT_TYPES),
    channels: z.array(z.enum(NOTIFICATION_CHANNELS)),
    digest: z.boolean(),
  })),
});
export type UpdatePreferencesBody = z.infer<typeof UpdatePreferencesBodySchema>;

// ── Notifications: POST /api/notifications/mark-read ──────────────────

export const MarkReadBodySchema = z.object({
  ids: z.union([z.array(uuid).min(1), z.literal('all')]),
});
export type MarkReadBody = z.infer<typeof MarkReadBodySchema>;

export interface MarkReadResponse {
  updated: number;
}

// ── Notifications: GET /api/notifications/unread-count ─────────────────

export interface UnreadCountResponse {
  count: number;
}

// ── Notifications: GET /api/notifications ──────────────────────────────

export const NotificationListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

// ── Config: PATCH /api/config ──────────────────────────────────────────

export const UpdateConfigBodySchema = z.object({
  wilsonZ: z.number().positive().optional(),
  industryPrior: z.number().min(0).max(1).optional(),
  priorWeight: z.number().positive().optional(),
  priorDecayThreshold: z.number().int().positive().optional(),
  certificationThreshold: z.number().min(0).max(1).optional(),
  minVotesForCertification: z.number().int().positive().optional(),
  stalenessDays: z.number().int().positive().optional(),
  freshnessIntervalDays: z.number().int().positive().optional(),
  skipCooldownHours: z.number().int().min(SKIP_COOLDOWN_HOURS_MIN).max(SKIP_COOLDOWN_HOURS_MAX).optional(),
  adminEmails: z.array(z.string().email()).optional(),
  stewardEmails: z.array(z.string().email()).optional(),
});
export type UpdateConfigBody = z.infer<typeof UpdateConfigBodySchema>;

// Alias for AppSettingsDto shape (same as AppSettings minus seedSampleAssets)
export type AppSettingsDto = UpdateConfigBody;

// ── User: GET /api/me ─────────────────────────────────────────────────

export interface MeResponse {
  userId: string;
  email: string;
  displayName: string;
  roles: Role[];
}

// ── Leaderboard: GET /api/leaderboard ──────────────────────────────────

export const LeaderboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', 'all']).default('7d'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

// ── Metric views: GET /api/metric-views ────────────────────────────────

export const MetricViewListQuerySchema = z.object({
  catalog: z.string().optional(),
  schema: z.string().optional(),
});
export type MetricViewListQuery = z.infer<typeof MetricViewListQuerySchema>;

// ── Metric views: POST /api/metric-views/:fullName/validate ────────────

export interface ValidateResult {
  valid: boolean;
  error?: string;
}

// ── Health: GET /health ────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: boolean;
  migrations: number;
  version: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Catalog browse (conventions §4)
// ──────────────────────────────────────────────────────────────────────────

// ── Catalog: GET /api/catalog/catalogs ─────────────────────────────────

export interface CatalogEntry {
  name: string;
  comment: string | null;
}

export type CatalogsResponse = CatalogEntry[];

// ── Catalog: GET /api/catalog/schemas?catalog= ────────────────────────

export const CatalogSchemasQuerySchema = z.object({
  catalog: z.string().min(1),
});
export type CatalogSchemasQuery = z.infer<typeof CatalogSchemasQuerySchema>;

export interface SchemaEntry {
  name: string;
  fullName: string;
  comment: string | null;
}

export type SchemasResponse = SchemaEntry[];

// ── Catalog: GET /api/catalog/metric-views?catalog=&schema= ───────────

export const CatalogMetricViewsQuerySchema = z.object({
  catalog: z.string().min(1),
  schema: z.string().min(1),
});
export type CatalogMetricViewsQuery = z.infer<typeof CatalogMetricViewsQuerySchema>;

export type CatalogMetricViewsResponse = MetricViewSummary[];

// ──────────────────────────────────────────────────────────────────────────
// Asset sources (conventions §4)
// ──────────────────────────────────────────────────────────────────────────

// ── Sources: GET /api/sources ─────────────────────────────────────────

export type SourcesResponse = AssetSource[];

// ── Sources: POST /api/sources ────────────────────────────────────────

const noTraversalGlob = z.string().min(1).refine(
  (g) => !g.includes('..'),
  { message: 'Glob must not contain ".."' },
);

export const RegisterSourceBodySchema = z.object({
  workspacePath: z.string().min(1),
  displayName: z.string().min(1).optional(),
  metricViewGlob: noTraversalGlob.optional(),
  glossaryGlob: noTraversalGlob.optional(),
});
export type RegisterSourceBody = z.infer<typeof RegisterSourceBodySchema>;

export type RegisterSourceResponse = AssetSource;

// ── Sources: POST /api/sources/:id/scan ───────────────────────────────

export interface ScanMetricViewFile {
  filePath: string;
  viewName: string;
}

export interface ScanGlossaryTerm {
  filePath: string;
  term: string;
  domain?: string;
  subdomain?: string;
  definition: string;
}

export interface ScanSourceResponse {
  metricViewFiles: ScanMetricViewFile[];
  glossaryTerms: ScanGlossaryTerm[];
}

// ──────────────────────────────────────────────────────────────────────────
// Import (conventions §4)
// ──────────────────────────────────────────────────────────────────────────

const fqn = z.string().regex(
  /^[^.\s]+\.[^.\s]+\.[^.\s]+$/,
  'Must be a fully qualified name: catalog.schema.name',
);

// ── Import: POST /api/assets/import ───────────────────────────────────

export const ImportGlossaryTermSchema = z.object({
  sourceId: uuid,
  filePath: z.string().min(1),
  term: z.string().min(1),
});
export type ImportGlossaryTerm = z.infer<typeof ImportGlossaryTermSchema>;

export const ImportAssetsBodySchema = z.object({
  metricViews: z.array(fqn).optional(),
  sourceId: uuid.optional(),
  glossaryTerms: z.array(ImportGlossaryTermSchema).optional(),
}).refine(
  (d) => (d.metricViews && d.metricViews.length > 0) || (d.glossaryTerms && d.glossaryTerms.length > 0),
  { message: 'At least one of metricViews or glossaryTerms must be provided' },
);
export type ImportAssetsBody = z.infer<typeof ImportAssetsBodySchema>;

export interface ImportAssetsResponse {
  created: string[];
  updated: string[];
  skipped: { ref: string; reason: string }[];
}

// ──────────────────────────────────────────────────────────────────────────
// Admin: app groups (conventions §3)
// ──────────────────────────────────────────────────────────────────────────

// ── Admin: GET /api/admin/groups ──────────────────────────────────────

export type AdminGroupsResponse = AppGroup[];

// ── Admin: POST /api/admin/groups/:name/members ──────────────────────

export const AddGroupMemberBodySchema = z.object({
  memberId: z.string().min(1),
});
export type AddGroupMemberBody = z.infer<typeof AddGroupMemberBodySchema>;

export const GroupNameParamSchema = z.object({
  name: z.enum(APP_GROUP_NAMES),
});
export type GroupNameParam = z.infer<typeof GroupNameParamSchema>;

// ── Admin: DELETE /api/admin/groups/:name/members/:memberId ──────────

export const RemoveGroupMemberParamSchema = z.object({
  name: z.enum(APP_GROUP_NAMES),
  memberId: z.string().min(1),
});
export type RemoveGroupMemberParam = z.infer<typeof RemoveGroupMemberParamSchema>;

// ──────────────────────────────────────────────────────────────────────
// Path params (plan 25: one schema per path param set)
// ──────────────────────────────────────────────────────────────────────

export const AssetIdParamSchema = z.object({ assetId: uuid });
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;

export const CampaignIdParamSchema = z.object({ campaignId: uuid });
export type CampaignIdParam = z.infer<typeof CampaignIdParamSchema>;

export const SourceIdParamSchema = z.object({ id: uuid });
export type SourceIdParam = z.infer<typeof SourceIdParamSchema>;

export const MetricViewFullNameParamSchema = z.object({ fullName: z.string().min(1) });
export type MetricViewFullNameParam = z.infer<typeof MetricViewFullNameParamSchema>;

export const BatchIdParamSchema = z.object({ batchId: uuid });
export type BatchIdParam = z.infer<typeof BatchIdParamSchema>;

// ──────────────────────────────────────────────────────────────────────
// Skips (plan 25; route in session 33)
// ──────────────────────────────────────────────────────────────────────

// ── Review: POST /api/review/skip ───────────────────────────────────────

export const SkipRequestSchema = z.object({
  assetId: uuid,
  campaignId: uuid.optional(),
  reason: z.enum(SKIP_REASONS).optional(),
});
export type SkipRequest = z.infer<typeof SkipRequestSchema>;
// Response: SkipResponse (review.ts)

// ──────────────────────────────────────────────────────────────────────
// User settings (plan 25; routes in session 33)
// ──────────────────────────────────────────────────────────────────────

// ── Me: PUT /api/me/settings (partial update, upsert) ───────────────────

export const UpdateUserSettingsRequestSchema = z.object({
  theme: z.enum(THEMES).optional(),
  density: z.enum(DENSITIES).optional(),
  motion: z.enum(MOTION_PREFS).optional(),
  defaultCampaignId: uuid.nullable().optional(),
  defaultAssetType: z.enum(ASSET_TYPES).nullable().optional(),
  showKeyboardHints: z.boolean().optional(),
  cardsPerSession: z.number().int().min(CARDS_PER_SESSION_MIN).max(CARDS_PER_SESSION_MAX).optional(),
}).strict().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one setting must be provided' },
);
export type UpdateUserSettingsRequest = z.infer<typeof UpdateUserSettingsRequestSchema>;
// Response (GET and PUT): UserSettings (entities)

// ──────────────────────────────────────────────────────────────────────
// Steward triage (plan 25; routes in session 33)
// ──────────────────────────────────────────────────────────────────────

// ── Steward: GET /api/steward/feedback-queue ───────────────────────────

export const FeedbackQueueQuerySchema = z.object({
  campaignId: uuid.optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
  status: z.enum(['pending', 'all']).default('pending'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type FeedbackQueueQuery = z.infer<typeof FeedbackQueueQuerySchema>;
// Response: Paged<FeedbackQueueItem>

// ── Steward: GET /api/steward/conflicts ────────────────────────────────

export const ConflictsQuerySchema = z.object({
  campaignId: uuid.optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
});
export type ConflictsQuery = z.infer<typeof ConflictsQuerySchema>;
// Response: ConflictGroup[]

// ── Steward: POST /api/steward/conflicts/:assetId/resolve ───────────────

export const ResolveConflictRequestSchema = z.object({
  resolution: z.enum(CONFLICT_RESOLUTIONS),
  voteId: uuid.optional(),
  note: z.string().max(4000).optional(),
}).refine(
  (d) => d.resolution !== 'accept_edit' || !!d.voteId,
  { message: 'accept_edit requires voteId (the edit vote to accept)' },
);
export type ResolveConflictRequest = z.infer<typeof ResolveConflictRequestSchema>;
// Response: ConflictResolutionResult (entities)

// ── Steward: GET /api/steward/feedback-branches ─────────────────────────

export const FeedbackBranchListQuerySchema = z.object({
  status: z.enum(FEEDBACK_BATCH_STATUSES).optional(),
});
export type FeedbackBranchListQuery = z.infer<typeof FeedbackBranchListQuerySchema>;
// Response: FeedbackBranch[]

// ── Steward: POST /api/steward/feedback-branches (admin / feedback job M2M) ─

const feedbackBranchName = z.string().regex(
  /^mg-genie-feedback-\d{8}(-[a-z0-9-]+)?$/,
  'Feedback branch names must be mg-genie-feedback-<yyyymmdd>[-suffix]',
);

export const UpsertFeedbackBranchRequestSchema = z.object({
  batchId: uuid.optional(),
  branchName: feedbackBranchName,
  files: z.array(z.string().min(1)),
  summary: z.string().max(20000).optional(),
  status: z.enum(FEEDBACK_BATCH_STATUSES),
  /** Votes the branch addresses. Marked processed when status is 'proposed'; ignored otherwise. */
  voteIds: z.array(uuid).max(1000).optional(),
});
export type UpsertFeedbackBranchRequest = z.infer<typeof UpsertFeedbackBranchRequestSchema>;
// Response: FeedbackBranch (201 created, 200 updated)

// ── Steward: POST /api/steward/feedback-branches/:batchId/status ────────

export const UpdateFeedbackBranchStatusRequestSchema = z.object({
  status: z.enum(FEEDBACK_BRANCH_REVIEW_STATUSES),
  note: z.string().max(4000).optional(),
});
export type UpdateFeedbackBranchStatusRequest = z.infer<typeof UpdateFeedbackBranchStatusRequestSchema>;
// Response: FeedbackBranch
