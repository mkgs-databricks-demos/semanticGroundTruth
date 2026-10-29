// @a11y-strict
// client/src/pages/fallback/Fallback.test.tsx — S11 fallbacks, route table, ThemeSync
// Session 49 · Build 5 · wave 5-1 (ui_test_strategy.md §8 S11 rows; plan 49 steps 1, 3, 5)

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_TITLE, appRoutes } from '../../App';
import { ErrorBoundary } from '../../ErrorBoundary';
import { THEME_STORAGE_KEY } from '../../lib/settings/ThemeSync';
import { expectNoAxeViolations } from '../../test/axe';
import {
  campaign,
  conflictsRoutes,
  feedbackBranchesRoutes,
  feedbackQueueRoutes,
  meAdmin,
  meReviewer,
  meSteward,
  notificationsRoutes,
  settingsWithTheme,
  userSettings,
} from '../../test/fixtures';
import { calls, mockApi } from '../../test/mockApi';
import { createTestQueryClient, renderInBothThemes, renderWithProviders, resetTheme } from '../../test/render';
import { AppError, RouteErrorPage } from './AppErrorPage';
import { NotFound } from './NotFoundPage';

function Boom(): never {
  throw new Error('boom');
}

/** The real route table (or `routes`) in a memory router with the app providers. */
function renderRouter(path: string, routes: RouteObject[] = appRoutes) {
  resetTheme();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const view = render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey={THEME_STORAGE_KEY} disableTransitionOnChange>
      <QueryClientProvider client={createTestQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...view, router, user };
}

function shellApi(me = meSteward, theme: 'light' | 'dark' | 'system' = 'light') {
  return mockApi({
    ...notificationsRoutes,
    'GET /api/me': me,
    'GET /api/me/settings': settingsWithTheme(theme),
    'PUT /api/me/settings': userSettings,
    // The Settings page (session 52) loads campaigns for its default-campaign select.
    'GET /api/campaigns': [campaign],
  });
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('S11 not found', () => {
  it('one <h1>, a link back to Review, axe clean in both themes', async () => {
    await renderInBothThemes(async (theme) => {
      const { container } = renderWithProviders(<NotFound />, { theme });
      expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Page not found']);
      expect(screen.getByRole('link', { name: 'Back to Review' })).toHaveAttribute('href', '/');
      await expectNoAxeViolations(container);
    });
  });

  it('unknown routes render inside the shell with the page title', async () => {
    shellApi();
    renderRouter('/no/such/page');
    const root = await screen.findByTestId('not-found-root');
    expect(screen.getByRole('main')).toContainElement(root);
    expect(screen.getByTestId('shell-header-root')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(`Page not found \u00b7 ${APP_TITLE}`));
  });
});

describe('S11 app error', () => {
  it('friendly message + Reload; details stay behind a closed disclosure', async () => {
    const onReload = vi.fn();
    const { user, container } = renderWithProviders(<AppError error={new Error('boom')} onReload={onReload} />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Something went wrong']);
    const details = screen.getByTestId('app-error-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(screen.getByTestId('app-error-details-toggle'));
    expect(details.open).toBe(true);
    expect(within(details).getByText('Error: boom')).toBeInTheDocument();
    await user.click(screen.getByTestId('app-error-reload'));
    expect(onReload).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations(container);
  });

  it('Copy details puts the error on the clipboard and says so', async () => {
    const { user } = renderWithProviders(<AppError error={new Error('boom')} componentStack={'\n    at Boom'} />);
    await user.click(screen.getByRole('button', { name: 'Copy details' }));
    expect(await screen.findByRole('button', { name: 'Details copied' })).toBeInTheDocument();
    const text = await navigator.clipboard.readText();
    expect(text).toContain('Error: boom');
    expect(text).toContain('Component stack:');
    expect(screen.getByRole('status')).toHaveTextContent('Technical details copied');
  });

  it('axe clean in both themes with the disclosure open', async () => {
    await renderInBothThemes(async (theme) => {
      const { container, user } = renderWithProviders(<AppError error={new Error('boom')} />, { theme });
      await user.click(screen.getByTestId('app-error-details-toggle'));
      await expectNoAxeViolations(container);
    });
  });

  it('ErrorBoundary renders the app-error page for a render crash', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('app-error-root')).toBeInTheDocument();
    expect(screen.getByTestId('app-error-details')).not.toHaveAttribute('open');
  });

  it('router errorElement: render errors show app-error, 404 responses show not-found', async () => {
    renderRouter('/', [{ path: '/', element: <Boom />, errorElement: <RouteErrorPage /> }]);
    expect(await screen.findByTestId('app-error-root')).toBeInTheDocument();
  });

  it('a 404 route response shows not-found', async () => {
    const routes: RouteObject[] = [
      {
        path: '/',
        loader: () => {
          throw new Response('', { status: 404, statusText: 'Not Found' });
        },
        element: <p>never</p>,
        errorElement: <RouteErrorPage />,
      },
    ];
    renderRouter('/', routes);
    expect(await screen.findByTestId('not-found-root')).toBeInTheDocument();
  });
});

describe('route table', () => {
  it.each([
    ['/settings', 'Settings', meReviewer],
    ['/steward/feedback-queue', 'Feedback queue', meSteward],
    ['/steward/conflicts', 'Conflicts', meSteward],
    ['/steward/feedback-branches', 'Feedback branches', meSteward],
  ])('%s lazy-loads its page with title "%s"', async (path, title, me) => {
    shellApi(me);
    mockApi({ ...feedbackQueueRoutes, ...conflictsRoutes, ...feedbackBranchesRoutes });
    renderRouter(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(document.title).toBe(`${title} \u00b7 ${APP_TITLE}`));
    if (path.startsWith('/steward')) {
      expect(await screen.findByRole('navigation', { name: 'Steward sections' })).toBeInTheDocument();
    }
  });

  it('exposes every build-5 path', () => {
    const paths = (appRoutes[0].children ?? []).map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining(['/settings', '/steward/feedback-queue', '/steward/conflicts', '/steward/feedback-branches', '*']),
    );
    expect(appRoutes[0].errorElement).toBeTruthy();
  });
});

describe('ThemeSync', () => {
  it('seeds the theme from GET /api/me/settings without writing it back', async () => {
    shellApi(meAdmin, 'dark');
    renderRouter('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
  });

  it('a later toggle wins over the seeded value and is saved', async () => {
    shellApi(meAdmin, 'dark');
    const { user } = renderRouter('/settings');
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    await user.click(screen.getByTestId('shell-theme-toggle'));
    await waitFor(() => expect(calls('PUT /api/me/settings')).toHaveLength(1));
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ theme: 'system' });
  });
});
