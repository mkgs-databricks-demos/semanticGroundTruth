// client/src/lib/api/endpoints.ts — one async function per route-table row (excl. /health)
// Session 10 · Wave 3 · No enum, no namespace, no default export
// Paths and methods match plan 09 route table character-for-character.

import type {
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
  AppSettingsDto,
  CampaignListQuery,
  CreateCampaignBody,
  ExampleBody,
  FreshnessCheckResult,
  GetNextQuery,
  LeaderboardQuery,
  MarkReadBody,
  MarkReadResponse,
  MeResponse,
  MetricViewListQuery,
  NotificationListQuery,
  Paged,
  RegisterAssetBody,
  RegisterAssetResult,
  ReviewableQuery,
  RunQueryBody,
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

import { apiGet, apiSend } from './http';

// ── User ────────────────────────────────────────────────────────────────

export async function getMe(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/me');
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
