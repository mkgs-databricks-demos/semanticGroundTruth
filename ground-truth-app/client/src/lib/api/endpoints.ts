// client/src/lib/api/endpoints.ts — one async function per route-table row (excl. /health)
// Session 10 · Wave 3 · No enum, no namespace, no default export
// Paths and methods match plan 09 route table character-for-character.

import type {
  AppRuntimeConfig,
  Asset,
  AssetSynonym,
  AssetVersion,
  Campaign,
  ConfidenceScore,
  ExampleQuestion,
  ExecutiveSummary,
  LeaderboardEntry,
  MetricViewDetail,
  MetricViewSummary,
  Notification,
  NotificationPreference,
  QueryResult,
  UserStats,
} from '../../../../shared/contracts';
import type {
  AddGroupMemberBody,
  AdminGroupsResponse,
  AppSettingsDto,
  CampaignListQuery,
  CatalogMetricViewsQuery,
  CatalogMetricViewsResponse,
  CatalogsResponse,
  CatalogSchemasQuery,
  CreateCampaignBody,
  ExampleBody,
  FreshnessCheckResult,
  GetNextQuery,
  ImportAssetsBody,
  ImportAssetsResponse,
  LeaderboardQuery,
  MarkReadBody,
  MarkReadResponse,
  MeResponse,
  MetricViewListQuery,
  NotificationListQuery,
  Paged,
  RegisterAssetBody,
  RegisterAssetResult,
  RegisterSourceBody,
  RegisterSourceResponse,
  ReviewableQuery,
  RunQueryBody,
  ScanSourceResponse,
  SchemasResponse,
  SourcesResponse,
  SynonymBody,
  UnreadCountResponse,
  UpdateCampaignStatusBody,
  UpdateConfigBody,
  UpdatePreferencesBody,
  ValidateResult,
  VoteBody,
  VoteResult,
} from '../../../../shared/contracts';
import type { ReviewCard } from '../../../../shared/contracts';
import type {
  ConflictGroup,
  ConflictResolutionResult,
  ConflictsQuery,
  FeedbackBranch,
  FeedbackBranchListQuery,
  FeedbackQueueItem,
  FeedbackQueueQuery,
  ResolveConflictRequest,
  SkipRequest,
  SkipResponse,
  UpdateFeedbackBranchStatusRequest,
  UpdateUserSettingsRequest,
  UpsertFeedbackBranchRequest,
  UserSettings,
} from '../../../../shared/contracts';

import { apiDelete, apiGet, apiSend } from './http';

// ── User ────────────────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/me');
}

export async function getMySettings(): Promise<UserSettings> {
  return apiGet<UserSettings>('/api/me/settings');
}

export async function updateMySettings(
  body: UpdateUserSettingsRequest,
): Promise<UserSettings> {
  return apiSend<UserSettings>('PUT', '/api/me/settings', body);
}

// ── Review ──────────────────────────────────────────────────────────────

export async function getNextCard(
  query?: GetNextQuery,
): Promise<ReviewCard | null> {
  return apiGet<ReviewCard | null>('/api/review/next', query as Record<string, unknown>);
}

export async function submitVote(body: VoteBody): Promise<VoteResult> {
  return apiSend<VoteResult>('POST', '/api/review/vote', body);
}

/** Skip is not a vote: recorded in app.review_skips, never changes confidence. */
export async function skipCard(body: SkipRequest): Promise<SkipResponse> {
  return apiSend<SkipResponse>('POST', '/api/review/skip', body);
}

export async function synonymAction(
  body: SynonymBody,
): Promise<AssetSynonym[]> {
  return apiSend<AssetSynonym[]>('POST', '/api/review/synonym', body);
}

export async function exampleAction(
  body: ExampleBody,
): Promise<ExampleQuestion[]> {
  return apiSend<ExampleQuestion[]>('POST', '/api/review/example', body);
}

export async function runQuery(body: RunQueryBody): Promise<QueryResult> {
  return apiSend<QueryResult>('POST', '/api/review/run-query', body);
}

export async function getUserStats(): Promise<UserStats> {
  return apiGet<UserStats>('/api/review/stats/me');
}

// ── Leaderboard ─────────────────────────────────────────────────────────

export async function getLeaderboard(
  query?: LeaderboardQuery,
): Promise<LeaderboardEntry[]> {
  return apiGet<LeaderboardEntry[]>('/api/leaderboard', query as Record<string, unknown>);
}

// ── Assets ──────────────────────────────────────────────────────────────

export async function getAssets(
  query?: ReviewableQuery,
): Promise<Paged<Asset>> {
  return apiGet<Paged<Asset>>('/api/assets', query as Record<string, unknown>);
}

export async function getAsset(assetId: string): Promise<Asset> {
  return apiGet<Asset>(`/api/assets/${encodeURIComponent(assetId)}`);
}

export async function getAssetVersions(
  assetId: string,
): Promise<AssetVersion[]> {
  return apiGet<AssetVersion[]>(
    `/api/assets/${encodeURIComponent(assetId)}/versions`,
  );
}

export async function registerAsset(
  body: RegisterAssetBody,
): Promise<RegisterAssetResult> {
  return apiSend<RegisterAssetResult>('POST', '/api/assets/register', body);
}

// ── Campaigns ───────────────────────────────────────────────────────────

export async function getCampaigns(
  query?: CampaignListQuery,
): Promise<Campaign[]> {
  return apiGet<Campaign[]>('/api/campaigns', query as Record<string, unknown>);
}

export async function createCampaign(
  body: CreateCampaignBody,
): Promise<Campaign> {
  return apiSend<Campaign>('POST', '/api/campaigns', body);
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  return apiGet<Campaign>(
    `/api/campaigns/${encodeURIComponent(campaignId)}`,
  );
}

export async function updateCampaignStatus(
  campaignId: string,
  body: UpdateCampaignStatusBody,
): Promise<Campaign> {
  return apiSend<Campaign>(
    'PATCH',
    `/api/campaigns/${encodeURIComponent(campaignId)}/status`,
    body,
  );
}

export async function runFreshnessCheck(): Promise<FreshnessCheckResult> {
  return apiSend<FreshnessCheckResult>(
    'POST',
    '/api/campaigns/freshness-check',
  );
}

// ── Notifications ───────────────────────────────────────────────────────

export async function getNotifications(
  query?: NotificationListQuery,
): Promise<Notification[]> {
  return apiGet<Notification[]>(
    '/api/notifications',
    query as Record<string, unknown>,
  );
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return apiGet<UnreadCountResponse>('/api/notifications/unread-count');
}

export async function markNotificationsRead(
  body: MarkReadBody,
): Promise<MarkReadResponse> {
  return apiSend<MarkReadResponse>('POST', '/api/notifications/read', body);
}

export async function getNotificationPreferences(): Promise<
  NotificationPreference[]
> {
  return apiGet<NotificationPreference[]>('/api/notifications/preferences');
}

export async function updateNotificationPreferences(
  body: UpdatePreferencesBody,
): Promise<NotificationPreference[]> {
  return apiSend<NotificationPreference[]>(
    'PUT',
    '/api/notifications/preferences',
    body,
  );
}

// ── Admin ───────────────────────────────────────────────────────────────

export async function getAdminConfig(): Promise<AppSettingsDto> {
  return apiGet<AppSettingsDto>('/api/admin/config');
}

export async function updateAdminConfig(
  body: UpdateConfigBody,
): Promise<AppSettingsDto> {
  return apiSend<AppSettingsDto>('PUT', '/api/admin/config', body);
}

export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  return apiGet<ExecutiveSummary>('/api/admin/summary');
}

export async function recomputeAsset(
  assetId: string,
): Promise<ConfidenceScore> {
  return apiSend<ConfidenceScore>(
    'POST',
    `/api/admin/recompute/${encodeURIComponent(assetId)}`,
  );
}

// ── Metric Views ────────────────────────────────────────────────────────

export async function getMetricViews(
  query?: MetricViewListQuery,
): Promise<MetricViewSummary[]> {
  return apiGet<MetricViewSummary[]>(
    '/api/metric-views',
    query as Record<string, unknown>,
  );
}

export async function getMetricView(
  fullName: string,
): Promise<MetricViewDetail> {
  return apiGet<MetricViewDetail>(
    `/api/metric-views/${encodeURIComponent(fullName)}`,
  );
}

export async function validateMetricView(
  fullName: string,
): Promise<ValidateResult> {
  return apiSend<ValidateResult>(
    'POST',
    `/api/metric-views/${encodeURIComponent(fullName)}/validate`,
  );
}

// ── Catalog browse (conventions §4) ─────────────────────────────────────

export async function getCatalogs(): Promise<CatalogsResponse> {
  return apiGet<CatalogsResponse>('/api/catalog/catalogs');
}

export async function getCatalogSchemas(
  query: CatalogSchemasQuery,
): Promise<SchemasResponse> {
  return apiGet<SchemasResponse>('/api/catalog/schemas', query as unknown as Record<string, unknown>);
}

export async function getCatalogMetricViews(
  query: CatalogMetricViewsQuery,
): Promise<CatalogMetricViewsResponse> {
  return apiGet<CatalogMetricViewsResponse>(
    '/api/catalog/metric-views',
    query as unknown as Record<string, unknown>,
  );
}

// ── Asset sources (conventions §4) ──────────────────────────────────────

export async function getSources(): Promise<SourcesResponse> {
  return apiGet<SourcesResponse>('/api/sources');
}

export async function registerSource(
  body: RegisterSourceBody,
): Promise<RegisterSourceResponse> {
  return apiSend<RegisterSourceResponse>('POST', '/api/sources', body);
}

export async function scanSource(
  sourceId: string,
): Promise<ScanSourceResponse> {
  return apiSend<ScanSourceResponse>(
    'POST',
    `/api/sources/${encodeURIComponent(sourceId)}/scan`,
  );
}

// ── Import (conventions §4) ─────────────────────────────────────────────

export async function importAssets(
  body: ImportAssetsBody,
): Promise<ImportAssetsResponse> {
  return apiSend<ImportAssetsResponse>('POST', '/api/assets/import', body);
}

// ── Admin: app groups (conventions §3) ──────────────────────────────────

export async function getAdminGroups(): Promise<AdminGroupsResponse> {
  return apiGet<AdminGroupsResponse>('/api/admin/groups');
}

export async function addGroupMember(
  groupName: string,
  body: AddGroupMemberBody,
): Promise<void> {
  return apiSend<void>(
    'POST',
    `/api/admin/groups/${encodeURIComponent(groupName)}/members`,
    body,
  );
}

export async function removeGroupMember(
  groupName: string,
  memberId: string,
): Promise<void> {
  return apiDelete<void>(
    `/api/admin/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(memberId)}`,
  );
}

// ── Steward triage (session 33 routes) ──────────────────────────────────

export async function getFeedbackQueue(
  query?: Partial<FeedbackQueueQuery>,
): Promise<Paged<FeedbackQueueItem>> {
  return apiGet<Paged<FeedbackQueueItem>>('/api/steward/feedback-queue', query as Record<string, unknown>);
}

export async function getConflicts(
  query?: ConflictsQuery,
): Promise<ConflictGroup[]> {
  return apiGet<ConflictGroup[]>('/api/steward/conflicts', query as Record<string, unknown>);
}

export async function resolveConflict(
  assetId: string,
  body: ResolveConflictRequest,
): Promise<ConflictResolutionResult> {
  return apiSend<ConflictResolutionResult>(
    'POST',
    `/api/steward/conflicts/${encodeURIComponent(assetId)}/resolve`,
    body,
  );
}

export async function getFeedbackBranches(
  query?: FeedbackBranchListQuery,
): Promise<FeedbackBranch[]> {
  return apiGet<FeedbackBranch[]>('/api/steward/feedback-branches', query as Record<string, unknown>);
}

/** Admin only (the feedback job's M2M principal); 201 created / 200 updated. */
export async function upsertFeedbackBranch(
  body: UpsertFeedbackBranchRequest,
): Promise<FeedbackBranch> {
  return apiSend<FeedbackBranch>('POST', '/api/steward/feedback-branches', body);
}

export async function updateFeedbackBranchStatus(
  batchId: string,
  body: UpdateFeedbackBranchStatusRequest,
): Promise<FeedbackBranch> {
  return apiSend<FeedbackBranch>(
    'POST',
    `/api/steward/feedback-branches/${encodeURIComponent(batchId)}/status`,
    body,
  );
}

/** Grouped view of the session-33 endpoints (plain object, not a TS namespace). */
export const api = {
  review: { skip: skipCard },
  me: { getSettings: getMySettings, updateSettings: updateMySettings },
  steward: {
    feedbackQueue: getFeedbackQueue,
    conflicts: getConflicts,
    resolveConflict,
    feedbackBranches: getFeedbackBranches,
    upsertFeedbackBranch,
    updateFeedbackBranchStatus,
  },
} as const;

// ── Runtime config (session 20 route) ───────────────────────────────────

export async function getRuntimeConfig(): Promise<AppRuntimeConfig> {
  return apiGet<AppRuntimeConfig>('/api/config');
}
