// client/src/test/render.tsx — render a screen with the app's providers
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §4, §7.3)
//
// Same provider stack as main.tsx, adjusted for tests:
//   ThemeProvider (next-themes, attribute="class", storageKey sgt-theme)
//   > MotionConfig (reducedMotion "user")
//   > QueryClientProvider (fresh client, no retries)
//   > MemoryRouter (initialEntries [route])
//   + an empty toast live region (data-testid "shell-toast-region").
//
//   const { user } = renderWithProviders(<ReviewPage />, { roles: ['reviewer'] });
//   renderWithProviders(<BranchDetail />, { route: `/steward/branches/${id}`, path: '/steward/branches/:batchId' });
//   await renderInBothThemes(async (theme) => {
//     const { container } = renderWithProviders(<SettingsPage />, { theme });
//     expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
//     await expectNoAxeViolations(container);
//   });
//
// `roles` / `me` register GET /api/me and `settings` registers
// GET /api/me/settings on the active mockApi (created if needed).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from 'next-themes';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach } from 'vitest';
import type { MeResponse, Role, UserSettings } from '../../../shared/contracts';
import { meWithRoles } from './fixtures/me';
import { activeMockApi, mockApi } from './mockApi';
import type { MockApi } from './mockApi';
import { setInitialOnline } from './online';

/** Same key as main.tsx so screens that read it see the test theme. */
export const THEME_STORAGE_KEY = 'sgt-theme';
export const TOAST_REGION_TEST_ID = 'shell-toast-region';

export type TestTheme = 'light' | 'dark' | 'system';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper' | 'queries'> {
  /** Initial URL (default "/"). */
  route?: string;
  /** Route pattern to mount `ui` on, so useParams works (e.g. "/steward/branches/:batchId"). */
  path?: string;
  /** Roles of the current user; registers GET /api/me with the fixture user. */
  roles?: Role[];
  /** Full GET /api/me response (wins over `roles`). */
  me?: MeResponse;
  /** GET /api/me/settings response. */
  settings?: UserSettings;
  /** Initial theme (default "light"; "system" follows the matchMedia stub, see media.ts). */
  theme?: TestTheme;
  /** Initial navigator.onLine (default: jsdom's, true). */
  online?: boolean;
  /** framer-motion MotionConfig reducedMotion (default "user", as in main.tsx). */
  reducedMotion?: 'user' | 'always' | 'never';
  /** Bring your own QueryClient (e.g. to pre-seed the cache). */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  user: UserEvent;
  queryClient: QueryClient;
  /** The active mockApi, if the test (or the options) installed one. */
  api: MockApi | null;
}

/** A QueryClient for tests: no retries, no garbage-collection timers. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Clear what next-themes leaves behind (class, color-scheme, stored theme). */
export function resetTheme(): void {
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  html.style.removeProperty('color-scheme');
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // storage unavailable in this environment
  }
}

function Providers(props: {
  children: ReactNode;
  theme: TestTheme;
  reducedMotion: 'user' | 'always' | 'never';
  queryClient: QueryClient;
  route: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={props.theme}
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion={props.reducedMotion}>
        <QueryClientProvider client={props.queryClient}>
          <MemoryRouter initialEntries={[props.route]}>
            {props.children}
            <div role="region" aria-label="Toast notifications" aria-live="polite" data-testid={TOAST_REGION_TEST_ID} />
          </MemoryRouter>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

/** Render `ui` inside the app's providers. */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    route = '/',
    path,
    roles,
    me,
    settings,
    theme = 'light',
    online,
    reducedMotion = 'user',
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  if (me || roles) mockApi({ 'GET /api/me': me ?? meWithRoles(roles ?? []) });
  if (settings) mockApi({ 'GET /api/me/settings': settings });
  if (online !== undefined) setInitialOnline(online);
  resetTheme();

  const user = userEvent.setup();
  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  );
  const result = render(content, {
    ...renderOptions,
    wrapper: ({ children }) => (
      <Providers theme={theme} reducedMotion={reducedMotion} queryClient={queryClient} route={route}>
        {children}
      </Providers>
    ),
  });
  return { ...result, user, queryClient, api: activeMockApi() };
}

/**
 * Run `fn` once per theme (light, then dark), unmounting and resetting the
 * theme in between. `fn` renders with `renderWithProviders(ui, { theme })`.
 */
export async function renderInBothThemes(
  fn: (theme: 'light' | 'dark') => void | Promise<void>,
): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    await fn(theme);
    cleanup();
    resetTheme();
  }
}

afterEach(() => {
  resetTheme();
});
