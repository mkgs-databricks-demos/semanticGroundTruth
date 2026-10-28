// @a11y-strict
// client/src/pages/settings/SettingsPage.test.tsx — S7 Settings (ui_test_strategy.md §8 S7 rows, KB K5, §7.3)
// Session 52 · Build 5 · wave 5-2
//
// loading / populated / defaults; dirty / saving / saved (PUT bodies hold only
// the changed fields / rows); validation (150 -> inline error, no request);
// load error + Retry, save error; offline (form disabled, theme still
// switches, nothing sent); KB K5 (arrow keys on the Theme radiogroup, Ctrl+S);
// §7.3 theme wiring (both themes, ThemeSync seeding `system`); axe everywhere.

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpdatePreferencesBodySchema, UpdateUserSettingsRequestSchema } from '../../../../shared/contracts';
import type { NotificationPreference, UpdatePreferencesBody, UserSettings } from '../../../../shared/contracts';
import { ThemeSync } from '../../lib/settings/ThemeSync';
import { expectNoAxeViolations } from '../../test/axe';
import {
  campaign,
  FIXTURE_NOW,
  IDS,
  notificationPreferences,
  settingsWithTheme,
  userSettings,
  userSettingsDefaults,
} from '../../test/fixtures';
import { pressKey, tabUntil } from '../../test/keyboard';
import { stubMatchMedia } from '../../test/media';
import { calls, mockApi } from '../../test/mockApi';
import type { MockRequest } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { RenderWithProvidersOptions } from '../../test/render';
import { SettingsPage } from './SettingsPage';

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Settings + preferences APIs that remember what was saved (PUT echoes into GET). */
function settingsApi(initial: UserSettings = userSettings) {
  let stored = initial;
  let prefs: NotificationPreference[] = notificationPreferences.map((p) => ({ ...p, channels: [...p.channels] }));
  return mockApi({
    'GET /api/me/settings': () => stored,
    'PUT /api/me/settings': (req: MockRequest) => {
      stored = { ...stored, ...(req.body as Partial<UserSettings>), updatedAt: FIXTURE_NOW };
      return stored;
    },
    'GET /api/notifications/preferences': () => prefs,
    'PUT /api/notifications/preferences': (req: MockRequest) => {
      for (const row of (req.body as UpdatePreferencesBody).preferences) {
        prefs = [...prefs.filter((p) => p.eventType !== row.eventType), { userId: IDS.users.priya, ...row }];
      }
      return prefs;
    },
    'GET /api/campaigns': [campaign],
  });
}

function renderSettings(options: RenderWithProvidersOptions & { initial?: UserSettings } = {}) {
  const { initial, ...rest } = options;
  settingsApi(initial);
  return renderWithProviders(<SettingsPage />, { roles: ['reviewer', 'steward'], ...rest });
}

const radio = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: new RegExp(`^${name}`) });
const cardsInput = () => screen.getByRole('spinbutton', { name: 'Cards per session' });
const saveButton = () => screen.getByRole('button', { name: /^Save changes/ });
const footer = () => screen.queryByTestId('settings-footer-root');
const isDark = () => document.documentElement.classList.contains('dark');

async function populated(options: Parameters<typeof renderSettings>[0] = {}) {
  const view = renderSettings(options);
  await screen.findByRole('radiogroup', { name: 'Theme' });
  await screen.findAllByTestId('settings-notifications-row');
  await screen.findByText('Priya Raman');
  await waitFor(() =>
    expect(screen.getByRole('option', { name: campaign.name })).toBeInTheDocument(),
  );
  return view;
}

// ── S7 loading / populated / defaults ─────────────────────────────────────────────────

describe('S7 loading', () => {
  it('shows the form skeleton under the one <h1>', async () => {
    settingsApi();
    mockApi.pending('GET /api/me/settings');
    const { container } = renderWithProviders(<SettingsPage />, { roles: ['reviewer'] });
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Settings']);
    expect(screen.getByText('Loading settings')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S7 populated', () => {
  it('radiogroups, fields and switches are checked from the fixture', async () => {
    const { container } = await populated();
    expect(radio('Theme', 'System')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Theme', 'Light')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Density', 'Comfortable')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Motion', 'System')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Default campaign' })).toHaveValue(IDS.campaigns.q4ClinicalQuality);
    expect(screen.getByRole('combobox', { name: 'Default asset type' })).toHaveValue('');
    expect(cardsInput()).toHaveValue(20);
    expect(screen.getByRole('switch', { name: 'Show keyboard hints' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('settings-defaults-note')).not.toBeInTheDocument();
    expect(footer()).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('notifications: one row per event, in-app editable, Slack / Teams / webhook disabled ("Coming later")', async () => {
    await populated();
    const rows = screen.getAllByTestId('settings-notifications-row');
    expect(rows.map((r) => r.getAttribute('data-event-type'))).toEqual([
      'asset.certified',
      'campaign.created',
      'campaign.completed',
      'vote.milestone',
      'feedback.branch_ready',
      'feedback.failed',
    ]);
    expect(screen.getByRole('switch', { name: 'Asset certified: in-app' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Asset certified: in-app' })).toHaveAttribute('aria-checked', 'true');
    const slack = screen.getByRole('switch', { name: 'Feedback branch ready: Slack (coming later)' });
    expect(slack).toBeDisabled();
    expect(slack).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Vote milestone: Teams (coming later)' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Vote milestone: Webhook (coming later)' })).toBeDisabled();
    expect(screen.getAllByText('Coming later')).toHaveLength(3);
    // Notification preferences no longer need the admin page (F8): this screen loads them for a reviewer.
    expect(calls('GET /api/notifications/preferences')).toHaveLength(1);
  });

  it('About shows who is signed in and the roles', async () => {
    await populated();
    expect(screen.getByText('priya.raman@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('settings-about-roles')).toHaveTextContent('reviewer, steward');
  });
});

describe('S7 defaults', () => {
  it('shows the muted "Using defaults" note when the API returns defaults', async () => {
    const { container } = await populated({ initial: userSettingsDefaults });
    expect(screen.getByTestId('settings-defaults-note')).toHaveTextContent('Using defaults');
    expect(screen.getByRole('combobox', { name: 'Default campaign' })).toHaveValue('');
    await expectNoAxeViolations(container);
  });
});

// ── S7 dirty / saving / saved ─────────────────────────────────────────────────────────

describe('S7 dirty / saving / saved', () => {
  it('a change shows the footer; Save sends only the changed fields and shows the toast', async () => {
    const { user, container } = await populated();
    await user.click(radio('Density', 'Compact'));
    expect(footer()).toHaveTextContent('You have unsaved changes');
    await user.clear(cardsInput());
    await user.type(cardsInput(), '30');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Default asset type' }), 'measure');
    await expectNoAxeViolations(container);

    await user.click(saveButton());
    await waitFor(() => expect(calls('PUT /api/me/settings')).toHaveLength(1));
    const body = calls('PUT /api/me/settings')[0].body;
    expect(UpdateUserSettingsRequestSchema.parse(body)).toEqual({
      density: 'compact',
      cardsPerSession: 30,
      defaultAssetType: 'measure',
    });
    expect(body).toEqual({ density: 'compact', cardsPerSession: 30, defaultAssetType: 'measure' });
    expect(calls('PUT /api/notifications/preferences')).toHaveLength(0);
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    await waitFor(() => expect(footer()).not.toBeInTheDocument());
    expect(radio('Density', 'Compact')).toHaveAttribute('aria-checked', 'true');
    await expectNoAxeViolations(container);
  });

  it('shows "Saving changes…" with the buttons disabled while the PUT is in flight', async () => {
    const { user, container } = await populated();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockApi({
      'PUT /api/me/settings': async (req: MockRequest) => {
        await gate;
        return { ...userSettings, ...(req.body as Partial<UserSettings>), updatedAt: FIXTURE_NOW };
      },
    });
    await user.click(screen.getByRole('switch', { name: 'Show keyboard hints' }));
    await user.click(saveButton());
    expect(await screen.findByText('Saving changes…')).toBeInTheDocument();
    expect(screen.getByTestId('settings-footer-save')).toBeDisabled();
    expect(screen.getByTestId('settings-footer-discard')).toBeDisabled();
    await expectNoAxeViolations(container);
    release();
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ showKeyboardHints: false });
  });

  it('notification changes send only the changed rows and keep a stored Slack channel', async () => {
    const { user } = await populated();
    await user.click(screen.getByRole('switch', { name: 'Vote milestone: in-app' }));
    await user.click(screen.getByRole('switch', { name: 'Feedback branch ready: in-app' }));
    await user.click(screen.getByRole('switch', { name: 'Campaign completed: daily digest' }));
    expect(footer()).toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() => expect(calls('PUT /api/notifications/preferences')).toHaveLength(1));
    const body = UpdatePreferencesBodySchema.parse(calls('PUT /api/notifications/preferences')[0].body);
    expect(body.preferences).toEqual([
      { eventType: 'campaign.completed', channels: ['in_app'], digest: true },
      { eventType: 'vote.milestone', channels: [], digest: false },
      { eventType: 'feedback.branch_ready', channels: ['slack'], digest: false },
    ]);
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    await waitFor(() => expect(footer()).not.toBeInTheDocument());
    expect(screen.getByRole('switch', { name: 'Vote milestone: in-app' })).toHaveAttribute('aria-checked', 'false');
  });

  it('Discard restores the saved values (theme included) and sends nothing', async () => {
    const { user } = await populated({ initial: settingsWithTheme('light') });
    expect(isDark()).toBe(false);
    await user.click(radio('Theme', 'Dark'));
    await waitFor(() => expect(isDark()).toBe(true));
    await user.click(radio('Motion', 'Reduce'));
    await user.click(screen.getByRole('switch', { name: 'Asset certified: in-app' }));
    await user.click(screen.getByTestId('settings-footer-discard'));
    expect(footer()).not.toBeInTheDocument();
    expect(radio('Theme', 'Light')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Motion', 'System')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Asset certified: in-app' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(isDark()).toBe(false));
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
    expect(calls('PUT /api/notifications/preferences')).toHaveLength(0);
  });

  it('a save error keeps the changes and offers Retry', async () => {
    const { user, container } = await populated();
    mockApi.error('PUT /api/me/settings', 503, 'UPSTREAM_ERROR', 'Lakebase is waking up');
    await user.click(radio('Density', 'Compact'));
    await user.click(saveButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't save your settings");
    expect(alert).toHaveTextContent('Lakebase is waking up');
    expect(footer()).toBeInTheDocument();
    expect(radio('Density', 'Compact')).toHaveAttribute('aria-checked', 'true');
    await expectNoAxeViolations(container);

    settingsApi();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(calls('PUT /api/me/settings').map((c) => c.body)).toEqual([{ density: 'compact' }, { density: 'compact' }]);
  });
});

// ── S7 validation ───────────────────────────────────────────────────────────────────

describe('S7 validation', () => {
  it('cards per session 150 shows an inline error, focuses the field and sends no request', async () => {
    const { user, container } = await populated();
    await user.clear(cardsInput());
    await user.type(cardsInput(), '150');
    await user.click(saveButton());
    expect(screen.getByTestId('settings-review-cards-error')).toHaveTextContent('Enter a whole number from 5 to 100');
    expect(cardsInput()).toHaveAttribute('aria-invalid', 'true');
    expect(cardsInput()).toHaveAccessibleDescription(/Enter a whole number from 5 to 100/);
    expect(cardsInput()).toHaveFocus();
    await pressKey(user, 'Ctrl+s');
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
    expect(calls('PUT /api/notifications/preferences')).toHaveLength(0);
    await expectNoAxeViolations(container);

    await user.clear(cardsInput());
    await user.type(cardsInput(), '100');
    expect(screen.queryByTestId('settings-review-cards-error')).not.toBeInTheDocument();
    await user.click(saveButton());
    await waitFor(() => expect(calls('PUT /api/me/settings')).toHaveLength(1));
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ cardsPerSession: 100 });
  });
});

// ── S7 error / offline ──────────────────────────────────────────────────────────────

describe('S7 error / offline', () => {
  it('a load error shows an alert with Retry; Retry loads the form', async () => {
    settingsApi();
    mockApi.error('GET /api/me/settings', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { user, container } = renderWithProviders(<SettingsPage />, { roles: ['reviewer'] });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load your settings");
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await expectNoAxeViolations(container);

    mockApi({ 'GET /api/me/settings': userSettings });
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't load your settings")).not.toBeInTheDocument();
  });

  it('a preferences load error stays inside the Notifications section', async () => {
    settingsApi();
    mockApi.error('GET /api/notifications/preferences', 503, 'UPSTREAM_ERROR', 'Lakebase is waking up');
    const { container } = renderWithProviders(<SettingsPage />, { roles: ['reviewer'] });
    const section = await screen.findByRole('region', { name: 'Notifications' });
    expect(await within(section).findByRole('alert')).toHaveTextContent("We couldn't load your notification preferences");
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Priya Raman')).toBeInTheDocument());
    await expectNoAxeViolations(container);
  });

  it('offline: the form is disabled, the theme still switches locally, and nothing is sent', async () => {
    const { user, container } = await populated({ initial: settingsWithTheme('light') });
    setOnline(false);
    expect(await screen.findByTestId('settings-offline-note')).toHaveTextContent("You're offline.");
    expect(radio('Density', 'Compact')).toBeDisabled();
    expect(radio('Motion', 'Reduce')).toBeDisabled();
    expect(cardsInput()).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Default campaign' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show keyboard hints' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Asset certified: in-app' })).toBeDisabled();
    expect(radio('Theme', 'Dark')).toBeEnabled();

    await user.click(radio('Theme', 'Dark'));
    await waitFor(() => expect(isDark()).toBe(true));
    expect(saveButton()).toBeDisabled();
    await pressKey(user, 'Ctrl+s');
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
    await expectNoAxeViolations(container);
    // Back online before the test ends (the harness restores navigator.onLine without an event).
    setOnline(true);
  });
});

// ── KB K5 ─────────────────────────────────────────────────────────────────────────

describe('KB K5 Settings', () => {
  it('arrow keys change the Theme radiogroup and <html> class; Ctrl+S sends only the changed field', async () => {
    const { user } = await populated({ initial: settingsWithTheme('light') });
    expect(isDark()).toBe(false);
    const light = await tabUntil(user, /^Light/);
    expect(light).toHaveAttribute('role', 'radio');
    expect(light).toHaveAttribute('aria-checked', 'true');

    await pressKey(user, 'ArrowRight');
    expect(radio('Theme', 'Dark')).toHaveFocus();
    expect(radio('Theme', 'Dark')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(isDark()).toBe(true));

    await pressKey(user, 'ArrowLeft');
    expect(radio('Theme', 'Light')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(isDark()).toBe(false));
    await pressKey(user, 'ArrowRight');
    await waitFor(() => expect(isDark()).toBe(true));
    expect(calls('PUT /api/me/settings')).toHaveLength(0);

    // Tab leaves the group in one step (single tab stop).
    await user.tab();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).not.toContainElement(document.activeElement as HTMLElement);

    await pressKey(user, 'Ctrl+s');
    await waitFor(() => expect(calls('PUT /api/me/settings')).toHaveLength(1));
    expect(calls('PUT /api/me/settings')[0].body).toEqual({ theme: 'dark' });
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it('Ctrl+S with nothing changed sends nothing', async () => {
    const { user } = await populated();
    await pressKey(user, 'Ctrl+s');
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
    expect(calls('PUT /api/notifications/preferences')).toHaveLength(0);
  });
});

// ── §7.3 theme wiring ───────────────────────────────────────────────────────────────────

describe('S7 theme wiring (§7.3)', () => {
  it('populated state in light and dark: <html> class matches and axe passes', async () => {
    await renderInBothThemes(async (theme) => {
      const { container } = await populated({ theme, initial: settingsWithTheme(theme) });
      expect(isDark()).toBe(theme === 'dark');
      expect(radio('Theme', theme === 'dark' ? 'Dark' : 'Light')).toHaveAttribute('aria-checked', 'true');
      await expectNoAxeViolations(container);
    });
  });

  it('ThemeSync seeds the provider from settings `system` (OS dark) and the System radio is checked', async () => {
    stubMatchMedia({ prefersDark: true });
    settingsApi(settingsWithTheme('system'));
    renderWithProviders(
      <>
        <ThemeSync />
        <SettingsPage />
      </>,
      { roles: ['reviewer'], theme: 'light' },
    );
    await screen.findByRole('radiogroup', { name: 'Theme' });
    expect(radio('Theme', 'System')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(isDark()).toBe(true));
    expect(calls('PUT /api/me/settings')).toHaveLength(0);
  });
});
