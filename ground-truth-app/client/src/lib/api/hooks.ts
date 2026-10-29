// client/src/lib/api/hooks.ts — React Query v5 hooks for every non-health route
// Session 10 · Wave 3 · No enum, no namespace, no default export
// Session 49 · Build 5 · wave 5-1: review session counters, steward badge
// counts, `enabled` option on the steward lists, Share to Slack hooks.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type {
  AddGroupMemberBody,
  CampaignListQuery,
  CatalogMetricViewsQuery,
  CatalogSchemasQuery,
  GetNextQuery,
  ImportAssetsBody,
  LeaderboardQuery,
  MetricViewListQuery,
  NotificationListQuery,
  RegisterSourceBody,
  ReviewableQuery,
  UpdateCampaignStatusBody,
  ConflictsQuery,
  FeedbackBranchListQuery,
  FeedbackQueueQuery,
  ResolveConflictRequest,
  UpdateFeedbackBranchStatusRequest,
  ShareSlackRequest,
  SlackChannelsQuery,
} from '../../../../shared/contracts';

import {
  addGroupMember,
  createCampaign,
  exampleAction,
  getAdminConfig,
  getAdminGroups,
  getAsset,
  getAssets,
  getAssetVersions,
  getCampaign,
  getCampaigns,
  getCatalogMetricViews,
  getCatalogs,
  getCatalogSchemas,
  getExecutiveSummary,
  getLeaderboard,
  getMe,
  getMetricView,
  getMetricViews,
  getNextCard,
  getNotificationPreferences,
  getNotifications,
  getRuntimeConfig,
  getSources,
  getUnreadCount,
  getUserStats,
  importAssets,
  markNotificationsRead,
  recomputeAsset,
  registerAsset,
  registerSource,
  removeGroupMember,
  runFreshnessCheck,
  runQuery,
  scanSource,
  submitVote,
  synonymAction,
  updateAdminConfig,
  updateCampaignStatus,
  updateNotificationPreferences,
  validateMetricView,
  skipCard,
  getMySettings,
  updateMySettings,
  getFeedbackQueue,
  getConflicts,
  resolveConflict,
  getFeedbackBranches,
  updateFeedbackBranchStatus,
  getSlackChannels,
  shareNotificationToSlack,
  shareAssetToSlack,
} from './endpoints';
import { queryKeys } from './keys';

// ─────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
  });
}

export function useNextCard(params?: GetNextQuery) {
  return useQuery({
    queryKey: queryKeys.nextCard(params as Record<string, unknown>),
    queryFn: () => getNextCard(params),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.userStats,
    queryFn: getUserStats,
  });
}

export function useLeaderboard(params?: LeaderboardQuery) {
  return useQuery({
    queryKey: queryKeys.leaderboard(params as Record<string, unknown>),
    queryFn: () => getLeaderboard(params),
  });
}

export function useAssets(params?: ReviewableQuery) {
  return useQuery({
    queryKey: queryKeys.assets(params as Record<string, unknown>),
    queryFn: () => getAssets(params),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: queryKeys.asset(id),
    queryFn: () => getAsset(id),
  });
}

export function useAssetVersions(id: string) {
  return useQuery({
    queryKey: queryKeys.assetVersions(id),
    queryFn: () => getAssetVersions(id),
  });
}

export function useCampaigns(params?: CampaignListQuery) {
  return useQuery({
    queryKey: queryKeys.campaigns(params as Record<string, unknown>),
    queryFn: () => getCampaigns(params),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => getCampaign(id),
  });
}

export function useNotifications(params?: NotificationListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications(params as Record<string, unknown>),
    queryFn: () => getNotifications(params),
    enabled: options?.enabled ?? true,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: getNotificationPreferences,
  });
}

export function useAdminConfig() {
  return useQuery({
    queryKey: queryKeys.adminConfig,
    queryFn: getAdminConfig,
  });
}

export function useExecutiveSummary() {
  return useQuery({
    queryKey: queryKeys.executiveSummary,
    queryFn: getExecutiveSummary,
  });
}

export function useMetricViews(params?: MetricViewListQuery) {
  return useQuery({
    queryKey: queryKeys.metricViews(params as Record<string, unknown>),
    queryFn: () => getMetricViews(params),
  });
}

export function useMetricView(name: string) {
  return useQuery({
    queryKey: queryKeys.metricView(name),
    queryFn: () => getMetricView(name),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────

export function useSubmitVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitVote,
    onSuccess: (result) => {
      bumpReviewSession(queryClient, 'reviewed');
      if ('next' in result) {
        queryClient.setQueryData(queryKeys.nextCard(), result.next ?? null);
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useSynonymAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: synonymAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useExampleAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: exampleAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useRunQuery() {
  return useMutation({
    mutationFn: runQuery,
  });
}

export function useRegisterAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { campaignId: string; body: UpdateCampaignStatusBody }) =>
      updateCampaignStatus(vars.campaignId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useRunFreshnessCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runFreshnessCheck,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}

export function useUpdateAdminConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminConfig });
    },
  });
}

export function useRecomputeAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recomputeAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
    },
  });
}

export function useValidateMetricView() {
  return useMutation({
    mutationFn: validateMetricView,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Catalog browse
// ─────────────────────────────────────────────────────────────────────

export function useCatalogs() {
  return useQuery({
    queryKey: queryKeys.catalogs,
    queryFn: getCatalogs,
  });
}

export function useCatalogSchemas(query: CatalogSchemasQuery) {
  return useQuery({
    queryKey: queryKeys.catalogSchemas(query.catalog),
    queryFn: () => getCatalogSchemas(query),
    enabled: !!query.catalog,
  });
}

export function useCatalogMetricViews(query: CatalogMetricViewsQuery) {
  return useQuery({
    queryKey: queryKeys.catalogMetricViews(query.catalog, query.schema),
    queryFn: () => getCatalogMetricViews(query),
    enabled: !!query.catalog && !!query.schema,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Asset sources
// ─────────────────────────────────────────────────────────────────────

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: getSources,
  });
}

export function useRegisterSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterSourceBody) => registerSource(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sources });
    },
  });
}

export function useScanSource() {
  return useMutation({
    mutationFn: (sourceId: string) => scanSource(sourceId),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────────────

export function useImportAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportAssetsBody) => importAssets(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Admin groups
// ─────────────────────────────────────────────────────────────────────

export function useAdminGroups() {
  return useQuery({
    queryKey: queryKeys.adminGroups,
    queryFn: getAdminGroups,
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { groupName: string; body: AddGroupMemberBody }) =>
      addGroupMember(vars.groupName, vars.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminGroups });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { groupName: string; memberId: string }) =>
      removeGroupMember(vars.groupName, vars.memberId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.adminGroups });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Runtime config
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Skip, user settings, steward triage (session 33)
// ─────────────────────────────────────────────────────────────────────

/** Skip the current card: refetch the next card (the skipped one is in cooldown) and stats. */
export function useSkipCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skipCard,
    onSuccess: () => {
      bumpReviewSession(queryClient, 'skipped');
      void queryClient.invalidateQueries({ queryKey: ['review', 'next'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useMySettings() {
  return useQuery({
    queryKey: queryKeys.mySettings,
    queryFn: getMySettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateMySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMySettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.mySettings, settings);
    },
  });
}

/** Options shared by the steward list hooks (e.g. wait until `GET /api/me` says steward). */
export interface QueryToggle {
  enabled?: boolean;
}

export function useFeedbackQueue(params?: Partial<FeedbackQueueQuery>, options?: QueryToggle) {
  return useQuery({
    queryKey: queryKeys.feedbackQueue(params as Record<string, unknown>),
    queryFn: () => getFeedbackQueue(params),
    enabled: options?.enabled ?? true,
  });
}

export function useConflicts(params?: ConflictsQuery, options?: QueryToggle) {
  return useQuery({
    queryKey: queryKeys.conflicts(params as Record<string, unknown>),
    queryFn: () => getConflicts(params),
    enabled: options?.enabled ?? true,
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { assetId: string; body: ResolveConflictRequest }) =>
      resolveConflict(vars.assetId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['steward'] });
    },
  });
}

export function useFeedbackBranches(params?: FeedbackBranchListQuery, options?: QueryToggle) {
  return useQuery({
    queryKey: queryKeys.feedbackBranches(params as Record<string, unknown>),
    queryFn: () => getFeedbackBranches(params),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateFeedbackBranchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { batchId: string; body: UpdateFeedbackBranchStatusRequest }) =>
      updateFeedbackBranchStatus(vars.batchId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['steward', 'feedback-branches'] });
    },
  });
}

export function useRuntimeConfig() {
  return useQuery({
    queryKey: queryKeys.runtimeConfig,
    queryFn: getRuntimeConfig,
    staleTime: 5 * 60_000, // 5 min — rarely changes
  });
}

// ─────────────────────────────────────────────────────────────────────
// Review session counters (build 5, S1 session-complete panel)
// ─────────────────────────────────────────────────────────────────────

/** Cards handled since the session started (votes + skips), client-side only. */
export interface ReviewSessionStats {
  reviewed: number;
  skipped: number;
  /** reviewed + skipped: compared with UserSettings.cardsPerSession. */
  total: number;
}

export const EMPTY_REVIEW_SESSION: ReviewSessionStats = { reviewed: 0, skipped: 0, total: 0 };

function readReviewSession(qc: QueryClient): ReviewSessionStats {
  return qc.getQueryData<ReviewSessionStats>(queryKeys.reviewSession) ?? EMPTY_REVIEW_SESSION;
}

function bumpReviewSession(qc: QueryClient, field: 'reviewed' | 'skipped'): void {
  const current = readReviewSession(qc);
  const next = { ...current, [field]: current[field] + 1 };
  qc.setQueryData<ReviewSessionStats>(queryKeys.reviewSession, { ...next, total: next.reviewed + next.skipped });
}

/**
 * Votes and skips sent in this browser session (useSubmitVote / useSkipCard
 * count them on success). Never fetched: an invalidation just re-reads the
 * cache. `reset()` starts a new session ("Keep going").
 */
export function useReviewSessionStats() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.reviewSession,
    queryFn: () => readReviewSession(queryClient),
    initialData: () => readReviewSession(queryClient),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const reset = () => {
    queryClient.setQueryData<ReviewSessionStats>(queryKeys.reviewSession, EMPTY_REVIEW_SESSION);
  };
  return { ...(data ?? EMPTY_REVIEW_SESSION), reset };
}

// ─────────────────────────────────────────────────────────────────────
// Steward sub-nav badge counts (build 5, S0)
// ─────────────────────────────────────────────────────────────────────

/** `null` while loading or when the list request failed (the badge is hidden). */
export interface StewardBadgeCounts {
  /** Assets waiting for triage: Paged total of the pending feedback queue. */
  feedbackQueue: number | null;
  /** Assets with competing edit proposals. */
  conflicts: number | null;
  /** Feedback branches waiting for a steward (status `proposed`). */
  feedbackBranches: number | null;
}

/** Badge counts from the three steward list endpoints; no request unless `enabled`. */
export function useStewardBadgeCounts(enabled: boolean): StewardBadgeCounts {
  const queue = useFeedbackQueue(undefined, { enabled });
  const conflicts = useConflicts(undefined, { enabled });
  const branches = useFeedbackBranches(undefined, { enabled });
  return {
    feedbackQueue: queue.data ? queue.data.total : null,
    conflicts: conflicts.data ? conflicts.data.length : null,
    feedbackBranches: branches.data
      ? branches.data.filter((b) => b.status === 'proposed').length
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Share to Slack (G5 Option A; UI in session 56)
// ─────────────────────────────────────────────────────────────────────

/** Channel search for the share dialog; the caller debounces `query`. */
export function useSlackChannels(params?: SlackChannelsQuery, options?: QueryToggle) {
  const q = params?.query?.trim() ?? '';
  return useQuery({
    queryKey: queryKeys.slackChannels(q),
    queryFn: () => getSlackChannels(q ? { query: q } : undefined),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useShareNotificationToSlack() {
  return useMutation({
    mutationFn: (vars: { notificationId: string; body: ShareSlackRequest }) =>
      shareNotificationToSlack(vars.notificationId, vars.body),
  });
}

export function useShareAssetToSlack() {
  return useMutation({
    mutationFn: (vars: { assetId: string; body: ShareSlackRequest }) =>
      shareAssetToSlack(vars.assetId, vars.body),
  });
}
