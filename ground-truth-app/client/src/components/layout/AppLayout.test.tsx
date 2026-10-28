// @a11y-strict
// client/src/components/layout/AppLayout.test.tsx — S0 shell (ui_test_strategy.md §8 S0 rows)
// Session 49 · Build 5 · wave 5-1
//
// populated (nav by role, bell name), loading (role-gated skeletons),
// notifications empty / error, offline banner, steward sub-nav, theme
// write-through, KB K6 (skip link, Tab order, Escape returns focus), axe in
// light and dark.

import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../../../shared/contracts';
import { expectNoAxeViolations } from '../../test/axe';
import {
  conflictsRoutes,
  feedbackBranchesRoutes,
  feedbackQueue,
  feedbackQueueRoutes,
  notifications,
  notificationsRoutes,
  runtimeConfig,
  settingsRoutes,
} from '../../test/fixtures';
import { pressKey, tabUntil } from '../../test/keyboard';
import { calls, mockApi } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { RenderWithProvidersOptions } from '../../test/render';
import { AppLayout, PRODUCT_NAME, SYMBOL_COLOR, SYMBOL_LIGHT } from './AppLayout';
import type { AppLayoutProps } from './AppLayout';

const STEWARD: Role[] = ['reviewer', 'steward'];

function shell(props: AppLayoutProps = {}): ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout {...props} />}>
        <Route path="*" element={<h1>Page heading</h1>} />
      </Route>
    </Routes>
  );
}

function renderShell(options: RenderWithProvidersOptions & { props?: AppLayoutProps } = {}) {
  const { props, ...rest } = options;
  // Share to Slack (session 56) reads GET /api/config for stewards when the list renders.
  mockApi({ ...notificationsRoutes, 'GET /api/config': runtimeConfig });
  return renderWithProviders(shell(props), { roles: STEWARD, ...rest });
}

const mainNav = () => screen.getByRole('navigation', { name: 'Main navigation' });
const navNames = () =>
  within(mainNav())
    .getAllByRole('link')
    .map((a) => a.textContent?.trim());

describe('S0 shell · populated', () => {
  it.each<[Role[], string[]]>([
    [['reviewer'], ['Review', 'Leaderboard', 'Assistant']],
    [['reviewer', 'steward'], ['Review', 'Leaderboard', 'Assistant', 'Steward', 'Executive']],
    [['reviewer', 'steward', 'admin'], ['Review', 'Leaderboard', 'Assistant', 'Steward', 'Executive', 'Admin']],
  ])('nav links for %j', async (roles, expected) => {
    renderShell({ roles });
    await waitFor(() => expect(screen.queryAllByTestId('shell-nav-skeleton')).toHaveLength(0));
    expect(navNames()).toEqual(expected);
  });

  it('the product name is a link home, not a heading; the page owns the only <h1>', async () => {
    renderShell();
    const product = screen.getByRole('link', { name: PRODUCT_NAME });
    expect(product).toHaveAttribute('href', '/');
    expect(within(screen.getByTestId('shell-header-root')).queryByRole('heading')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Page heading']);
    await waitFor(() => expect(navNames()).toContain('Steward'));
  });

  it('marks the active route with aria-current and an underline', async () => {
    renderShell({ route: '/leaderboard' });
    const link = await screen.findByTestId('shell-nav-link-leaderboard');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('border-brand-accent');
    expect(screen.getByTestId('shell-nav-link-review')).not.toHaveAttribute('aria-current');
  });

  it('bell name is "Notifications (2 unread)" with a visible count', async () => {
    renderShell();
    expect(await screen.findByRole('button', { name: 'Notifications (2 unread)' })).toBeInTheDocument();
    expect(screen.getByTestId('shell-bell-count')).toHaveTextContent('2');
    // the list is only fetched when the popover opens
    expect(calls('GET /api/notifications')).toHaveLength(0);
  });

  it('popover lists notifications, renders the notificationActions slot, marks all read', async () => {
    const { user } = renderShell({
      props: { notificationActions: (n) => <button type="button">{`Share ${n.title}`}</button> },
    });
    await user.click(await screen.findByRole('button', { name: 'Notifications (2 unread)' }));
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    await waitFor(() => expect(within(popover).getAllByTestId('shell-notification-item')).toHaveLength(2));
    for (const n of notifications) {
      expect(within(popover).getByRole('button', { name: `Share ${n.title}` })).toBeInTheDocument();
    }
    await user.click(within(popover).getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(calls('POST /api/notifications/read')).toHaveLength(1));
    expect(calls('POST /api/notifications/read')[0].body).toEqual({ ids: 'all' });
  });

  it('account menu shows name, email, roles and a Settings link', async () => {
    const { user } = renderShell();
    await user.click(await screen.findByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('dialog', { name: 'Account menu' });
    expect(within(menu).getByText('Priya Raman')).toBeInTheDocument();
    expect(within(menu).getByText('priya.raman@example.com')).toBeInTheDocument();
    expect(within(within(menu).getByRole('list', { name: 'Your roles' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(STEWARD);
    expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });
});

describe('S0 shell · loading', () => {
  it('role-gated items are skeletons until GET /api/me resolves', () => {
    mockApi(notificationsRoutes).pending('GET /api/me');
    renderWithProviders(shell());
    expect(navNames()).toEqual(['Review', 'Leaderboard', 'Assistant']);
    expect(within(mainNav()).getAllByTestId('shell-nav-skeleton')).toHaveLength(3);
    expect(screen.getByTestId('shell-user-menu-skeleton')).toBeInTheDocument();
  });
});

describe('S0 shell · notifications empty / error', () => {
  it('empty popover says "You\'re all caught up"', async () => {
    mockApi({ 'GET /api/notifications': [], 'GET /api/notifications/unread-count': { count: 0 } });
    const { user } = renderWithProviders(shell(), { roles: STEWARD });
    await user.click(await screen.findByRole('button', { name: 'Notifications (0 unread)' }));
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    expect(await within(popover).findByText("You're all caught up")).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: 'Mark all read' })).toBeNull();
    expect(screen.queryByTestId('shell-bell-count')).toBeNull();
  });

  it('error: bell stays focusable, named "Notifications unavailable", with a tooltip', async () => {
    mockApi(notificationsRoutes).error('GET /api/notifications/unread-count', 500, 'INTERNAL', 'Lakebase unavailable');
    const { user } = renderWithProviders(shell(), { roles: STEWARD });
    const bell = await screen.findByRole('button', { name: 'Notifications unavailable' });
    expect(await tabUntil(user, 'Notifications unavailable')).toBe(bell);
    expect(bell).toHaveAccessibleDescription('Notifications unavailable');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Notifications unavailable');
  });
});

describe('S0 shell · offline', () => {
  it('shows a role="status" banner while offline and removes it when back online', async () => {
    renderShell({ online: false });
    const banner = screen.getByTestId('shell-offline-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent("You're offline. Votes and edits are paused until the connection is back.");
    setOnline(true);
    expect(banner).toHaveTextContent('');
    setOnline(false);
    expect(banner).toHaveTextContent("You're offline.");
    // The 'offline' event also pauses React Query (onlineManager); end online so
    // later tests are not left with paused queries.
    setOnline(true);
    await waitFor(() => expect(navNames()).toContain('Steward'));
  });
});

describe('S0 shell · steward sub-nav', () => {
  it('shows the four steward sections with counts on /steward/*', async () => {
    mockApi({ ...feedbackQueueRoutes, ...conflictsRoutes, ...feedbackBranchesRoutes });
    renderShell({ route: '/steward/conflicts' });
    const sub = await screen.findByRole('navigation', { name: 'Steward sections' });
    expect(within(sub).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/steward',
      '/steward/feedback-queue',
      '/steward/conflicts',
      '/steward/feedback-branches',
    ]);
    await waitFor(() => expect(within(sub).getAllByTestId('shell-subnav-count')).toHaveLength(3));
    expect(within(sub).getByRole('link', { name: new RegExp(`^Feedback queue\\s*, ${feedbackQueue.total} waiting$`) })).toBeInTheDocument();
    expect(within(sub).getByRole('link', { name: /^Conflicts/ })).toHaveAttribute('aria-current', 'page');
    expect(within(sub).getByRole('link', { name: /^Console/ })).not.toHaveAttribute('aria-current');
  });

  it('is absent outside /steward and for reviewers', async () => {
    renderShell({ route: '/leaderboard' });
    await waitFor(() => expect(navNames()).toContain('Steward'));
    expect(screen.queryByRole('navigation', { name: 'Steward sections' })).toBeNull();
  });

  it('is absent for a reviewer on /steward', async () => {
    renderShell({ route: '/steward', roles: ['reviewer'] });
    await waitFor(() => expect(navNames()).toEqual(['Review', 'Leaderboard', 'Assistant']));
    expect(screen.queryByRole('navigation', { name: 'Steward sections' })).toBeNull();
    expect(calls('GET /api/steward/conflicts')).toHaveLength(0);
  });
});

describe('S0 shell · theme', () => {
  it('the toggle applies dark at once, writes PUT /api/me/settings and swaps the symbol', async () => {
    mockApi(settingsRoutes);
    const { user } = renderShell({ theme: 'light' });
    expect(screen.getByTestId('shell-product-symbol')).toHaveAttribute('src', SYMBOL_COLOR);
    await user.click(screen.getByTestId('shell-theme-toggle'));
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    await waitFor(() => expect(calls('PUT /api/me/settings')).toHaveLength(1));
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ theme: 'dark' });
    expect(screen.getByTestId('shell-product-symbol')).toHaveAttribute('src', SYMBOL_LIGHT);
    expect(screen.getByTestId('shell-theme-toggle')).toHaveAccessibleName('Switch to system theme');
  });

  it('offline: the theme still changes, nothing is sent', async () => {
    const { user } = renderShell({ theme: 'light', online: false });
    await user.click(screen.getByTestId('shell-theme-toggle'));
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
  });
});

describe('S0 shell · keyboard (KB K6)', () => {
  it('Skip to content is the first Tab stop and Enter moves focus to <main>', async () => {
    const { user } = renderShell();
    await user.tab();
    expect(document.activeElement).toHaveTextContent('Skip to content');
    await pressKey(user, 'Enter');
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('Tab order: skip -> product -> nav -> bell -> theme -> account', async () => {
    const { user } = renderShell();
    await waitFor(() => expect(navNames()).toContain('Executive'));
    await screen.findByRole('button', { name: 'Account menu' });
    const expected = [
      'Skip to content',
      PRODUCT_NAME,
      'Review',
      'Leaderboard',
      'Assistant',
      'Steward',
      'Executive',
      'Notifications (2 unread)',
      'Switch to dark theme',
      'Account menu',
    ];
    const seen: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      seen.push(el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '');
    }
    expect(seen).toEqual(expected);
  });

  it('Enter opens the bell popover; Escape closes it and returns focus to the bell', async () => {
    const { user } = renderShell();
    const bell = await tabUntil(user, 'Notifications (2 unread)');
    await pressKey(user, 'Enter');
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    expect(popover).toContainElement(document.activeElement as HTMLElement);
    await within(popover).findAllByTestId('shell-notification-item');
    await pressKey(user, 'Escape');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    expect(document.activeElement).toBe(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape closes the account menu and returns focus to its button', async () => {
    const { user } = renderShell();
    const button = await tabUntil(user, 'Account menu');
    await pressKey(user, 'Enter');
    expect(screen.getByRole('dialog', { name: 'Account menu' })).toBeInTheDocument();
    await pressKey(user, 'Escape');
    expect(screen.queryByRole('dialog', { name: 'Account menu' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('the mobile menu button opens the navigation drawer', async () => {
    const { user } = renderShell();
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Navigation menu' });
    expect(within(drawer).getByRole('navigation', { name: 'Drawer navigation' })).toBeInTheDocument();
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull());
  });
});

describe('S0 shell · axe', () => {
  it('no violations in light and dark (closed, bell open, offline)', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi({ ...feedbackQueueRoutes, ...conflictsRoutes, ...feedbackBranchesRoutes });
      const { container, user } = renderShell({ theme, route: '/steward/feedback-queue', online: false });
      await waitFor(() => expect(navNames()).toContain('Steward'));
      await screen.findAllByTestId('shell-subnav-count');
      await expectNoAxeViolations(container);
      await user.click(screen.getByRole('button', { name: 'Notifications (2 unread)' }));
      await screen.findAllByTestId('shell-notification-item');
      await expectNoAxeViolations(container);
    });
  });
});
