// @a11y-strict
// client/src/pages/admin/AdminPage.test.tsx — S6 Admin (ui_test_strategy.md §8 S6 rows)
// Session 54 · Build 5 · wave 5-2
//
// loading / populated (three groups, scoring fields by label incl. "Skip
// cooldown (hours)"), validation (900 hours → inline error, no request),
// last-admin DELETE 409 CONFLICT → inline alert, empty group, errors (load and
// save apart), forbidden, F4 regression, offline, confirm dialogs (Cancel
// first), F8 (no notification preferences); axe light + dark.

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACCESS_ERROR_TITLE } from '../../components/access/RoleGate';
import { EMPTY_GROUP_TEXT, LAST_ADMIN_MESSAGE } from '../../components/admin/MembersPanel';
import { ROLE_LISTS_NOTE } from '../../components/admin/RoleListsForm';
import { SKIP_COOLDOWN_ERROR, SKIP_COOLDOWN_LABEL } from '../../components/admin/ScoringConfigForm';
import { expectNoAxeViolations } from '../../test/axe';
import { adminRoutes, appGroups, confidence, IDS, meAdmin, scoringConfig } from '../../test/fixtures';
import { calls, mockApi } from '../../test/mockApi';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import { ADMIN_FORBIDDEN_TITLE, AdminPage } from './AdminPage';

const ADMIN = ['reviewer', 'steward', 'admin'] as const;

function renderPage(options: Parameters<typeof renderWithProviders>[1] = {}) {
  mockApi(adminRoutes);
  return renderWithProviders(<AdminPage />, { route: '/admin', roles: [...ADMIN], ...options });
}

const group = (name: string) => {
  const el = screen.getAllByTestId('admin-members-group').find((g) => g.getAttribute('data-group') === name);
  if (!el) throw new Error(`group ${name} not rendered`);
  return el;
};

async function ready() {
  await screen.findByLabelText(SKIP_COOLDOWN_LABEL);
  await screen.findAllByTestId('admin-members-group');
}

describe('S6 admin · loading / populated', () => {
  it('shows the title and an access skeleton while GET /api/me is pending', async () => {
    mockApi.pending('GET /api/me');
    const { container } = renderWithProviders(<AdminPage />, { route: '/admin' });
    expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-loading')).toHaveTextContent('Checking your access');
    await expectNoAxeViolations(container);
  });

  it('shows section skeletons while config and groups load', async () => {
    mockApi.pending('GET /api/admin/config');
    mockApi.pending('GET /api/admin/groups');
    renderWithProviders(<AdminPage />, { route: '/admin', roles: [...ADMIN] });
    expect(await screen.findByText('Loading members')).toBeInTheDocument();
    expect(screen.getByText('Loading scoring configuration')).toBeInTheDocument();
  });

  it('renders three groups: Members and roles, Scoring, System', async () => {
    renderPage();
    await ready();
    const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(['Members and roles', 'Scoring', 'System']);
    expect(screen.getAllByTestId('admin-members-group').map((g) => g.getAttribute('data-group'))).toEqual(
      appGroups.map((g) => g.name),
    );
    expect(screen.getByText(ROLE_LISTS_NOTE)).toBeInTheDocument();
  });

  it('labels every scoring field, including "Skip cooldown (hours)" with its value and help', async () => {
    renderPage();
    await ready();
    const expected: [string, number][] = [
      ['Wilson z', scoringConfig.wilsonZ],
      ['Industry prior', scoringConfig.industryPrior],
      ['Prior weight', scoringConfig.priorWeight],
      ['Prior decay threshold', scoringConfig.priorDecayThreshold],
      ['Certification threshold', scoringConfig.certificationThreshold],
      ['Minimum votes for certification', scoringConfig.minVotesForCertification],
      ['Staleness (days)', scoringConfig.stalenessDays],
      ['Freshness interval (days)', scoringConfig.freshnessIntervalDays],
      [SKIP_COOLDOWN_LABEL, scoringConfig.skipCooldownHours],
    ];
    for (const [label, value] of expected) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
    }
    const skip = screen.getByLabelText(SKIP_COOLDOWN_LABEL);
    expect(skip).toHaveAttribute('data-testid', 'admin-scoring-skip-cooldown');
    expect(skip).toHaveAccessibleDescription('How long a skipped card stays hidden from that reviewer.');
  });

  it('F8: notification preferences are not on the Admin page', async () => {
    renderPage();
    await ready();
    expect(screen.queryByText(/notification preferences/i)).not.toBeInTheDocument();
    expect(calls().some((c) => c.path.startsWith('/api/notifications'))).toBe(false);
  });

  it('saves the scoring form with PUT /api/admin/config and announces Saved', async () => {
    const { user } = renderPage();
    await ready();
    const skip = screen.getByLabelText(SKIP_COOLDOWN_LABEL);
    await user.clear(skip);
    await user.type(skip, '48');
    await user.click(screen.getByTestId('admin-scoring-save'));
    await waitFor(() => expect(calls('PUT /api/admin/config')).toHaveLength(1));
    expect(calls('PUT /api/admin/config')[0].body).toMatchObject({ skipCooldownHours: 48, wilsonZ: 1.96 });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('passes axe in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      const { container } = renderPage({ theme });
      await ready();
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      await expectNoAxeViolations(container);
    });
  });
});

describe('S6 admin · validation', () => {
  it('900 hours shows an inline error and sends no request', async () => {
    const { user, container } = renderPage();
    await ready();
    const skip = screen.getByLabelText(SKIP_COOLDOWN_LABEL);
    await user.clear(skip);
    await user.type(skip, '900');
    await user.click(screen.getByTestId('admin-scoring-save'));
    expect(await screen.findByText(SKIP_COOLDOWN_ERROR)).toBeInTheDocument();
    expect(SKIP_COOLDOWN_ERROR).toBe('Enter 0 to 720 hours');
    expect(skip).toHaveAttribute('aria-invalid', 'true');
    expect(skip).toHaveAccessibleDescription(expect.stringContaining(SKIP_COOLDOWN_ERROR));
    expect(calls('PUT /api/admin/config')).toHaveLength(0);
    await expectNoAxeViolations(container);
  });
});

describe('S6 admin · members', () => {
  it('an empty group shows the empty copy', async () => {
    renderPage();
    await ready();
    expect(group('semantic-ground-truth-users')).toHaveTextContent(EMPTY_GROUP_TEXT);
  });

  it('adds a member with POST /api/admin/groups/:name/members', async () => {
    mockApi({ 'POST /api/admin/groups/:name/members': appGroups[2] });
    const { user } = renderPage();
    await ready();
    const users = group('semantic-ground-truth-users');
    await user.type(within(users).getByLabelText('Add member'), 'Wei.Chen@example.com');
    await user.click(within(users).getByTestId('admin-members-add-submit'));
    await waitFor(() => expect(calls('POST /api/admin/groups/:name/members')).toHaveLength(1));
    const req = calls('POST /api/admin/groups/:name/members')[0];
    expect(req.params.name).toBe('semantic-ground-truth-users');
    expect(req.body).toEqual({ memberId: IDS.users.wei });
  });

  it('remove opens an alertdialog with Cancel focused; Cancel sends nothing', async () => {
    const { user } = renderPage();
    await ready();
    await user.click(within(group('semantic-ground-truth-admins')).getByTestId('admin-members-remove'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName(`Remove ${IDS.users.jordan}?`);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls('DELETE /api/admin/groups/:name/members/:memberId')).toHaveLength(0);
  });

  it('last-admin conflict: DELETE 409 CONFLICT shows an inline alert', async () => {
    mockApi.error('DELETE /api/admin/groups/:name/members/:memberId', 409, 'CONFLICT', 'Cannot remove the last admin');
    const { user, container } = renderPage();
    await ready();
    const admins = group('semantic-ground-truth-admins');
    await user.click(within(admins).getByRole('button', { name: `Remove ${IDS.users.jordan} from semantic-ground-truth-admins` }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    const alert = await within(admins).findByRole('alert');
    expect(alert).toHaveTextContent(LAST_ADMIN_MESSAGE);
    const req = calls('DELETE /api/admin/groups/:name/members/:memberId')[0];
    expect(req.params).toEqual({ name: 'semantic-ground-truth-admins', memberId: IDS.users.jordan });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await expectNoAxeViolations(container);
  });
});

describe('S6 admin · maintenance', () => {
  it('freshness check runs only after the confirm dialog', async () => {
    mockApi({ 'POST /api/campaigns/freshness-check': { campaignId: IDS.campaigns.q4ClinicalQuality, added: 4 } });
    const { user } = renderPage();
    await ready();
    await user.click(screen.getByTestId('admin-maintenance-freshness'));
    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    expect(calls('POST /api/campaigns/freshness-check')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Run check' }));
    expect(await screen.findByText('Added 4 assets to the freshness campaign.')).toBeInTheDocument();
    expect(calls('POST /api/campaigns/freshness-check')).toHaveLength(1);
  });

  it('recompute sends POST /api/admin/recompute/:assetId after confirm', async () => {
    mockApi({ 'POST /api/admin/recompute/:assetId': confidence });
    const { user } = renderPage();
    await ready();
    expect(screen.getByTestId('admin-maintenance-recompute')).toBeDisabled();
    await user.type(screen.getByLabelText('Asset id'), IDS.assets.readmissionRate);
    await user.click(screen.getByTestId('admin-maintenance-recompute'));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Recompute' }));
    await waitFor(() => expect(calls('POST /api/admin/recompute/:assetId')).toHaveLength(1));
    expect(calls('POST /api/admin/recompute/:assetId')[0].params.assetId).toBe(IDS.assets.readmissionRate);
  });
});

describe('S6 admin · error / forbidden / offline', () => {
  it('a failed groups load shows an alert with Retry while scoring still loads', async () => {
    mockApi(adminRoutes);
    mockApi.error('GET /api/admin/groups', 500, 'INTERNAL', 'Groups table missing');
    const { container } = renderWithProviders(<AdminPage />, { route: '/admin', roles: [...ADMIN] });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load members");
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(await screen.findByLabelText(SKIP_COOLDOWN_LABEL)).toHaveValue(24);
    await expectNoAxeViolations(container);
  });

  it('a failed save shows an inline alert in the scoring form', async () => {
    mockApi(adminRoutes);
    mockApi.error('PUT /api/admin/config', 400, 'BAD_REQUEST', 'priorWeight must be positive');
    const { user } = renderWithProviders(<AdminPage />, { route: '/admin', roles: [...ADMIN] });
    await ready();
    await user.click(screen.getByTestId('admin-scoring-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save the scoring configuration");
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('a steward sees admin-forbidden-root and no admin requests are sent', async () => {
    const { container } = renderWithProviders(<AdminPage />, { route: '/admin', roles: ['reviewer', 'steward'] });
    expect(await screen.findByTestId('admin-forbidden-root')).toHaveTextContent(ADMIN_FORBIDDEN_TITLE);
    expect(calls().filter((c) => c.path.startsWith('/api/admin'))).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('F4: GET /api/me 500 shows an error with Retry, not forbidden', async () => {
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'Database unavailable');
    const { user } = renderWithProviders(<AdminPage />, { route: '/admin' });
    expect(await screen.findByTestId('admin-access-error')).toHaveTextContent(ACCESS_ERROR_TITLE);
    expect(screen.queryByTestId('admin-forbidden-root')).not.toBeInTheDocument();
    mockApi(adminRoutes);
    mockApi({ 'GET /api/me': meAdmin });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await ready();
  });

  it('offline disables every form', async () => {
    const { container } = renderPage({ online: false });
    await ready();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByLabelText(SKIP_COOLDOWN_LABEL)).toBeDisabled();
    expect(screen.getByTestId('admin-scoring-save')).toBeDisabled();
    for (const btn of screen.getAllByTestId('admin-members-remove')) expect(btn).toBeDisabled();
    for (const input of screen.getAllByTestId('admin-members-add-input')) expect(input).toBeDisabled();
    expect(screen.getByTestId('admin-maintenance-freshness')).toBeDisabled();
    await expectNoAxeViolations(container);
  });
});
