// shared/contracts/api.ts — zod schemas + inferred types for every REST route
// Session 01 · Wave 0 · No enum, no namespace, no default export
// Query-string schemas use z.coerce for numbers/booleans (Express values are strings).

import { z } from 'zod';
import type { AssetSynonym, ConfidenceScore, ExampleQuestion, Vote } from './entities';
import type { ReviewCard } from './review';
import {
  ASSET_STATUSES,
  ASSET_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  COMPLETION_RULES,
  ENVIRONMENTS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_TYPES,
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
