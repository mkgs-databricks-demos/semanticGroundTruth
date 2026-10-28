// @a11y-strict
// client/src/components/steward-triage/FeedbackQueuePage.test.tsx — S8 Feedback queue (all states + KB K3)
// Session 55 · Build 5 · wave 5-3 (ui_test_strategy.md §8 S8 rows)

import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../../../shared/contracts';
import { FeedbackQueuePage } from '../../pages/steward/FeedbackQueuePage';
import { expectNoAxeViolations } from '../../test/axe';
import {
  assetReadmissionRate,
  campaign,
  feedbackQueue,
  feedbackQueueEmpty,
  IDS,
  queueDischargeDisposition,
  queueLengthOfStay,
  queueReadmissionRate,
} from '../../test/fixtures';
import { pressKey } from '../../test/keyboard';
import { calls, mockApi } from '../../test/mockApi';
import type { MockRequest } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { TestTheme } from '../../test/render';
import { ACCESS_ERROR_TITLE, ROLE_GATE_TEST_IDS } from '../access/RoleGate';
import { assetDetailRoutes, ED_BOARDING_ID, queueWithOftenSkipped } from './fixtures';
import { canResolve, isOftenSkipped, OFTEN_SKIPPED, QUEUE_EMPTY_TITLE, QUEUE_FILTERED_EMPTY_TITLE, voteBarLabel } from './labels';

const STEWARD: Role[] = ['reviewer', 'steward'];
const QUEUE = 'GET /api/steward/feedback-queue';

function page(): ReactElement {
  return (
    <Routes>
      <Route path="/steward/feedback-queue" element={<FeedbackQueuePage />} />
      <Route path="/steward/conflicts" element={<p>Conflicts route</p>} />
      <Route path="/steward" element={<p>Steward console route</p>} />
    </Routes>
  );
}

function renderQueue(options: { roles?: Role[]; theme?: TestTheme } = {}) {
  return renderWithProviders(page(), { route: '/steward/feedback-queue', roles: options.roles ?? STEWARD, theme: options.theme });
}

const base = { 'GET /api/campaigns': [campaign], ...assetDetailRoutes };

const rows = () => screen.queryAllByTestId('steward-queue-row');
const row = (assetId: string) => {
  const found = rows().find((r) => r.dataset.assetId === assetId);
  if (!found) throw new Error(`no row ${assetId}`);
  return found;
};
const lastQuery = () => calls(QUEUE).at(-1)?.query ?? {};

async function loaded(n = 3) {
  await waitFor(() => expect(rows()).toHaveLength(n));
}

describe('S8 helpers', () => {
  it('"Often skipped" needs skips >= total votes and at least one skip', () => {
    expect(isOftenSkipped({ skips: 4, votes: { approve: 1, reject: 1, edit: 0 } })).toBe(true);
    expect(isOftenSkipped({ skips: 5, votes: { approve: 8, reject: 2, edit: 3 } })).toBe(false);
    expect(isOftenSkipped({ skips: 0, votes: { approve: 0, reject: 0, edit: 0 } })).toBe(false);
  });

  it('Resolve needs >= 2 pending edits; the vote bar reads as counts', () => {
    expect(canResolve({ pendingEdits: 2 })).toBe(true);
    expect(canResolve({ pendingEdits: 1 })).toBe(false);
    expect(voteBarLabel({ approve: 8, reject: 2, edit: 3 })).toBe('8 approvals, 2 rejections, 3 edits');
    expect(voteBarLabel({ approve: 1, reject: 1, edit: 1 })).toBe('1 approval, 1 rejection, 1 edit');
  });
});

describe('S8 feedback queue · loading and populated', () => {
  it('shows the page heading and a skeleton while the queue loads', async () => {
    mockApi(base);
    mockApi.pending(QUEUE);
    const { container } = renderQueue();
    expect(await screen.findByText('Loading feedback queue')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Feedback queue' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders one row per item (data-asset-id), the vote bar as counts, and last activity', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    renderQueue();
    await loaded();
    expect(rows().map((r) => r.dataset.assetId)).toEqual([
      queueReadmissionRate.assetId,
      queueDischargeDisposition.assetId,
      queueLengthOfStay.assetId,
    ]);
    expect(screen.getByRole('table', { name: 'Feedback queue' })).toBeInTheDocument();
    const first = row(queueReadmissionRate.assetId);
    expect(within(first).getByRole('img', { name: '8 approvals, 2 rejections, 3 edits' })).toBeInTheDocument();
    expect(within(first).getByText('Measure')).toBeInTheDocument();
    expect(first.querySelector('time')).toHaveAttribute('datetime', queueReadmissionRate.lastActivityAt);
    expect(within(row(queueLengthOfStay.assetId)).getByText('No activity yet')).toBeInTheDocument();
    expect(lastQuery()).toEqual({ status: 'pending', limit: '25', offset: '0' });
  });

  it('shows "Often skipped" only on rows skipped at least as often as voted', async () => {
    mockApi({ ...base, [QUEUE]: queueWithOftenSkipped });
    renderQueue();
    await loaded(4);
    expect(screen.getAllByTestId('steward-queue-often-skipped')).toHaveLength(1);
    expect(within(row(ED_BOARDING_ID)).getByText(OFTEN_SKIPPED)).toBeInTheDocument();
    expect(within(row(queueReadmissionRate.assetId)).queryByText(OFTEN_SKIPPED)).toBeNull();
    expect(within(row(queueLengthOfStay.assetId)).queryByText(OFTEN_SKIPPED)).toBeNull();
  });

  it('links "Resolve" to Conflicts for the asset only when it has >= 2 pending edits', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user } = renderQueue();
    await loaded();
    const links = screen.getAllByTestId('steward-queue-resolve-link');
    expect(links).toHaveLength(1);
    expect(within(row(queueReadmissionRate.assetId)).getByTestId('steward-queue-resolve-link')).toHaveAttribute(
      'href',
      `/steward/conflicts?assetId=${encodeURIComponent(queueReadmissionRate.assetId)}`,
    );
    expect(links[0]).toHaveAccessibleName('Resolve conflicts for Readmission Rate (30-day)');
    await user.click(links[0]);
    expect(await screen.findByText('Conflicts route')).toBeInTheDocument();
  });

  it('opens the asset detail sheet from the asset name', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user } = renderQueue();
    await loaded();
    await user.click(within(row(queueReadmissionRate.assetId)).getByRole('button', { name: 'Readmission Rate (30-day)' }));
    const sheet = await screen.findByRole('dialog', { name: assetReadmissionRate.displayName });
    expect(await within(sheet).findByText(assetReadmissionRate.description!)).toBeInTheDocument();
  });

  it('sends campaign, asset type and status filters and resets to the first page', async () => {
    mockApi({ ...base, [QUEUE]: { ...feedbackQueue, total: 60 } });
    const { user } = renderQueue();
    await loaded();
    expect(screen.getByTestId('steward-queue-page-range')).toHaveTextContent('Showing 1–25 of 60');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastQuery().offset).toBe('25'));

    await user.selectOptions(screen.getByTestId('steward-queue-filter-campaign'), campaign.id);
    await waitFor(() => expect(lastQuery()).toMatchObject({ campaignId: campaign.id, offset: '0' }));
    await user.selectOptions(screen.getByTestId('steward-queue-filter-asset-type'), 'measure');
    await waitFor(() => expect(lastQuery()).toMatchObject({ assetType: 'measure', campaignId: campaign.id }));
    await user.click(within(screen.getByTestId('steward-queue-filter-status')).getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'all' }));
  });

  it('has no axe violations when populated, in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi({ ...base, [QUEUE]: queueWithOftenSkipped });
      const { container } = renderQueue({ theme });
      await loaded(4);
      await expectNoAxeViolations(container);
    });
  });
});

describe('S8 feedback queue · empty and filtered-empty', () => {
  it('empty: says so and links to the campaigns', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueueEmpty });
    const { container } = renderQueue();
    const empty = await screen.findByTestId('steward-queue-empty-root');
    expect(within(empty).getByText(QUEUE_EMPTY_TITLE)).toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: 'View campaigns' })).toHaveAttribute('href', '/steward');
    await expectNoAxeViolations(container);
  });

  it('filtered-empty from search: Clear filters brings the rows back', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user, container } = renderQueue();
    await loaded();
    await user.type(screen.getByTestId('steward-queue-search'), 'zzz');
    const filtered = await screen.findByTestId('steward-queue-filtered-empty-root');
    expect(within(filtered).getByText(QUEUE_FILTERED_EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId('steward-queue-empty-root')).toBeNull();
    await expectNoAxeViolations(container);
    await user.click(screen.getByTestId('steward-queue-clear-filters'));
    await loaded();
    expect(screen.getByTestId('steward-queue-search')).toHaveValue('');
  });

  it('filtered-empty from the server: Clear filters drops the asset type from the request', async () => {
    mockApi({
      ...base,
      [QUEUE]: (req: MockRequest) => (req.query.assetType ? feedbackQueueEmpty : feedbackQueue),
    });
    const { user } = renderQueue();
    await loaded();
    await user.selectOptions(screen.getByTestId('steward-queue-filter-asset-type'), 'page');
    expect(await screen.findByTestId('steward-queue-filtered-empty-root')).toBeInTheDocument();
    await user.click(screen.getByTestId('steward-queue-clear-filters'));
    await loaded();
    expect(lastQuery().assetType).toBeUndefined();
    expect(screen.getByTestId('steward-queue-filter-asset-type')).toHaveValue('');
  });
});

describe('S8 feedback queue · error, forbidden, offline', () => {
  it('error state, names the problem and Retry reloads', async () => {
    mockApi(base);
    mockApi.error(QUEUE, 503, 'UPSTREAM_ERROR', 'The SQL warehouse is starting.');
    const { user, container } = renderQueue();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the feedback queue");
    expect(alert).toHaveTextContent('The SQL warehouse is starting.');
    await expectNoAxeViolations(container);
    mockApi({ [QUEUE]: feedbackQueue });
    await user.click(within(alert).getByRole('button', { name: /retry/i }));
    await loaded();
  });

  it('forbidden: a reviewer sees the steward-only state and the queue is never requested', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { container } = renderQueue({ roles: ['reviewer'] });
    expect(await screen.findByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeInTheDocument();
    expect(calls(QUEUE)).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('a failed /api/me is an error to retry, not "forbidden"', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'boom');
    renderWithProviders(page(), { route: '/steward/feedback-queue' });
    expect(await screen.findByText(ACCESS_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeNull();
  });

  it('offline: explains the problem and keeps the loaded rows', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { container } = renderQueue();
    await loaded();
    setOnline(false);
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
    await expectNoAxeViolations(container);
    setOnline(true);
    await waitFor(() => expect(screen.queryByText("You're offline")).toBeNull());
  });
});

describe('S8 feedback queue · keyboard (KB K3)', () => {
  it('"/" focuses search without typing a slash', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user } = renderQueue();
    await loaded();
    await pressKey(user, '/');
    const search = screen.getByTestId('steward-queue-search');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
    // Letters typed into search stay letters (no J/K row moves).
    await user.keyboard('jk');
    expect(search).toHaveValue('jk');
    expect(search).toHaveFocus();
  });

  it('J/K move row focus, Enter opens the detail sheet, Esc returns focus to the row', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user } = renderQueue();
    await loaded();
    const nameButton = (assetId: string) => within(row(assetId)).getAllByRole('button')[0];

    await pressKey(user, 'J');
    expect(nameButton(queueReadmissionRate.assetId)).toHaveFocus();
    await pressKey(user, 'J');
    expect(nameButton(queueDischargeDisposition.assetId)).toHaveFocus();
    await pressKey(user, 'K');
    expect(nameButton(queueReadmissionRate.assetId)).toHaveFocus();

    await pressKey(user, 'Enter');
    const sheet = await screen.findByRole('dialog', { name: assetReadmissionRate.displayName });
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(nameButton(queueReadmissionRate.assetId)).toHaveFocus());
  });

  it('C opens Conflicts for the focused row only when it has >= 2 pending edits', async () => {
    mockApi({ ...base, [QUEUE]: feedbackQueue });
    const { user } = renderQueue();
    await loaded();
    await pressKey(user, 'J');
    await pressKey(user, 'J'); // Discharge Disposition: 1 pending edit
    await pressKey(user, 'C');
    expect(screen.queryByText('Conflicts route')).toBeNull();
    await pressKey(user, 'K'); // Readmission Rate: 3 pending edits
    await pressKey(user, 'C');
    expect(await screen.findByText('Conflicts route')).toBeInTheDocument();
    expect(IDS.assets.readmissionRate).toBe(queueReadmissionRate.assetId);
  });
});
