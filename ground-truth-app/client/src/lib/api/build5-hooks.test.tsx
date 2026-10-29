// @a11y-strict
// client/src/lib/api/build5-hooks.test.tsx — every build-5 hook against mockApi
// Session 49 · Build 5 · wave 5-1 (plan 49 step 4). Each test checks the
// request the hook sends (method, path, query, body) and the data it exposes;
// mockApi validates every fixture and request body against ROUTE_CONTRACTS.

import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { calls, mockApi } from '../../test/mockApi';
import { createTestQueryClient } from '../../test/render';
import {
  IDS,
  branchProposed,
  conflicts,
  conflictsRoutes,
  feedbackBranches,
  feedbackBranchesRoutes,
  feedbackQueue,
  feedbackQueueEmpty,
  feedbackQueueRoutes,
  notifications,
  resolutionAcceptEdit,
  settingsRoutes,
  userSettings,
} from '../../test/fixtures';
import { reviewRoutes } from '../../test/fixtures/review';
import {
  EMPTY_REVIEW_SESSION,
  useConflicts,
  useFeedbackBranches,
  useFeedbackQueue,
  useMySettings,
  useNotifications,
  useResolveConflict,
  useReviewSessionStats,
  useShareAssetToSlack,
  useShareNotificationToSlack,
  useSkipCard,
  useSlackChannels,
  useStewardBadgeCounts,
  useSubmitVote,
  useUpdateFeedbackBranchStatus,
  useUpdateMySettings,
} from './hooks';
import { queryKeys } from './keys';

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function setup<T>(hook: () => T) {
  const client = createTestQueryClient();
  const view = renderHook(hook, { wrapper: wrapperFor(client) });
  return { ...view, client };
}

describe('settings hooks', () => {
  it('useMySettings reads GET /api/me/settings', async () => {
    mockApi(settingsRoutes);
    const { result } = setup(() => useMySettings());
    await waitFor(() => expect(result.current.data).toEqual(userSettings));
    expect(calls('GET /api/me/settings')).toHaveLength(1);
  });

  it('useUpdateMySettings PUTs the patch and caches the response', async () => {
    mockApi(settingsRoutes);
    const { result, client } = setup(() => useUpdateMySettings());
    await act(() => result.current.mutateAsync({ theme: 'dark' }));
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ theme: 'dark' });
    expect(client.getQueryData(queryKeys.mySettings)).toEqual(userSettings);
  });
});

describe('review session counters', () => {
  it('counts successful votes and skips; reset() starts over', async () => {
    mockApi(reviewRoutes);
    const { result } = setup(() => ({
      stats: useReviewSessionStats(),
      vote: useSubmitVote(),
      skip: useSkipCard(),
    }));
    expect(result.current.stats.total).toBe(0);

    await act(() => result.current.vote.mutateAsync({ assetId: IDS.assets.readmissionRate, voteType: 'approve' }));
    await act(() => result.current.skip.mutateAsync({ assetId: IDS.assets.lengthOfStay }));
    await act(() => result.current.skip.mutateAsync({ assetId: IDS.assets.dischargeDisposition, reason: 'not_my_area' }));

    await waitFor(() => expect(result.current.stats).toMatchObject({ reviewed: 1, skipped: 2, total: 3 }));
    expect(calls('POST /api/review/skip')[1].body).toEqual({ assetId: IDS.assets.dischargeDisposition, reason: 'not_my_area' });

    act(() => result.current.stats.reset());
    await waitFor(() => expect(result.current.stats).toMatchObject(EMPTY_REVIEW_SESSION));
  });

  it('does not count a failed skip', async () => {
    mockApi().error('POST /api/review/skip', 404, 'NOT_FOUND', 'Asset not found');
    const { result } = setup(() => ({ stats: useReviewSessionStats(), skip: useSkipCard() }));
    await act(async () => {
      await result.current.skip.mutateAsync({ assetId: IDS.assets.lengthOfStay }).catch(() => undefined);
    });
    expect(result.current.stats.total).toBe(0);
  });

  it('survives an invalidation of the review keys without a request', async () => {
    mockApi(reviewRoutes);
    const { result, client } = setup(() => ({ stats: useReviewSessionStats(), skip: useSkipCard() }));
    await act(() => result.current.skip.mutateAsync({ assetId: IDS.assets.lengthOfStay }));
    await act(() => client.invalidateQueries({ queryKey: ['review'] }));
    expect(result.current.stats.skipped).toBe(1);
  });
});

describe('steward list hooks', () => {
  it('useFeedbackQueue sends the filters as query params', async () => {
    mockApi(feedbackQueueRoutes);
    const { result } = setup(() => useFeedbackQueue({ status: 'pending', assetType: 'measure', limit: 25 }));
    await waitFor(() => expect(result.current.data).toEqual(feedbackQueue));
    expect(calls('GET /api/steward/feedback-queue')[0].query).toMatchObject({ status: 'pending', assetType: 'measure', limit: '25' });
  });

  it('{ enabled: false } sends nothing', async () => {
    mockApi(feedbackQueueRoutes);
    const { result } = setup(() => useFeedbackQueue(undefined, { enabled: false }));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe('idle');
    expect(calls('GET /api/steward/feedback-queue')).toHaveLength(0);
  });

  it('useConflicts and useResolveConflict', async () => {
    mockApi(conflictsRoutes);
    const { result } = setup(() => ({ list: useConflicts(), resolve: useResolveConflict() }));
    await waitFor(() => expect(result.current.list.data).toEqual(conflicts));
    const voteId = conflicts[0].edits[1].voteId;
    const out = await act(() =>
      result.current.resolve.mutateAsync({ assetId: IDS.assets.readmissionRate, body: { resolution: 'accept_edit', voteId } }),
    );
    expect(out).toEqual(resolutionAcceptEdit);
    const sent = calls('POST /api/steward/conflicts/:assetId/resolve')[0];
    expect(sent.params.assetId).toBe(IDS.assets.readmissionRate);
    expect(sent.body).toEqual({ resolution: 'accept_edit', voteId });
  });

  it('useFeedbackBranches and useUpdateFeedbackBranchStatus', async () => {
    mockApi(feedbackBranchesRoutes);
    const { result } = setup(() => ({ list: useFeedbackBranches(), update: useUpdateFeedbackBranchStatus() }));
    await waitFor(() => expect(result.current.list.data).toEqual(feedbackBranches));
    await act(() => result.current.update.mutateAsync({ batchId: branchProposed.batchId, body: { status: 'in_review' } }));
    const sent = calls('POST /api/steward/feedback-branches/:batchId/status')[0];
    expect(sent.params.batchId).toBe(branchProposed.batchId);
    expect(sent.body).toEqual({ status: 'in_review' });
  });
});

describe('useStewardBadgeCounts', () => {
  it('queue total, conflict groups and proposed branches', async () => {
    mockApi({ ...feedbackQueueRoutes, ...conflictsRoutes, ...feedbackBranchesRoutes });
    const { result } = setup(() => useStewardBadgeCounts(true));
    await waitFor(() =>
      expect(result.current).toEqual({
        feedbackQueue: feedbackQueue.total,
        conflicts: conflicts.length,
        feedbackBranches: feedbackBranches.filter((b) => b.status === 'proposed').length,
      }),
    );
    expect(result.current.feedbackBranches).toBe(1);
  });

  it('null while loading or failed; no requests when disabled', async () => {
    mockApi({ 'GET /api/steward/feedback-queue': feedbackQueueEmpty, ...feedbackBranchesRoutes })
      .pending('GET /api/steward/conflicts')
      .error('GET /api/steward/feedback-branches', 500, 'INTERNAL', 'boom');
    const { result } = setup(() => useStewardBadgeCounts(true));
    await waitFor(() => expect(result.current.feedbackQueue).toBe(0));
    expect(result.current.conflicts).toBeNull();
    await waitFor(() => expect(calls('GET /api/steward/feedback-branches')).toHaveLength(1));
    expect(result.current.feedbackBranches).toBeNull();

    const off = setup(() => useStewardBadgeCounts(false));
    expect(off.result.current).toEqual({ feedbackQueue: null, conflicts: null, feedbackBranches: null });
  });
});

describe('notifications', () => {
  it('useNotifications waits for enabled', async () => {
    mockApi({ 'GET /api/notifications': notifications });
    let enabled = false;
    const { result, rerender } = setup(() => useNotifications({ limit: 20 }, { enabled }));
    expect(calls('GET /api/notifications')).toHaveLength(0);
    enabled = true;
    rerender();
    await waitFor(() => expect(result.current.data).toEqual(notifications));
    expect(calls('GET /api/notifications')[0].query).toMatchObject({ limit: '20' });
  });
});

describe('Share to Slack hooks', () => {
  const channels = [
    { id: 'C0123ABCD', name: 'semantic-layer' },
    { id: 'C0456EFGH', name: 'clinical-quality' },
  ];

  it('useSlackChannels trims the query and omits it when empty', async () => {
    mockApi({ 'GET /api/slack/channels': channels });
    let q = '  ';
    const { result, rerender } = setup(() => useSlackChannels({ query: q }));
    await waitFor(() => expect(result.current.data).toEqual(channels));
    expect(calls('GET /api/slack/channels')[0].query).toEqual({});
    q = ' clin ';
    rerender();
    await waitFor(() => expect(calls('GET /api/slack/channels')).toHaveLength(2));
    expect(calls('GET /api/slack/channels')[1].query).toEqual({ query: 'clin' });
  });

  it('useShareNotificationToSlack posts to the notification', async () => {
    mockApi({ 'POST /api/notifications/:id/share-slack': { status: 'sent', permalink: 'https://example.slack.com/archives/C0123ABCD/p1' } });
    const { result } = setup(() => useShareNotificationToSlack());
    const out = await act(() =>
      result.current.mutateAsync({
        notificationId: IDS.notifications.certified,
        body: { channelId: 'C0123ABCD', mode: 'send', message: 'FYI' },
      }),
    );
    expect(out.status).toBe('sent');
    const sent = calls('POST /api/notifications/:id/share-slack')[0];
    expect(sent.params.id).toBe(IDS.notifications.certified);
    expect(sent.body).toEqual({ channelId: 'C0123ABCD', mode: 'send', message: 'FYI' });
  });

  it('useShareAssetToSlack posts to the asset and surfaces needs_slack_login', async () => {
    mockApi({ 'POST /api/assets/:assetId/share-slack': { status: 'needs_slack_login', loginUrl: 'https://example.cloud.databricks.com/connect/slack' } });
    const { result } = setup(() => useShareAssetToSlack());
    const out = await act(() =>
      result.current.mutateAsync({ assetId: IDS.assets.readmissionRate, body: { channelId: 'C0123ABCD', mode: 'draft' } }),
    );
    expect(out).toEqual({ status: 'needs_slack_login', loginUrl: 'https://example.cloud.databricks.com/connect/slack' });
    expect(calls('POST /api/assets/:assetId/share-slack')[0].params.assetId).toBe(IDS.assets.readmissionRate);
  });

  it('a 403 from the stub rejects with the API message', async () => {
    mockApi().forbidden('POST /api/assets/:assetId/share-slack', 'Stewards only');
    const { result } = setup(() => useShareAssetToSlack());
    await expect(
      act(() => result.current.mutateAsync({ assetId: IDS.assets.readmissionRate, body: { channelId: 'C1', mode: 'send' } })),
    ).rejects.toThrow('Stewards only');
  });
});
