// client/src/test/harness.test.tsx — meta-tests for the build-5 UI test harness
// Session 43 · Build 5 · wave 5-0 (plan 43 step 8)
//
// Proves the harness catches what it promises to catch: a fixture or request
// that drifts from ROUTE_CONTRACTS, an unmocked route, an axe violation; and
// that renderWithProviders wires theme, router, query client and identity.

import { useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { useTheme } from 'next-themes';
import { useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACTS, routeKey } from '../../../shared/contracts/schemas';
import { getMe, getNextCard } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/http';
import { AXE_TAGS, expectNoAxeViolations } from './axe';
import {
  FIXTURE_ROUTES,
  IDS,
  leaderboard,
  me,
  meAdmin,
  reviewCard,
  skipResponse,
  unreadCount,
  userSettings,
} from './fixtures';
import { expectFocusVisible, pressKey, tabUntil, toKeyboardSyntax } from './keyboard';
import { stubMatchMedia } from './media';
import { contractFor, mockApi, validateFixture } from './mockApi';
import { resetOnline, setOnline } from './online';
import { renderInBothThemes, renderWithProviders, TOAST_REGION_TEST_ID } from './render';

// ── Probe components ─────────────────────────────────────────────────────────────────────

function WhoAmI() {
  const { theme, resolvedTheme } = useTheme();
  const q = useQuery({ queryKey: ['me'], queryFn: getMe });
  return (
    <main>
      <h1>Harness probe</h1>
      <p data-testid="probe-theme">{`${theme ?? ''}/${resolvedTheme ?? ''}`}</p>
      {q.data ? <p>{q.data.displayName}</p> : <p>Loading</p>}
      {q.error ? <p role="alert">{(q.error as Error).message}</p> : null}
      <p data-testid="probe-roles">{q.data?.roles.join(',')}</p>
    </main>
  );
}

function ShowParam() {
  const { batchId } = useParams();
  return <p>batch {batchId}</p>;
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Fixtures ──────────────────────────────────────────────────────────────────────────

const fixtureCases = Object.entries(FIXTURE_ROUTES).flatMap(([area, routes]) =>
  Object.entries(routes).map(([key, value]) => ({ area, key, value })),
);

describe('fixtures', () => {
  it('covers all 11 areas of plan 43', () => {
    expect(Object.keys(FIXTURE_ROUTES).sort()).toEqual(
      ['admin', 'conflicts', 'executive', 'feedbackBranches', 'feedbackQueue', 'leaderboard', 'me', 'notifications', 'review', 'settings', 'steward'],
    );
  });

  it.each(fixtureCases)('$area: $key matches its response schema', ({ key, value }) => {
    expect(() => validateFixture(key, value)).not.toThrow();
  });

  it('uses the brief §1.1 sample values', () => {
    expect(me.displayName).toBe('Priya Raman');
    expect(reviewCard.asset.displayName).toBe('Readmission Rate (30-day)');
    expect(reviewCard.confidence?.confidence).toBe(0.71);
    expect(reviewCard.progress).toEqual({ reviewed: 42, total: 120 });
    expect(leaderboard.find((e) => e.userId === me.userId)?.rank).toBe(3);
    expect(skipResponse.stats.skippedToday).toBe(3);
  });
});

// ── mockApi ───────────────────────────────────────────────────────────────────────────

describe('mockApi', () => {
  it('knows every ROUTE_CONTRACTS key', () => {
    for (const c of ROUTE_CONTRACTS) expect(contractFor(routeKey(c))).toBe(c);
  });

  it('rejects a fixture that does not match the response schema', () => {
    expect(() => mockApi({ 'GET /api/me': { ...me, roles: ['superuser'] } })).toThrow(
      /fixture for GET \/api\/me does not match its response schema[\s\S]*roles/,
    );
  });

  it('rejects an unknown route key', () => {
    expect(() => mockApi({ 'GET /api/nope': {} })).toThrow(/unknown route "GET \/api\/nope"/);
  });

  it('rejects a request body that does not match the request schema', async () => {
    const api = mockApi({});
    // The client must never send voteType "skip" to /vote (skips go to /api/review/skip).
    await expect(
      fetch('/api/review/vote', jsonPost({ assetId: IDS.assets.readmissionRate, voteType: 'skip' })),
    ).rejects.toThrow(/POST \/api\/review\/vote request body does not match[\s\S]*voteType/);
    expect(api.calls('POST /api/review/vote')).toHaveLength(1);
    expect(api.takeProblems()).toHaveLength(1);
  });

  it('rejects a body sent to a route that declares no request schema', async () => {
    const api = mockApi({ 'POST /api/campaigns/freshness-check': { campaignId: null, added: 0 } });
    await expect(fetch('/api/campaigns/freshness-check', jsonPost({ x: 1 }))).rejects.toThrow(/declares no request schema/);
    expect(api.takeProblems()).toHaveLength(1);
  });

  it('rejects a query that does not match the query schema', async () => {
    const api = mockApi({ 'GET /api/leaderboard': leaderboard });
    await expect(fetch('/api/leaderboard?period=1y')).rejects.toThrow(/query does not match[\s\S]*period/);
    expect(api.takeProblems()).toHaveLength(1);
  });

  it('rejects invalid path params', async () => {
    const api = mockApi({ 'GET /api/assets/:assetId': reviewCard.asset });
    await expect(fetch('/api/assets/not-a-uuid')).rejects.toThrow(/path params do not match/);
    expect(api.takeProblems()).toHaveLength(1);
  });

  it('fails a request with no contract and a contracted route with no handler', async () => {
    const api = mockApi({});
    await expect(fetch('/api/unknown')).rejects.toThrow(/no ROUTE_CONTRACTS entry/);
    await expect(fetch('/api/me')).rejects.toThrow(/GET \/api\/me was requested but has no handler/);
    expect(api.takeProblems()).toHaveLength(2);
  });

  it('serves a valid request with the fixture, the contract status, and records the call', async () => {
    const api = mockApi({ 'POST /api/review/skip': skipResponse });
    const body = { assetId: IDS.assets.readmissionRate, reason: 'not_my_area' };
    const res = await fetch('/api/review/skip', jsonPost(body));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(skipResponse);
    expect(api.calls('POST /api/review/skip').map((c) => c.body)).toEqual([body]);
  });

  it('matches static paths before parameterised ones and captures params', async () => {
    const api = mockApi({
      'GET /api/notifications/unread-count': unreadCount,
      'POST /api/steward/feedback-branches/:batchId/status': FIXTURE_ROUTES.feedbackBranches['POST /api/steward/feedback-branches/:batchId/status'],
    });
    expect(await (await fetch('/api/notifications/unread-count')).json()).toEqual({ count: 2 });
    await fetch(`/api/steward/feedback-branches/${IDS.batches.proposed}/status`, jsonPost({ status: 'in_review' }));
    expect(api.calls('POST /api/steward/feedback-branches/:batchId/status')[0].params).toEqual({
      batchId: IDS.batches.proposed,
    });
  });

  it('validates what a function handler returns', async () => {
    const api = mockApi({ 'GET /api/review/stats/me': () => ({ totalVotes: -1 }) });
    await expect(fetch('/api/review/stats/me')).rejects.toThrow(/handler for GET \/api\/review\/stats\/me returned a body/);
    expect(api.takeProblems()).toHaveLength(1);
  });

  it('error() returns the standard envelope the client turns into ApiError', async () => {
    mockApi.error('GET /api/review/next', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const err = await getNextCard().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 503, code: 'UPSTREAM_ERROR', message: 'SQL warehouse is starting' });
  });

  it('error() rejects an envelope with an unknown error code', () => {
    expect(() => mockApi.error('GET /api/me', 500, 'BOOM' as never, 'x')).toThrow(/invalid error envelope/);
  });

  it('forbidden() replies 403 FORBIDDEN', async () => {
    mockApi.forbidden('GET /api/steward/feedback-queue');
    const res = await fetch('/api/steward/feedback-queue');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it('pending() never settles', async () => {
    mockApi.pending('GET /api/me');
    let settled = false;
    void fetch('/api/me').finally(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);
  });

  it('offline() rejects every fetch like the browser and sets navigator.onLine false', async () => {
    const api = mockApi({ 'GET /api/me': me }).offline();
    expect(navigator.onLine).toBe(false);
    await expect(fetch('/api/me')).rejects.toThrow(new TypeError('Failed to fetch'));
    expect(api.calls('GET /api/me')).toHaveLength(1);
    api.online();
    expect(navigator.onLine).toBe(true);
    expect((await fetch('/api/me')).status).toBe(200);
  });
});

// ── renderWithProviders ─────────────────────────────────────────────────────────────────

describe('renderWithProviders', () => {
  it('renders in light and dark, with the theme class on <html>, and passes axe in both', async () => {
    const seen: string[] = [];
    await renderInBothThemes(async (theme) => {
      seen.push(theme);
      const { container } = renderWithProviders(<WhoAmI />, { theme, roles: ['reviewer'] });
      expect(await screen.findByText('Priya Raman')).toBeInTheDocument();
      await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark'));
      expect(screen.getByTestId('probe-theme')).toHaveTextContent(`${theme}/${theme}`);
      await expectNoAxeViolations(container);
    });
    expect(seen).toEqual(['light', 'dark']);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('theme "system" follows prefers-color-scheme', async () => {
    stubMatchMedia({ prefersDark: true });
    renderWithProviders(<WhoAmI />, { theme: 'system', me: meAdmin });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(await screen.findByTestId('probe-roles')).toHaveTextContent('reviewer,steward,admin');
  });

  it('registers GET /api/me/settings from `settings`', async () => {
    const { api } = renderWithProviders(<WhoAmI />, { roles: ['reviewer'], settings: userSettings });
    const res = await fetch('/api/me/settings');
    expect(await res.json()).toEqual(userSettings);
    expect(api?.handlers.has('GET /api/me/settings')).toBe(true);
  });

  it('mounts on a route pattern so useParams works, and renders the toast region', () => {
    renderWithProviders(<ShowParam />, {
      route: `/steward/branches/${IDS.batches.proposed}`,
      path: '/steward/branches/:batchId',
    });
    expect(screen.getByText(`batch ${IDS.batches.proposed}`)).toBeInTheDocument();
    expect(screen.getByTestId(TOAST_REGION_TEST_ID)).toHaveAttribute('aria-live', 'polite');
  });

  it('starts offline when online: false', () => {
    renderWithProviders(<p>x</p>, { online: false });
    expect(navigator.onLine).toBe(false);
  });
});

// ── axe ───────────────────────────────────────────────────────────────────────────────

describe('expectNoAxeViolations', () => {
  it('runs WCAG 2.1 A/AA rules', () => {
    expect(AXE_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  });

  it('flags a known violation (image without alt, unnamed button)', async () => {
    const { container } = renderWithProviders(
      <main>
        <img src="chart.png" />
        <button type="button" />
      </main>,
    );
    await expect(expectNoAxeViolations(container)).rejects.toThrow(/image-alt|button-name/);
  });

  it('passes accessible markup', async () => {
    const { container } = renderWithProviders(
      <main>
        <img src="chart.png" alt="Readmission trend" />
        <button type="button">Approve</button>
      </main>,
    );
    await expectNoAxeViolations(container);
  });

  it('can disable one rule for one check', async () => {
    // Meta-test only: proves disableRules works; real tests must record the suppression.
    const { container } = renderWithProviders(<img src="chart.png" />);
    await expectNoAxeViolations(container, { disableRules: ['image-alt'] });
  });
});

// ── keyboard / online ───────────────────────────────────────────────────────────────────

describe('keyboard helpers', () => {
  it('converts keys and chords to user-event syntax', () => {
    expect(toKeyboardSyntax('A')).toBe('A');
    expect(toKeyboardSyntax('Escape')).toBe('{Escape}');
    expect(toKeyboardSyntax('\u2192')).toBe('{ArrowRight}');
    expect(toKeyboardSyntax('Shift+S')).toBe('{Shift>}S{/Shift}');
    expect(toKeyboardSyntax('Ctrl+s')).toBe('{Control>}s{/Control}');
    expect(toKeyboardSyntax('?')).toBe('?');
    expect(toKeyboardSyntax('+')).toBe('+');
    expect(() => toKeyboardSyntax('Hyper+S')).toThrow(/unknown modifier/);
  });

  it('tabUntil reaches a control by accessible name; pressKey sends keys to it', async () => {
    const keys: string[] = [];
    const { user } = renderWithProviders(
      <main>
        <a href="#main">Skip to content</a>
        <button type="button">Reject</button>
        <button
          type="button"
          className="outline-none focus-visible:ring-2"
          onKeyDown={(e) => keys.push(e.shiftKey ? `Shift+${e.key}` : e.key)}
        >
          Approve
        </button>
      </main>,
    );
    const approve = await tabUntil(user, 'Approve');
    expect(approve).toBe(screen.getByRole('button', { name: 'Approve' }));
    expectFocusVisible(approve);
    await pressKey(user, 'A');
    await pressKey(user, 'Shift+S');
    await pressKey(user, 'Escape');
    expect(keys).toEqual(['A', 'Shift+Shift', 'Shift+S', 'Escape']);
  });

  it('tabUntil fails with the focus order when the name is never reached', async () => {
    const { user } = renderWithProviders(<button type="button">Only</button>);
    await expect(tabUntil(user, 'Missing', { max: 3 })).rejects.toThrow(/Focus order: button "Only"/);
  });

  it('expectFocusVisible fails on outline-none without a focus-visible ring', async () => {
    const { user } = renderWithProviders(<button type="button" className="outline-none">Bare</button>);
    const bare = await tabUntil(user, 'Bare');
    expect(() => expectFocusVisible(bare)).toThrow(/outline-none without a focus-visible/);
  });
});

describe('online helpers', () => {
  it('setOnline toggles navigator.onLine and dispatches the event', () => {
    const events: string[] = [];
    const onEvent = (e: Event) => events.push(e.type);
    window.addEventListener('offline', onEvent);
    window.addEventListener('online', onEvent);
    setOnline(false);
    expect(navigator.onLine).toBe(false);
    setOnline(true);
    expect(navigator.onLine).toBe(true);
    window.removeEventListener('offline', onEvent);
    window.removeEventListener('online', onEvent);
    expect(events).toEqual(['offline', 'online']);
    setOnline(false);
    resetOnline();
    expect(navigator.onLine).toBe(true);
  });
});
