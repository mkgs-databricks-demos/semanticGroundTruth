// @a11y-strict
// client/src/pages/leaderboard/LeaderboardPage.test.tsx — S2 Leaderboard (ui_test_strategy.md §8 S2 rows)
// Session 53 · Build 5 · wave 5-2
//
// loading / populated (5 skeleton rows; "You" row; medal names; skipped stat
// shown, not a column), empty (leaderboard-empty-root, Start reviewing → /),
// error / offline (alert + Retry; offline note), tabs (arrow keys change the
// period; the request query parses with LeaderboardQuery). axe in every
// state, light and dark for populated.

import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LeaderboardEntry } from '../../../../shared/contracts';
import { LeaderboardQuerySchema } from '../../../../shared/contracts/api';
import { expectNoAxeViolations } from '../../test/axe';
import { IDS, leaderboard, userStats } from '../../test/fixtures';
import { pressKey } from '../../test/keyboard';
import { calls, mockApi } from '../../test/mockApi';
import type { MockRequest } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { RenderWithProvidersOptions } from '../../test/render';
import { LeaderboardPage } from './LeaderboardPage';

const LB = 'GET /api/leaderboard';
/** Pass as a fixture to keep the handler the test already registered. */
const KEEP = Symbol('keep');
const STATS = 'GET /api/review/stats/me';

function renderPage(
  board: unknown = leaderboard,
  options: RenderWithProvidersOptions & { stats?: unknown } = {},
) {
  // KEEP leaves a handler the test registered first (error, pending) in place.
  const { stats = userStats, ...rest } = options;
  if (board !== KEEP) mockApi({ [LB]: board });
  if (stats !== KEEP) mockApi({ [STATS]: stats });
  return renderWithProviders(
    <Routes>
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/" element={<h1>Review</h1>} />
    </Routes>,
    { route: '/leaderboard', roles: ['reviewer'], ...rest },
  );
}

const table = () => screen.findByRole('table', { name: /Top reviewers/ });
const rows = () => screen.getAllByTestId('leaderboard-table-row');

describe('S2 leaderboard · loading', () => {
  it('shows 5 skeleton rows and a stats skeleton while both requests are pending', async () => {
    mockApi.pending(LB);
    mockApi.pending(STATS);
    const { container } = renderPage(KEEP, { stats: KEEP });
    expect(await screen.findByRole('heading', { level: 1, name: 'Leaderboard' })).toBeInTheDocument();
    // Both requests are in flight (and never settle), so this is the loading state, not a first paint.
    await waitFor(() => expect(calls(LB)).toHaveLength(1));
    await waitFor(() => expect(calls(STATS)).toHaveLength(1));
    expect(screen.getAllByTestId('leaderboard-table-skeleton')).toHaveLength(5);
    expect(screen.getByText('Loading leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Loading your stats')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S2 leaderboard · populated', () => {
  it('renders one h1 and the ranked table with the Figma columns, skipped is not a column', async () => {
    const { container } = renderPage();
    const t = await table();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const headers = within(t).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Rank', 'Name', 'Votes', 'Approvals', 'Edits', 'Streak']);
    expect(headers.join(' ')).not.toMatch(/skip/i);
    expect(rows()).toHaveLength(leaderboard.length);
    expect(rows().map((r) => r.getAttribute('data-user-id'))).toEqual(leaderboard.map((e) => e.userId));
    await expectNoAxeViolations(container);
  });

  it('has the visually hidden caption for the selected period', async () => {
    renderPage();
    expect(await screen.findByRole('table', { name: 'Top reviewers, last 7 days' })).toBeInTheDocument();
  });

  it('marks the current user row with "You"', async () => {
    renderPage();
    await table();
    const mine = screen.getByTestId('leaderboard-table-current-user');
    expect(within(mine).getByText('You')).toBeInTheDocument();
    expect(within(mine).getByText('Priya Raman')).toBeInTheDocument();
    const row = mine.closest('tr');
    expect(row).toHaveAttribute('data-user-id', IDS.users.priya);
    expect(row).toHaveAttribute('data-current-user', 'true');
    expect(screen.getAllByText('You')).toHaveLength(1);
  });

  it('gives ranks 1-3 medals with an accessible name and plain numbers after that', async () => {
    renderPage();
    await table();
    expect(screen.getByRole('img', { name: '1st place' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2nd place' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3rd place' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /4th/ })).not.toBeInTheDocument();
    const fourth = rows()[3];
    expect(within(fourth).getAllByRole('cell')[0]).toHaveTextContent('4');
  });

  it('shows the 8 My stats values, including Skipped with the footnote', async () => {
    renderPage();
    const stats = await screen.findByTestId('leaderboard-stats-root');
    await waitFor(() => expect(within(stats).getByTestId('leaderboard-stats-rank')).toHaveTextContent(`#${userStats.rank}`));
    const terms = within(stats).getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual(['Rank', 'Total votes', 'Approvals', 'Rejections', 'Edits', 'Streak', 'Coverage', 'Skipped']);
    expect(within(stats).getByTestId('leaderboard-stats-skipped')).toHaveTextContent(String(userStats.skippedCount));
    expect(within(stats).getByText("Skips don't count toward rank")).toBeInTheDocument();
  });

  it('table rows are not focusable', async () => {
    renderPage();
    await table();
    for (const row of rows()) expect(row).not.toHaveAttribute('tabindex');
  });

  it('passes axe in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      const { container } = renderPage(leaderboard, { theme });
      await table();
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      await expectNoAxeViolations(container);
    });
  });
});

describe('S2 leaderboard · empty', () => {
  it('shows leaderboard-empty-root with a Start reviewing link to /', async () => {
    const { container, user } = renderPage([]);
    const empty = await screen.findByTestId('leaderboard-empty-root');
    expect(within(empty).getByRole('heading', { name: 'No reviews in this period yet' })).toBeInTheDocument();
    const link = within(empty).getByRole('link', { name: 'Start reviewing' });
    expect(link).toHaveAttribute('href', '/');
    await expectNoAxeViolations(container);
    await user.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Review' })).toBeInTheDocument();
  });
});

describe('S2 leaderboard · error', () => {
  it('shows an alert with Retry, and Retry refetches', async () => {
    mockApi.error(LB, 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { container, user } = renderPage(KEEP);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the leaderboard");
    await expectNoAxeViolations(container);
    const before = calls(LB).length;
    mockApi({ [LB]: leaderboard });
    await user.click(screen.getByTestId('leaderboard-error-retry'));
    await table();
    expect(calls(LB).length).toBe(before + 1);
    expect(screen.queryByText("We couldn't load the leaderboard")).not.toBeInTheDocument();
  });

  it('My stats has its own error with Retry and the table still renders', async () => {
    mockApi.error(STATS, 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { container } = renderPage(leaderboard, { stats: KEEP });
    await table();
    const stats = screen.getByTestId('leaderboard-stats-root');
    expect(await within(stats).findByRole('alert')).toHaveTextContent("We couldn't load your stats");
    expect(within(stats).getByRole('button', { name: 'Retry' })).toBeEnabled();
    await expectNoAxeViolations(container);
  });
});

describe('S2 leaderboard · offline', () => {
  it('keeps the cached table and shows the last-updated note', async () => {
    const { container } = renderPage();
    await table();
    expect(screen.queryByTestId('leaderboard-offline-note')).not.toBeInTheDocument();
    setOnline(false);
    const note = await screen.findByTestId('leaderboard-offline-note');
    expect(note).toHaveTextContent(/Last updated/);
    expect(rows()).toHaveLength(leaderboard.length);
    await expectNoAxeViolations(container);
    setOnline(true);
    await waitFor(() => expect(screen.queryByTestId('leaderboard-offline-note')).not.toBeInTheDocument());
  });

  it('explains the problem when nothing is cached', async () => {
    mockApi.offline();
    const { container } = renderPage(leaderboard, { online: false });
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes("You're offline"))).toBe(true);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
    setOnline(true);
  });
});

describe('S2 leaderboard · tabs', () => {
  const lastQuery = (): MockRequest['query'] => {
    const all = calls(LB);
    return all[all.length - 1].query;
  };

  it('is a tablist named "Leaderboard period" with one tab in the Tab order', async () => {
    renderPage();
    await table();
    const tablist = screen.getByRole('tablist', { name: 'Leaderboard period' });
    expect(tablist).toHaveAttribute('data-testid', 'leaderboard-period-tabs');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['7 days', '30 days', 'All time']);
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('7 days');
  });

  it('ArrowRight moves to 30 days and requests period=30d (parsed by LeaderboardQuery)', async () => {
    const { user } = renderPage();
    await table();
    expect(LeaderboardQuerySchema.parse(lastQuery())).toEqual({ period: '7d', limit: 25 });
    screen.getByRole('tab', { name: '7 days' }).focus();
    await pressKey(user, 'ArrowRight');
    const thirty = screen.getByRole('tab', { name: '30 days' });
    expect(thirty).toHaveFocus();
    expect(thirty).toHaveAttribute('aria-selected', 'true');
    await screen.findByRole('table', { name: 'Top reviewers, last 30 days' });
    expect(lastQuery()).toMatchObject({ period: '30d' });
    expect(LeaderboardQuerySchema.parse(lastQuery())).toEqual({ period: '30d', limit: 25 });
  });

  it('ArrowLeft wraps to All time, Home and End jump', async () => {
    const { user } = renderPage((req: MockRequest) => (req.query.period === 'all' ? ([] as LeaderboardEntry[]) : leaderboard));
    await table();
    screen.getByRole('tab', { name: '7 days' }).focus();
    await pressKey(user, 'ArrowLeft');
    expect(screen.getByRole('tab', { name: 'All time' })).toHaveFocus();
    expect(await screen.findByTestId('leaderboard-empty-root')).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ period: 'all' });
    await pressKey(user, 'Home');
    expect(screen.getByRole('tab', { name: '7 days' })).toHaveFocus();
    await pressKey(user, 'End');
    expect(screen.getByRole('tab', { name: 'All time' })).toHaveFocus();
  });
});
