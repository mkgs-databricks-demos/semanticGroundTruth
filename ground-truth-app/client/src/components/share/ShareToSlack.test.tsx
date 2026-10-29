// @a11y-strict
// client/src/components/share/ShareToSlack.test.tsx — Share to Slack UI (G5 Option A)
// Session 56 · Build 5 · wave 5-3 (plan 56 step 4)
//
// Mounted in the bell (S0) and the asset detail sheet (S4): a reviewer sees no
// action; flag off hides it; steward draft flow (request body parsed by the
// contract), send flow (permalink opens in a new tab), needs_slack_login (with
// and without a login URL), 403, 429 (retry-after); debounced channel search;
// combobox keyboard; focus trap, Escape, focus return; axe light + dark.

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppRuntimeConfig, ShareSlackResponse, SlackChannel } from '../../../../shared/contracts';
import { ShareSlackRequestSchema } from '../../../../shared/contracts';
import { expectNoAxeViolations } from '../../test/axe';
import {
  assetReadmissionRate,
  notificationCertified,
  notificationsRoutes,
  runtimeConfig,
} from '../../test/fixtures';
import { pressKey } from '../../test/keyboard';
import type { MockRequest } from '../../test/mockApi';
import { calls, mockApi } from '../../test/mockApi';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { RenderWithProvidersOptions } from '../../test/render';
import { NotificationBell } from '../layout/NotificationBell';
import { AssetDetailSheet } from '../steward/AssetDetailSheet';
import {
  SHARE_DIALOG_TITLE,
  SHARE_FORBIDDEN_TITLE,
  SHARE_LOGIN_TITLE,
  SHARE_RATE_LIMITED_TITLE,
  SLACK_CONNECT_HINT,
  safeHttpsUrl,
  sharePreviewLines,
} from './ShareToSlackDialog';

const STEWARD = ['reviewer', 'steward'] as const;
const CHANNELS: SlackChannel[] = [
  { id: 'C0123ABCD', name: 'data-stewards' },
  { id: 'C0456EFGH', name: 'data-quality' },
];
const PERMALINK = 'https://example.slack.com/archives/C0123ABCD/p1761638400000100';
const LOGIN_URL = 'https://example.cloud.databricks.com/explore/data/system/ai/slack';
const NOTIFY_KEY = 'POST /api/notifications/:id/share-slack';
const ASSET_KEY = 'POST /api/assets/:assetId/share-slack';
const flagOff: AppRuntimeConfig = { ...runtimeConfig, slackShareEnabled: false };
const assetName = assetReadmissionRate.displayName || assetReadmissionRate.name;

/** GET /api/slack/channels filtered by ?query= like the server would. */
const channelsHandler = (req: MockRequest) =>
  CHANNELS.filter((c) => !req.query.query || c.name.includes(req.query.query));

function renderBell(options: RenderWithProvidersOptions & { config?: AppRuntimeConfig; share?: unknown } = {}) {
  const { config = runtimeConfig, share = { status: 'drafted', permalink: PERMALINK }, ...rest } = options;
  mockApi({
    ...notificationsRoutes,
    'GET /api/config': config,
    'GET /api/slack/channels': channelsHandler,
    [NOTIFY_KEY]: share,
  });
  return renderWithProviders(<NotificationBell />, { roles: [...STEWARD], ...rest });
}

function renderSheet(options: RenderWithProvidersOptions & { config?: AppRuntimeConfig; share?: unknown } = {}) {
  const { config = runtimeConfig, share = { status: 'sent', permalink: PERMALINK }, ...rest } = options;
  mockApi({
    'GET /api/assets/:assetId': assetReadmissionRate,
    'GET /api/assets/:assetId/versions': [],
    'GET /api/config': config,
    'GET /api/slack/channels': channelsHandler,
    [ASSET_KEY]: share,
  });
  return renderWithProviders(
    <AssetDetailSheet assetId={assetReadmissionRate.id} open onOpenChange={() => {}} />,
    { roles: [...STEWARD], route: '/steward', ...rest },
  );
}

type User = ReturnType<typeof renderWithProviders>['user'];

async function openBellShare(user: User) {
  await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
  const popover = screen.getByRole('dialog', { name: 'Notifications' });
  const buttons = await within(popover).findAllByTestId('shell-notification-share-button');
  await user.click(buttons[0]!);
  return screen.findByRole('dialog', { name: SHARE_DIALOG_TITLE });
}

async function openSheetShare(user: User) {
  const sheet = await screen.findByRole('dialog', { name: assetName });
  await user.click(await within(sheet).findByTestId('steward-asset-share-button'));
  return screen.findByRole('dialog', { name: SHARE_DIALOG_TITLE });
}

/** Type into the channel combobox, wait for the debounced search, pick with the keyboard. */
async function pickChannel(user: User, dialog: HTMLElement, query: string, expectedName: string) {
  const input = within(dialog).getByRole('combobox', { name: 'Channel' });
  await user.click(input);
  await user.type(input, query);
  await waitFor(() => expect(calls('GET /api/slack/channels').some((c) => c.query.query === query)).toBe(true));
  await within(dialog).findByRole('option', { name: `#${expectedName}` });
  await pressKey(user, 'ArrowDown');
  expect(input).toHaveAttribute('aria-activedescendant');
  await pressKey(user, 'Enter');
  expect(input).toHaveValue(`#${expectedName}`);
  expect(input).toHaveAttribute('aria-expanded', 'false');
}

// ── Visibility ────────────────────────────────────────────────────────────────────

describe('Share to Slack · who sees the action', () => {
  it('a reviewer sees no action in the bell, and GET /api/config is never asked for', async () => {
    mockApi(notificationsRoutes);
    const { user } = renderWithProviders(<NotificationBell />, { roles: ['reviewer'] });
    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    await waitFor(() => expect(within(popover).getAllByTestId('shell-notification-item')).toHaveLength(2));
    expect(within(popover).queryByTestId('shell-notification-share-button')).toBeNull();
    expect(calls('GET /api/config')).toHaveLength(0);
  });

  it('a reviewer sees no action in the asset sheet', async () => {
    mockApi({ 'GET /api/assets/:assetId': assetReadmissionRate, 'GET /api/assets/:assetId/versions': [] });
    renderWithProviders(<AssetDetailSheet assetId={assetReadmissionRate.id} open onOpenChange={() => {}} />, {
      roles: ['reviewer'],
    });
    const sheet = await screen.findByRole('dialog', { name: assetName });
    expect(await within(sheet).findByText('No versions recorded.')).toBeInTheDocument();
    expect(within(sheet).queryByTestId('steward-asset-share-button')).toBeNull();
    expect(calls('GET /api/config')).toHaveLength(0);
  });

  it('flag off (slackShareEnabled false) hides the action in the bell and the sheet', async () => {
    const { user, unmount } = renderBell({ config: flagOff });
    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    await waitFor(() => expect(within(popover).getAllByTestId('shell-notification-item')).toHaveLength(2));
    await waitFor(() => expect(calls('GET /api/config')).toHaveLength(1));
    expect(within(popover).queryByTestId('shell-notification-share-button')).toBeNull();
    unmount();

    renderSheet({ config: flagOff });
    const sheet = await screen.findByRole('dialog', { name: assetName });
    expect(await within(sheet).findByText('No versions recorded.')).toBeInTheDocument();
    await waitFor(() => expect(calls('GET /api/config').length).toBeGreaterThanOrEqual(2));
    expect(within(sheet).queryByTestId('steward-asset-share-button')).toBeNull();
  });

  it('a steward sees one named action per notification, next to the notificationActions slot', async () => {
    mockApi({ ...notificationsRoutes, 'GET /api/config': runtimeConfig });
    const { user } = renderWithProviders(
      <NotificationBell notificationActions={(n) => <button type="button">{`Open ${n.title}`}</button>} />,
      { roles: [...STEWARD] },
    );
    await user.click(await screen.findByRole('button', { name: /^Notifications/ }));
    const popover = screen.getByRole('dialog', { name: 'Notifications' });
    const buttons = await within(popover).findAllByTestId('shell-notification-share-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName(`Share to Slack: ${notificationCertified.title}`);
    expect(within(popover).getByRole('button', { name: `Open ${notificationCertified.title}` })).toBeInTheDocument();
  });
});

// ── Flows ─────────────────────────────────────────────────────────────────────────

describe('Share to Slack · steward flows', () => {
  it('draft (default) from the bell: debounced search, preview, note, contract-valid body, drafted result, focus back to the bell', async () => {
    const { user } = renderBell();
    const dialog = await openBellShare(user);
    // The popover closed so the modal dialog owns focus.
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    expect(within(dialog).getByText(`Share “${notificationCertified.title}” with a Slack channel.`)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Draft to me/ })).toBeChecked();
    const submit = within(dialog).getByTestId('share-slack-submit-button');
    expect(submit).toBeDisabled();

    await pickChannel(user, dialog, 'stew', 'data-stewards');
    // Debounced: no request per keystroke ("s", "st", "ste").
    expect(calls('GET /api/slack/channels').map((c) => c.query.query ?? '')).not.toContain('st');

    await user.type(within(dialog).getByRole('textbox', { name: 'Add a note (optional)' }), 'Please review');
    const preview = within(dialog).getByTestId('share-slack-preview-text');
    expect(preview).toHaveTextContent(notificationCertified.title);
    expect(preview).toHaveTextContent('Note: Please review');

    expect(submit).toHaveTextContent('Save draft');
    await user.click(submit);
    await waitFor(() => expect(calls(NOTIFY_KEY)).toHaveLength(1));
    const req = calls(NOTIFY_KEY)[0]!;
    expect(req.params.id).toBe(notificationCertified.id);
    expect(ShareSlackRequestSchema.parse(req.body)).toEqual({ channelId: 'C0123ABCD', mode: 'draft', message: 'Please review' });

    const result = await within(dialog).findByTestId('share-slack-result-root');
    expect(result).toHaveAttribute('data-status', 'drafted');
    expect(result).toHaveTextContent('Draft saved for #data-stewards');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: SHARE_DIALOG_TITLE })).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('shell-bell-button'));
  });

  it('send from the asset sheet: no note sends no message, permalink opens in a new tab', async () => {
    const { user } = renderSheet();
    const dialog = await openSheetShare(user);
    expect(within(dialog).getByTestId('share-slack-preview-text')).toHaveTextContent(
      `Asset: ${assetReadmissionRate.name} (${assetReadmissionRate.assetType})`,
    );
    await pickChannel(user, dialog, 'quality', 'data-quality');
    await user.click(within(dialog).getByRole('radio', { name: /Send to channel/ }));
    const submit = within(dialog).getByTestId('share-slack-submit-button');
    expect(submit).toHaveTextContent('Send to Slack');
    await user.click(submit);

    await waitFor(() => expect(calls(ASSET_KEY)).toHaveLength(1));
    const req = calls(ASSET_KEY)[0]!;
    expect(req.params.assetId).toBe(assetReadmissionRate.id);
    expect(ShareSlackRequestSchema.parse(req.body)).toEqual({ channelId: 'C0456EFGH', mode: 'send' });

    const result = await within(dialog).findByTestId('share-slack-result-root');
    expect(result).toHaveAttribute('data-status', 'sent');
    expect(result).toHaveTextContent('Sent to #data-quality');
    const link = within(result).getByRole('link', { name: /View in Slack \(opens in a new tab\)/ });
    expect(link).toHaveAttribute('href', PERMALINK);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('needs_slack_login with a login URL: explains Catalog Explorer and links to it', async () => {
    const share: ShareSlackResponse = { status: 'needs_slack_login', loginUrl: LOGIN_URL };
    const { user } = renderBell({ share });
    const dialog = await openBellShare(user);
    await pickChannel(user, dialog, 'stew', 'data-stewards');
    await user.click(within(dialog).getByTestId('share-slack-submit-button'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(SHARE_LOGIN_TITLE);
    expect(alert).toHaveTextContent(SLACK_CONNECT_HINT);
    const link = within(alert).getByRole('link', { name: /Connect Slack \(opens in a new tab\)/ });
    expect(link).toHaveAttribute('href', LOGIN_URL);
    // The form stays so the user can retry after connecting.
    expect(within(dialog).getByTestId('share-slack-submit-button')).toBeEnabled();
  });

  it('needs_slack_login without a URL (or a non-https one) falls back to the Catalog Explorer steps', async () => {
    const share: ShareSlackResponse = { status: 'needs_slack_login', loginUrl: 'javascript:alert(1)' };
    const { user } = renderSheet({ share });
    const dialog = await openSheetShare(user);
    await pickChannel(user, dialog, 'stew', 'data-stewards');
    await user.click(within(dialog).getByTestId('share-slack-submit-button'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Open system.ai.slack in Catalog Explorer and click Login.');
    expect(within(alert).queryByRole('link')).toBeNull();
  });

  it('429 shows the retry-after and a Retry that sends again', async () => {
    const { user } = renderBell();
    mockApi.error(NOTIFY_KEY, 429, 'RATE_LIMITED', 'Slack rate limit', { retryAfterSeconds: 30 });
    const dialog = await openBellShare(user);
    await pickChannel(user, dialog, 'stew', 'data-stewards');
    await user.click(within(dialog).getByTestId('share-slack-submit-button'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(SHARE_RATE_LIMITED_TITLE);
    expect(alert).toHaveTextContent('Try again in 30 seconds.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls(NOTIFY_KEY)).toHaveLength(2));
  });

  it('403 explains the missing privilege', async () => {
    const { user } = renderSheet();
    mockApi.error(ASSET_KEY, 403, 'FORBIDDEN', 'No EXECUTE privilege on system.ai.slack');
    const dialog = await openSheetShare(user);
    await pickChannel(user, dialog, 'stew', 'data-stewards');
    await user.click(within(dialog).getByTestId('share-slack-submit-button'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(SHARE_FORBIDDEN_TITLE);
    expect(alert).toHaveTextContent('No EXECUTE privilege on system.ai.slack');
  });

  it('no matching channel says so and keeps Share disabled', async () => {
    const { user } = renderBell();
    const dialog = await openBellShare(user);
    const input = within(dialog).getByRole('combobox', { name: 'Channel' });
    await user.type(input, 'zzz');
    expect(await within(dialog).findByText('No channels match “zzz”.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('option')).toBeNull();
    expect(within(dialog).getByTestId('share-slack-submit-button')).toBeDisabled();
  });
});

// ── Keyboard ──────────────────────────────────────────────────────────────────────

describe('Share to Slack · keyboard', () => {
  it('focus is trapped in the dialog while tabbing', async () => {
    const { user } = renderSheet();
    const dialog = await openSheetShare(user);
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('Escape closes the channel list first, then the dialog; focus returns to Share, the sheet stays open', async () => {
    const { user } = renderSheet();
    const dialog = await openSheetShare(user);
    const input = within(dialog).getByRole('combobox', { name: 'Channel' });
    await user.click(input);
    await within(dialog).findAllByRole('option');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await pressKey(user, 'Escape');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: SHARE_DIALOG_TITLE })).toBeInTheDocument();

    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: SHARE_DIALOG_TITLE })).toBeNull());
    expect(screen.getByRole('dialog', { name: assetName })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('steward-asset-share-button'));
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────────

describe('Share to Slack · helpers', () => {
  it('safeHttpsUrl keeps only https URLs', () => {
    expect(safeHttpsUrl(PERMALINK)).toBe(PERMALINK);
    expect(safeHttpsUrl('http://example.com')).toBeNull();
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('not a url')).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });

  it('sharePreviewLines mirrors the server layout and appends the note', () => {
    const lines = sharePreviewLines({ kind: 'notification', notification: notificationCertified }, '  hi ');
    expect(lines[0]).toBe(notificationCertified.title);
    expect(lines[1]).toBe(notificationCertified.body);
    expect(lines.at(-1)).toBe('Note: hi');
    expect(sharePreviewLines({ kind: 'asset', asset: assetReadmissionRate }, '')).not.toContain('');
  });
});

// ── Axe ─────────────────────────────────────────────────────────────────────────

describe('Share to Slack · axe', () => {
  it('no violations in light and dark (form with the list open, login needed, sent)', async () => {
    await renderInBothThemes(async (theme) => {
      const { user } = renderSheet({ theme, share: { status: 'needs_slack_login', loginUrl: LOGIN_URL } });
      const dialog = await openSheetShare(user);
      await user.click(within(dialog).getByRole('combobox', { name: 'Channel' }));
      await within(dialog).findAllByRole('option');
      await expectNoAxeViolations(document.body);
      await pickChannel(user, dialog, 'stew', 'data-stewards');
      await user.click(within(dialog).getByTestId('share-slack-submit-button'));
      await within(dialog).findByRole('alert');
      await expectNoAxeViolations(document.body);
    });
    await renderInBothThemes(async (theme) => {
      const { user } = renderBell({ theme, share: { status: 'sent', permalink: PERMALINK } });
      const dialog = await openBellShare(user);
      await pickChannel(user, dialog, 'stew', 'data-stewards');
      await user.click(within(dialog).getByTestId('share-slack-submit-button'));
      await within(dialog).findByTestId('share-slack-result-root');
      await expectNoAxeViolations(document.body);
    });
  });
});
