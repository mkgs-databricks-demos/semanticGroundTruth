// @a11y-strict
// client/src/pages/executive/ExecutivePage.test.tsx — S5 Executive (ui_test_strategy.md §8 S5 rows)
// Session 54 · Build 5 · wave 5-2
//
// loading / populated (6 KPI groups by label, dashboard link name), empty
// (`totalAssets 0`), dashboard-unconfigured, error, forbidden, F4 regression
// (GET /api/me 500 is an error, not forbidden), offline; axe light + dark.

import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACCESS_ERROR_TITLE } from '../../components/access/RoleGate';
import { DASHBOARD_LINK_NAME, DASHBOARD_UNCONFIGURED_TEXT } from '../../components/executive/DashboardLink';
import { expectNoAxeViolations } from '../../test/axe';
import {
  executiveRoutes,
  executiveSummary,
  executiveSummaryEmpty,
  meSteward,
  runtimeConfig,
  runtimeConfigNoDashboard,
} from '../../test/fixtures';
import { calls, mockApi } from '../../test/mockApi';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import { ExecutivePage, STEWARD_FORBIDDEN_TITLE } from './ExecutivePage';

const STEWARD = ['reviewer', 'steward'] as const;

function renderPage(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(<ExecutivePage />, { route: '/executive', roles: [...STEWARD], ...options });
}

const KPI_EXPECTED: [string, string][] = [
  ['Coverage', '35%'],
  ['Certification', '15%'],
  ['Active reviewers (7d)', '23'],
  ['Votes (7d)', '611'],
  ['Active campaigns', '3'],
  ['Total assets', '120'],
];

describe('S5 executive · loading', () => {
  it('shows the page title and an access skeleton while GET /api/me is pending', async () => {
    mockApi.pending('GET /api/me');
    const { container } = renderWithProviders(<ExecutivePage />, { route: '/executive' });
    expect(screen.getByRole('heading', { level: 1, name: 'Executive summary' })).toBeInTheDocument();
    expect(screen.getByTestId('executive-access-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your access');
    expect(calls('GET /api/admin/summary')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('shows six KPI skeletons while the summary is pending', async () => {
    mockApi({ 'GET /api/config': runtimeConfig });
    mockApi.pending('GET /api/admin/summary');
    const { container } = renderPage();
    expect(await screen.findByText('Loading executive summary')).toBeInTheDocument();
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });
});

describe('S5 executive · populated', () => {
  it('renders the 6 KPI groups by label with their values', async () => {
    mockApi(executiveRoutes);
    renderPage();
    for (const [label, value] of KPI_EXPECTED) {
      const group = await screen.findByRole('group', { name: label });
      expect(group).toHaveTextContent(value);
    }
    expect(screen.getAllByRole('group')).toHaveLength(6);
    expect(screen.getByTestId('executive-kpi-coverage')).toHaveTextContent(`${executiveSummary.coveragePct}%`);
  });

  it('links to the dashboard in a new tab and says so in the link name', async () => {
    mockApi(executiveRoutes);
    renderPage();
    const link = await screen.findByRole('link', { name: DASHBOARD_LINK_NAME });
    expect(link).toHaveAccessibleName(expect.stringContaining('opens in a new tab'));
    expect(link).toHaveAttribute('href', runtimeConfig.executive_dashboard_url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('data-testid', 'executive-dashboard-link');
  });

  it('has one <h1> and passes axe in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi(executiveRoutes);
      const { container } = renderPage({ theme });
      await screen.findByRole('group', { name: 'Coverage' });
      await screen.findByRole('link', { name: DASHBOARD_LINK_NAME });
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      await expectNoAxeViolations(container);
    });
  });
});

describe('S5 executive · empty / dashboard-unconfigured', () => {
  it('totalAssets 0 shows "No assets yet" with a link to the Steward console', async () => {
    mockApi({ 'GET /api/admin/summary': executiveSummaryEmpty, 'GET /api/config': runtimeConfig });
    const { container } = renderPage();
    const empty = await screen.findByTestId('executive-empty-root');
    expect(empty).toHaveTextContent('No assets yet');
    expect(screen.getByRole('link', { name: 'Import assets' })).toHaveAttribute('href', '/steward');
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('executive_dashboard_url null shows a note and no link', async () => {
    mockApi({ 'GET /api/admin/summary': executiveSummary, 'GET /api/config': runtimeConfigNoDashboard });
    const { container } = renderPage();
    expect(await screen.findByTestId('executive-dashboard-unconfigured')).toHaveTextContent(DASHBOARD_UNCONFIGURED_TEXT);
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('executive-dashboard-link')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S5 executive · error / forbidden / offline', () => {
  it('a failed summary shows an alert with Retry that refetches', async () => {
    mockApi({ 'GET /api/config': runtimeConfig });
    mockApi.error('GET /api/admin/summary', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { user, container } = renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the executive summary");
    expect(alert).toHaveTextContent('SQL warehouse is starting');
    await expectNoAxeViolations(container);
    mockApi({ 'GET /api/admin/summary': executiveSummary });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('group', { name: 'Coverage' })).toHaveTextContent('35%');
    expect(calls('GET /api/admin/summary')).toHaveLength(2);
  });

  it('a reviewer sees executive-forbidden-root and no executive requests are sent', async () => {
    const { container } = renderPage({ roles: ['reviewer'] });
    const forbidden = await screen.findByTestId('executive-forbidden-root');
    expect(forbidden).toHaveTextContent(STEWARD_FORBIDDEN_TITLE);
    expect(calls('GET /api/admin/summary')).toHaveLength(0);
    expect(calls('GET /api/config')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('F4: GET /api/me 500 shows an error with Retry, not forbidden', async () => {
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'Database unavailable');
    const { user, container } = renderWithProviders(<ExecutivePage />, { route: '/executive' });
    const err = await screen.findByTestId('executive-access-error');
    expect(err).toHaveTextContent(ACCESS_ERROR_TITLE);
    expect(err).toHaveTextContent('Database unavailable');
    expect(screen.queryByTestId('executive-forbidden-root')).not.toBeInTheDocument();
    expect(calls('GET /api/admin/summary')).toHaveLength(0);
    await expectNoAxeViolations(container);
    mockApi(executiveRoutes);
    mockApi({ 'GET /api/me': meSteward });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('group', { name: 'Coverage' })).toBeInTheDocument();
    expect(calls('GET /api/me')).toHaveLength(2);
  });

  it('offline: explains that figures may be stale', async () => {
    mockApi(executiveRoutes);
    const { container } = renderPage({ online: false });
    const alert = await screen.findByText("You're offline");
    expect(alert.closest('[role="alert"]')).toHaveAttribute('data-variant', 'offline');
    await waitFor(() => expect(screen.getAllByRole('group')).toHaveLength(6));
    await expectNoAxeViolations(container);
  });
});
