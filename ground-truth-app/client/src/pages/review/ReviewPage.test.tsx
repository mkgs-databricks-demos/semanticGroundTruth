// @a11y-strict
// client/src/pages/review/ReviewPage.test.tsx — S1 Review: every ui_test_strategy §8 S1 row + KB K1
// Session 51 · Build 5 · wave 5-2. One describe per state; every state ends with axe.

import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKIP_REASONS } from '../../../../shared/contracts';
import type { ReviewCard, SkipResponse, UserSettings, VoteBody } from '../../../../shared/contracts';
import { EDIT_NEEDS_CHANGE_MESSAGE } from '../../components/review/EditSheet';
import { queryKeys } from '../../lib/api/keys';
import { expectNoAxeViolations } from '../../test/axe';
import { assetDischargeDisposition, reviewCard, reviewRoutes, skipResponse } from '../../test/fixtures/review';
import { userSettings } from '../../test/fixtures/settings';
import { pressKey, pressKeys, tabUntil } from '../../test/keyboard';
import { stubMatchMedia } from '../../test/media';
import { mockApi, PENDING_REPLY } from '../../test/mockApi';
import type { MockHandlers, MockRequest } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { createTestQueryClient, renderInBothThemes, renderWithProviders } from '../../test/render';
import type { TestTheme } from '../../test/render';
import { OFFLINE_REASON, ReviewPage, SKIP_ERROR_TOAST, VOTE_ERROR_TOAST } from './ReviewPage';

const TITLE = 'Readmission Rate (30-day)';
const NEXT_TITLE = 'Discharge Disposition';

/** Saved settings without a default campaign (most tests). */
const SETTINGS: UserSettings = { ...userSettings, defaultCampaignId: null };

const nextCard: ReviewCard = {
  ...reviewCard,
  asset: assetDischargeDisposition,
  synonyms: [],
  examples: [],
  confidence: null,
  progress: { reviewed: 43, total: 120 },
};

/** GET /api/review/next handler that returns `cards` in order, then repeats the last one. */
function sequence(...cards: Array<ReviewCard | null>) {
  let i = 0;
  return () => cards[Math.min(i++, cards.length - 1)];
}

function skipWith(skippedToday: number) {
  return (req: MockRequest): SkipResponse => ({
    ...skipResponse,
    skip: { ...skipResponse.skip, reason: (req.body as { reason?: SkipResponse['skip']['reason'] }).reason ?? null },
    stats: { skippedCount: skipResponse.stats.skippedCount + 1, skippedToday },
  });
}

interface SetupOptions {
  handlers?: MockHandlers;
  settings?: UserSettings;
  theme?: TestTheme;
  online?: boolean;
  queryClient?: ReturnType<typeof createTestQueryClient>;
}

function setup(options: SetupOptions = {}) {
  const api = mockApi({ ...reviewRoutes, ...options.handlers });
  const result = renderWithProviders(<ReviewPage />, {
    settings: options.settings ?? SETTINGS,
    theme: options.theme,
    online: options.online,
    queryClient: options.queryClient,
  });
  return { ...result, api };
}

function votes(api: ReturnType<typeof mockApi>): VoteBody[] {
  return api.calls('POST /api/review/vote').map((c) => c.body as VoteBody);
}

function liveRegion() {
  return screen.getByTestId('review-live-region');
}

function motionMode(): string | undefined {
  return screen.getByTestId('review-card-root').closest<HTMLElement>('[data-motion]')?.dataset.motion;
}

describe('S1 Review · loading', () => {
  it('shows the card skeleton and no card or vote buttons', async () => {
    const { container } = setup({ handlers: { 'GET /api/review/next': PENDING_REPLY } });
    expect(await screen.findByText('Loading the next card')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Campaign' })).toBeInTheDocument());
    expect(screen.queryByTestId('review-card-root')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve (A)' })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S1 Review · populated', () => {
  it('renders the card per the brief: heading, meter, progress, 4 vote buttons', async () => {
    const { api } = setup();
    expect(await screen.findByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Confidence 71%' })).toHaveAttribute('aria-valuenow', '71');
    expect(screen.getByText('71% confidence · 11 votes')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Review progress 42 of 120' })).toBeInTheDocument();
    for (const name of ['Reject (R)', 'Edit (E)', 'Approve (A)', 'Skip (S)', 'Choose a skip reason']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByTestId('review-card-type-badge')).toHaveTextContent('Measure');
    expect(screen.getByTestId('review-card-status-badge')).toHaveTextContent('Pending');
    expect(screen.getByText('Clinical Quality / Outcomes')).toBeInTheDocument();
    expect(await screen.findByTestId('review-streak-badge')).toHaveTextContent('6-day streak');
    expect(await screen.findByTestId('review-skip-counter')).toHaveTextContent('Skipped today: 3');
    expect(screen.queryByText('You skipped this earlier')).not.toBeInTheDocument();
    // No saved default campaign: GET /api/review/next has no filter.
    expect(api.calls('GET /api/review/next')[0].query).toEqual({});
  });

  it('uses the saved default campaign as the filter when the URL has none', async () => {
    const { api } = setup({ settings: userSettings });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    expect(api.calls('GET /api/review/next')[0].query).toEqual({ campaignId: userSettings.defaultCampaignId });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Campaign' })).toHaveValue(userSettings.defaultCampaignId),
    );
  });

  it('Logic disclosure shows plain-English logic and toggles its name', async () => {
    const { user } = setup();
    const toggle = await screen.findByRole('button', { name: 'Show logic' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide logic' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Excludes planned readmissions and transfers/)).toBeInTheDocument();
  });

  it('passes axe and follows the theme in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      const { container } = setup({ theme });
      await screen.findByRole('heading', { level: 2, name: TITLE });
      await screen.findByTestId('review-skip-counter');
      expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark');
      await expectNoAxeViolations(container);
    });
  });
});

describe('S1 Review · approve / reject / edit', () => {
  it('approve sends a VoteBody, announces it and shows the next card', async () => {
    const { user, api } = setup({ handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard) } });
    await user.click(await screen.findByRole('button', { name: 'Approve (A)' }));
    expect(await screen.findByRole('heading', { level: 2, name: NEXT_TITLE })).toBeInTheDocument();
    expect(votes(api)).toEqual([{ assetId: reviewCard.asset.id, voteType: 'approve' }]);
    expect(liveRegion()).toHaveTextContent(`Approved ${TITLE}`);
  });

  it('reject opens the sheet; submit sends the feedback', async () => {
    const { user, api } = setup({ handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard) } });
    await user.click(await screen.findByRole('button', { name: 'Reject (R)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reject definition' });
    const field = within(sheet).getByLabelText(/What's wrong\?/);
    await user.type(field, 'Denominator should exclude transfers');
    expect(within(sheet).getByText('36 / 4000')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
    await user.click(within(sheet).getByTestId('review-reject-sheet-submit'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reject definition' })).not.toBeInTheDocument());
    expect(votes(api)).toEqual([
      { assetId: reviewCard.asset.id, voteType: 'reject', feedback: 'Denominator should exclude transfers' },
    ]);
    expect(liveRegion()).toHaveTextContent(`Rejected ${TITLE}`);
  });

  it('reject without feedback sends no feedback field', async () => {
    const { user, api } = setup();
    await user.click(await screen.findByRole('button', { name: 'Reject (R)' }));
    await user.click(within(await screen.findByRole('dialog')).getByTestId('review-reject-sheet-submit'));
    await waitFor(() => expect(votes(api)).toHaveLength(1));
    expect(votes(api)[0]).toEqual({ assetId: reviewCard.asset.id, voteType: 'reject' });
  });

  it('edit needs a changed value (inline error, no request), then sends only the changed field', async () => {
    const { user, api } = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit (E)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit definition' });
    expect(within(sheet).getByLabelText('Display name')).toHaveValue(TITLE);
    await user.click(within(sheet).getByTestId('review-edit-sheet-submit'));
    expect(within(sheet).getByRole('alert')).toHaveTextContent(EDIT_NEEDS_CHANGE_MESSAGE);
    expect(within(sheet).getByLabelText('Display name')).toHaveAttribute('aria-invalid', 'true');
    expect(votes(api)).toHaveLength(0);
    await expectNoAxeViolations(document.body);

    const description = within(sheet).getByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Unplanned readmissions within 30 days of discharge.');
    await user.click(within(sheet).getByTestId('review-edit-sheet-submit'));
    await waitFor(() => expect(votes(api)).toHaveLength(1));
    expect(votes(api)[0]).toEqual({
      assetId: reviewCard.asset.id,
      voteType: 'edit',
      edits: { description: 'Unplanned readmissions within 30 days of discharge.' },
    });
  });
});

describe('S1 Review · skip', () => {
  it('posts /api/review/skip only, updates the counter and toasts the cooldown', async () => {
    const { user, api } = setup({
      handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard), 'POST /api/review/skip': skipWith(4) },
    });
    await screen.findByTestId('review-skip-counter');
    await user.click(await screen.findByRole('button', { name: 'Skip (S)' }));
    expect(await screen.findByText("Skipped. You'll see it again in 24 h")).toBeInTheDocument();
    expect(screen.getByTestId('review-skip-counter')).toHaveTextContent('Skipped today: 4');
    expect(api.calls('POST /api/review/skip').map((c) => c.body)).toEqual([
      { assetId: reviewCard.asset.id, campaignId: reviewCard.campaign?.campaignId },
    ]);
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
    expect(liveRegion()).toHaveTextContent(`Skipped ${TITLE}`);
    expect(await screen.findByRole('heading', { level: 2, name: NEXT_TITLE })).toBeInTheDocument();
  });

  it('skip error keeps the card and shows a toast', async () => {
    mockApi(reviewRoutes);
    mockApi.error('POST /api/review/skip', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { user } = renderWithProviders(<ReviewPage />, { settings: SETTINGS });
    await user.click(await screen.findByRole('button', { name: 'Skip (S)' }));
    expect(await screen.findByText(SKIP_ERROR_TOAST)).toBeInTheDocument();
    expect(screen.getByTestId('review-card-root')).toBeInTheDocument();
  });
});

describe('S1 Review · skip-reason', () => {
  it('the picker has the 4 SKIP_REASONS; choosing one sends `reason`', async () => {
    const { user, api } = setup({ handlers: { 'POST /api/review/skip': skipWith(4) } });
    const trigger = await screen.findByRole('button', { name: 'Choose a skip reason' });
    await user.click(trigger);
    const picker = screen.getByRole('dialog', { name: 'Why skip?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = within(picker).getAllByTestId('review-skip-reason-option');
    expect(options.map((o) => o.dataset.reason)).toEqual([...SKIP_REASONS]);
    expect(options.map((o) => o.textContent)).toEqual(['1Not sure', '2Not my area', '3Need more context', '4Other']);
    expect(within(picker).getByText(/You'll see this again in 24 hours/)).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
    await user.click(options[2]);
    await waitFor(() => expect(api.calls('POST /api/review/skip')).toHaveLength(1));
    expect(api.calls('POST /api/review/skip')[0].body).toEqual({
      assetId: reviewCard.asset.id,
      campaignId: reviewCard.campaign?.campaignId,
      reason: 'need_context',
    });
    expect(screen.queryByRole('dialog', { name: 'Why skip?' })).not.toBeInTheDocument();
  });
});

describe('S1 Review · resurfaced', () => {
  it('shows "You skipped this earlier" when resurfacedFromSkip', async () => {
    const { container } = setup({ handlers: { 'GET /api/review/next': { ...reviewCard, resurfacedFromSkip: true } } });
    expect(await screen.findByText('You skipped this earlier')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S1 Review · empty', () => {
  it('with a campaign filter: "Switch campaign" focuses the campaign filter, plus "View leaderboard"', async () => {
    const { user, container } = setup({ settings: userSettings, handlers: { 'GET /api/review/next': null } });
    const root = await screen.findByTestId('review-empty-root');
    expect(within(root).getByRole('heading', { name: 'All caught up!' })).toBeInTheDocument();
    expect(within(root).getByRole('link', { name: 'View leaderboard' })).toHaveAttribute('href', '/leaderboard');
    await user.click(within(root).getByRole('button', { name: 'Switch campaign' }));
    expect(screen.getByRole('combobox', { name: 'Campaign' })).toHaveFocus();
    await expectNoAxeViolations(container);
  });

  it('without a campaign filter: only "View leaderboard"', async () => {
    const { container } = setup({ handlers: { 'GET /api/review/next': null } });
    const root = await screen.findByTestId('review-empty-root');
    expect(within(root).queryByRole('button', { name: 'Switch campaign' })).not.toBeInTheDocument();
    expect(within(root).getByRole('link', { name: 'View leaderboard' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe('S1 Review · session-complete', () => {
  it('after cardsPerSession votes + skips the panel shows; "Keep going" resumes', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.reviewSession, { reviewed: 3, skipped: 1, total: 4 });
    const { user, container } = setup({
      queryClient,
      settings: { ...SETTINGS, cardsPerSession: 5 },
      handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard) },
    });
    await user.click(await screen.findByRole('button', { name: 'Approve (A)' }));
    const panel = await screen.findByTestId('review-session-complete-root');
    expect(within(panel).getByRole('heading', { name: 'Nice work, 5 cards reviewed' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Keep going' })).toHaveFocus();
    expect(within(panel).getByRole('link', { name: 'Done for now' })).toBeInTheDocument();
    expect(screen.queryByTestId('review-card-root')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
    await user.click(within(panel).getByRole('button', { name: 'Keep going' }));
    expect(await screen.findByRole('heading', { level: 2, name: NEXT_TITLE })).toBeInTheDocument();
    expect(screen.queryByTestId('review-session-complete-root')).not.toBeInTheDocument();
  });
});

describe('S1 Review · error (F3)', () => {
  it('GET /api/review/next 503 shows an alert with Retry, NOT the empty state; Retry refetches', async () => {
    mockApi(reviewRoutes);
    mockApi.error('GET /api/review/next', 503, 'UPSTREAM_ERROR', 'SQL warehouse is starting');
    const { user, container, api } = renderWithProviders(<ReviewPage />, { settings: SETTINGS });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load the next card.");
    expect(alert).toHaveTextContent('UPSTREAM_ERROR: SQL warehouse is starting');
    expect(screen.queryByTestId('review-empty-root')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-card-root')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);

    mockApi({ 'GET /api/review/next': reviewCard });
    await user.click(screen.getByTestId('review-error-retry'));
    expect(await screen.findByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
    expect(api?.calls('GET /api/review/next')).toHaveLength(2);
  });
});

describe('S1 Review · vote-error', () => {
  it('vote 500 keeps the card and shows a toast; the bar is usable again', async () => {
    mockApi(reviewRoutes);
    mockApi.error('POST /api/review/vote', 500, 'INTERNAL', 'Database unavailable');
    const { user, container } = renderWithProviders(<ReviewPage />, { settings: SETTINGS });
    await user.click(await screen.findByRole('button', { name: 'Approve (A)' }));
    expect(await screen.findByText(VOTE_ERROR_TOAST)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: TITLE })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve (A)' })).toBeEnabled());
    expect(liveRegion()).toHaveTextContent('');
    await expectNoAxeViolations(container);
  });
});

describe('S1 Review · offline', () => {
  it('vote buttons are disabled with a reason; A sends no request', async () => {
    const { user, api, container } = setup({ online: false });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    for (const name of ['Reject (R)', 'Edit (E)', 'Approve (A)', 'Skip (S)', 'Choose a skip reason']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(OFFLINE_REASON);
    }
    expect(screen.getByTestId('review-card-query-run')).toBeDisabled();
    await pressKeys(user, 'A', 'S', 'R');
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
    expect(api.calls('POST /api/review/skip')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);

    setOnline(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve (A)' })).toBeEnabled());
  });
});

describe('S1 Review · keyboard (KB K1)', () => {
  it('A approves from the card area, announces it and shows the next card', async () => {
    const { user, api } = setup({ handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard) } });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    const focused = await tabUntil(user, 'Show logic');
    expect(screen.getByTestId('review-card-root')).toContainElement(focused);
    await pressKey(user, 'A');
    expect(await screen.findByRole('heading', { level: 2, name: NEXT_TITLE })).toBeInTheDocument();
    expect(votes(api)).toEqual([{ assetId: reviewCard.asset.id, voteType: 'approve' }]);
    expect(liveRegion()).toHaveTextContent(`Approved ${TITLE}`);
  });

  it('R opens the Reject sheet with focus in the textarea; typed shortcuts do not vote; Esc returns focus', async () => {
    const { user, api } = setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    await pressKey(user, 'R');
    const sheet = await screen.findByRole('dialog', { name: 'Reject definition' });
    const field = within(sheet).getByLabelText(/What's wrong\?/);
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard('aser');
    expect(field).toHaveValue('aser');
    expect(votes(api)).toHaveLength(0);
    expect(api.calls('POST /api/review/skip')).toHaveLength(0);
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject (R)' })).toHaveFocus());
  });

  it('E opens the Edit sheet; Tab through the 3 fields; submit sends edits', async () => {
    const { user, api } = setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    await pressKey(user, 'E');
    const sheet = await screen.findByRole('dialog', { name: 'Edit definition' });
    await waitFor(() => expect(within(sheet).getByLabelText('Display name')).toHaveFocus());
    await user.tab();
    expect(within(sheet).getByLabelText('Description')).toHaveFocus();
    await user.tab();
    const logic = within(sheet).getByLabelText('Plain-English logic');
    expect(logic).toHaveFocus();
    await user.keyboard('{Control>}a{/Control}Readmits within 30 days, excluding hospice.');
    await tabUntil(user, 'Submit edit');
    await pressKey(user, 'Enter');
    await waitFor(() => expect(votes(api)).toHaveLength(1));
    expect(votes(api)[0].voteType).toBe('edit');
    expect(votes(api)[0].edits).toEqual({ plainEnglishLogic: 'Readmits within 30 days, excluding hospice.' });
  });

  it('S skips with no reason and never votes; the counter follows SkipResponse.stats.skippedToday', async () => {
    const { user, api } = setup({ handlers: { 'POST /api/review/skip': skipWith(7) } });
    await screen.findByTestId('review-skip-counter');
    await pressKey(user, 'S');
    await waitFor(() => expect(screen.getByTestId('review-skip-counter')).toHaveTextContent('Skipped today: 7'));
    expect(api.calls('POST /api/review/skip')[0].body).toEqual({
      assetId: reviewCard.asset.id,
      campaignId: reviewCard.campaign?.campaignId,
    });
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
  });

  it('Shift+S then 2 skips with reason not_my_area; Esc closes the picker and returns focus', async () => {
    const { user, api } = setup({ handlers: { 'POST /api/review/skip': skipWith(4) } });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    await pressKey(user, 'Shift+S');
    expect(await screen.findByRole('dialog', { name: 'Why skip?' })).toBeInTheDocument();
    await pressKey(user, 'Escape');
    expect(screen.queryByRole('dialog', { name: 'Why skip?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a skip reason' })).toHaveFocus();
    await pressKeys(user, 'Shift+S', '2');
    await waitFor(() => expect(api.calls('POST /api/review/skip')).toHaveLength(1));
    expect(api.calls('POST /api/review/skip')[0].body).toMatchObject({ reason: 'not_my_area' });
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
  });

  it('arrow aliases give the same calls: → approve, ← reject sheet, ↑ edit sheet', async () => {
    const { user, api } = setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    await pressKey(user, 'ArrowLeft');
    expect(await screen.findByRole('dialog', { name: 'Reject definition' })).toBeInTheDocument();
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await pressKey(user, 'ArrowUp');
    expect(await screen.findByRole('dialog', { name: 'Edit definition' })).toBeInTheDocument();
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit (E)' })).toHaveFocus());
    await pressKey(user, 'ArrowRight');
    await waitFor(() => expect(votes(api)).toEqual([{ assetId: reviewCard.asset.id, voteType: 'approve' }]));
  });

  it('L toggles the logic view; ? opens the help dialog and Esc closes it', async () => {
    const { user } = setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    await pressKey(user, 'L');
    expect(screen.getByTestId('review-card-logic-toggle')).toHaveAttribute('aria-expanded', 'true');
    await pressKey(user, 'L');
    expect(screen.getByTestId('review-card-logic-toggle')).toHaveAttribute('aria-expanded', 'false');
    await pressKey(user, '?');
    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(help).getByRole('cell', { name: 'Skip with a reason' })).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shortcuts are ignored while focus is in the filters', async () => {
    const { user, api } = setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    screen.getByRole('combobox', { name: 'Asset type' }).focus();
    await pressKeys(user, 'A', 'S');
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
    expect(api.calls('POST /api/review/skip')).toHaveLength(0);
  });
});

describe('S1 Review · skip is never a vote (F5)', () => {
  it('Skip button, S and Shift+S+reason post /api/review/skip and never voteType skip', async () => {
    const { user, api } = setup({ handlers: { 'POST /api/review/skip': skipWith(4) } });
    await user.click(await screen.findByRole('button', { name: 'Skip (S)' }));
    await waitFor(() => expect(api.calls('POST /api/review/skip')).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip (S)' })).toBeEnabled());
    await pressKey(user, 'S');
    await waitFor(() => expect(api.calls('POST /api/review/skip')).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip (S)' })).toBeEnabled());
    await pressKeys(user, 'Shift+S', '1');
    await waitFor(() => expect(api.calls('POST /api/review/skip')).toHaveLength(3));
    expect(api.calls('POST /api/review/vote')).toHaveLength(0);
    expect(votes(api).some((v) => (v.voteType as string) === 'skip')).toBe(false);
  });
});

describe('S1 Review · reduced motion', () => {
  it('OS reduce: no swipe wrapper, the vote applies without an exit animation', async () => {
    stubMatchMedia({ prefersReducedMotion: true });
    const { user } = setup({ handlers: { 'GET /api/review/next': sequence(reviewCard, nextCard) } });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    expect(motionMode()).toBe('reduced');
    await user.click(screen.getByRole('button', { name: 'Approve (A)' }));
    expect(await screen.findByRole('heading', { level: 2, name: NEXT_TITLE })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: TITLE })).not.toBeInTheDocument();
    expect(motionMode()).toBe('reduced');
  });

  it('UserSettings.motion reduce turns swipe off; OS reduce wins over motion full', async () => {
    setup({ settings: { ...SETTINGS, motion: 'reduce' } });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    expect(motionMode()).toBe('reduced');
  });

  it('OS reduce wins over UserSettings.motion full', async () => {
    stubMatchMedia({ prefersReducedMotion: true });
    setup({ settings: { ...SETTINGS, motion: 'full' } });
    await screen.findByRole('heading', { level: 2, name: TITLE });
    expect(motionMode()).toBe('reduced');
  });

  it('no reduce preference: the swipe wrapper is active', async () => {
    setup();
    await screen.findByRole('heading', { level: 2, name: TITLE });
    expect(motionMode()).toBe('full');
  });
});
