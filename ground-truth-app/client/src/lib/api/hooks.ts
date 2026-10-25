// client/src/lib/api/hooks.ts — React Query v5 hooks for every non-health route
// Session 10 · Wave 3 · No enum, no namespace, no default export

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useNotifications(params?: NotificationListQuery) {
  return useQuery({
    queryKey: queryKeys.notifications(params as Record<string, unknown>),
    queryFn: () => getNotifications(params),
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

export function useFeedbackQueue(params?: Partial<FeedbackQueueQuery>) {
  return useQuery({
    queryKey: queryKeys.feedbackQueue(params as Record<string, unknown>),
    queryFn: () => getFeedbackQueue(params),
  });
}

export function useConflicts(params?: ConflictsQuery) {
  return useQuery({
    queryKey: queryKeys.conflicts(params as Record<string, unknown>),
    queryFn: () => getConflicts(params),
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

export function useFeedbackBranches(params?: FeedbackBranchListQuery) {
  return useQuery({
    queryKey: queryKeys.feedbackBranches(params as Record<string, unknown>),
    queryFn: () => getFeedbackBranches(params),
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
