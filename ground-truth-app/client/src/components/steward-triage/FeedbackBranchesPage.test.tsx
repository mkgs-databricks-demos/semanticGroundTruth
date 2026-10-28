// @a11y-strict
// client/src/components/steward-triage/FeedbackBranchesPage.test.tsx — S10 Feedback branches (all states + KB K4)
// Session 55 · Build 5 · wave 5-3 (ui_test_strategy.md §8 S10 rows, §6 K4)
// Tests completed by the owner after the session hit its step limit.

import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackBranch, Role } from '../../../../shared/contracts';
import { UpdateFeedbackBranchStatusRequestSchema } from '../../../../shared/contracts';
import { FeedbackBranchesPage } from '../../pages/steward/FeedbackBranchesPage';
import { expectNoAxeViolations } from '../../test/axe';
import { IDS } from '../../test/fixtures';
import { pressKey } from '../../test/keyboard';
import { calls, mockApi } from '../../test/mockApi';
import type { MockRequest } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { TestTheme } from '../../test/render';
import { ACCESS_ERROR_TITLE, ROLE_GATE_TEST_IDS } from '../access/RoleGate';
import { branchFailedWithReason, branchMerged, branchNoLink, branchWithLink, FAILURE_REASON, triageBranches } from './fixtures';
import { BRANCH_ACTIONS, BRANCH_COPIED, BRANCHES_EMPTY_TITLE, safeHttpUrl } from './labels';

const STEWARD: Role[] = ['reviewer', 'steward'];
const LIST = 'GET /api/steward/feedback-branches';
const STATUS = 'POST /api/steward/feedback-branches/:batchId/status';

function page(): ReactElement {
  return (
    <Routes>
      <Route path="/steward/feedback-branches" element={<FeedbackBranchesPage />} />
    </Routes>
  );
}

function renderBranches(options: { roles?: Role[]; theme?: TestTheme } = {}) {
  return renderWithProviders(page(), {
    route: '/steward/feedback-branches',
    roles: options.roles ?? STEWARD,
    theme: options.theme,
  });
}

/** The server echoes the branch with the new status. */
function statusReply(req: MockRequest): FeedbackBranch {
  const branch = [...triageBranches, branchMerged].find((b) => b.batchId === req.params.batchId)!;
  const body = req.body as { status: FeedbackBranch['status'] };
  return { ...branch, status: body.status, reviewedBy: IDS.users.priya };
}

const routes = { [LIST]: triageBranches, [STATUS]: statusReply };

const cards = () => screen.queryAllByTestId('steward-branches-card');
const card = (b: FeedbackBranch) => {
  const found = cards().find((el) => el.dataset.batchId === b.batchId);
  if (!found) throw new Error(`no card ${b.batchId}`);
  return found;
};
const expandButton = (b: FeedbackBranch) => within(card(b)).getByTestId('steward-branches-expand');
const statusButtons = (root: HTMLElement) =>
  within(root)
    .queryAllByRole('button')
    .filter((el) => el.dataset.testid?.startsWith('steward-branches-mark-'));

async function loaded(n = 3) {
  await waitFor(() => expect(cards()).toHaveLength(n));
}

describe('S10 helpers', () => {
  it('only renders http(s) links and offers actions only from proposed / in_review', () => {
    expect(safeHttpUrl('https://github.com/x/y/tree/b')).toBe('https://github.com/x/y/tree/b');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(BRANCH_ACTIONS.proposed).toEqual(['in_review', 'merged', 'rejected']);
    expect(BRANCH_ACTIONS.in_review).toEqual(['merged', 'rejected']);
    expect(BRANCH_ACTIONS.merged).toBeUndefined();
    expect(BRANCH_ACTIONS.failed).toBeUndefined();
  });
});

describe('S10 feedback branches · loading and populated', () => {
  it('shows the page heading and a skeleton while branches load', async () => {
    mockApi.pending(LIST);
    const { container } = renderBranches();
    expect(await screen.findByText('Loading feedback branches')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Feedback branches' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('renders 3 cards with the branch name and a status badge in text (not color only)', async () => {
    mockApi(routes);
    renderBranches();
    await loaded();
    expect(cards().map((c) => c.dataset.batchId)).toEqual(triageBranches.map((b) => b.batchId));
    expect(within(card(branchWithLink)).getByTestId('steward-branches-name')).toHaveTextContent(branchWithLink.branchName);
    expect(within(card(branchWithLink)).getByTestId('steward-branches-status')).toHaveTextContent('Proposed');
    expect(within(card(branchNoLink)).getByTestId('steward-branches-status')).toHaveTextContent('In review');
    expect(within(card(branchFailedWithReason)).getByTestId('steward-branches-status')).toHaveTextContent('Failed');
    expect(within(card(branchWithLink)).getByText('4 assets')).toBeInTheDocument();
    expect(within(card(branchWithLink)).getByText('Nobody yet')).toBeInTheDocument();
    expect(within(card(branchNoLink)).getByText(IDS.users.priya)).toBeInTheDocument();
  });

  it('"Open on GitHub" only when htmlUrl is set (new tab); copy is always there', async () => {
    mockApi(routes);
    renderBranches();
    await loaded();
    const link = within(card(branchWithLink)).getByTestId('steward-branches-open-git');
    expect(link).toHaveAttribute('href', branchWithLink.htmlUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName('Open on GitHub (opens in a new tab)');
    expect(within(card(branchNoLink)).queryByTestId('steward-branches-open-git')).toBeNull();
    expect(within(card(branchFailedWithReason)).queryByTestId('steward-branches-open-git')).toBeNull();
    for (const b of triageBranches) {
      expect(within(card(b)).getByRole('button', { name: `Copy branch name ${b.branchName}` })).toBeInTheDocument();
    }
  });

  it('expand shows the changed files and the summary; collapse hides them', async () => {
    mockApi(routes);
    const { user } = renderBranches();
    await loaded();
    const button = expandButton(branchWithLink);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(card(branchWithLink)).queryByTestId('steward-branches-files')).toBeNull();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const files = within(card(branchWithLink)).getByTestId('steward-branches-files');
    expect(within(files).getAllByRole('listitem').map((li) => li.textContent)).toEqual(branchWithLink.files);
    expect(within(card(branchWithLink)).getByText(branchWithLink.summary!)).toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(within(card(branchWithLink)).queryByTestId('steward-branches-files')).toBeNull();
  });

  it('status actions follow the server rules: proposed 3, in review 2, failed and merged none', async () => {
    mockApi({ ...routes, [LIST]: [...triageBranches, branchMerged] });
    renderBranches();
    await loaded(4);
    const ids = (b: FeedbackBranch) => statusButtons(card(b)).map((el) => el.dataset.testid);
    expect(ids(branchWithLink)).toEqual([
      'steward-branches-mark-in-review',
      'steward-branches-mark-merged',
      'steward-branches-mark-rejected',
    ]);
    expect(ids(branchNoLink)).toEqual(['steward-branches-mark-merged', 'steward-branches-mark-rejected']);
    expect(ids(branchFailedWithReason)).toEqual([]);
    expect(ids(branchMerged)).toEqual([]);
    expect(within(card(branchMerged)).getByTestId('steward-branches-status')).toHaveTextContent('Merged');
  });

  it('has no axe violations when populated and expanded, in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi(routes);
      const { user, container } = renderBranches({ theme });
      await loaded();
      await user.click(expandButton(branchWithLink));
      await expectNoAxeViolations(container);
    });
  });
});

describe('S10 feedback branches · status change', () => {
  it('Mark in review sends a parseable UpdateFeedbackBranchStatusRequest and toasts', async () => {
    mockApi(routes);
    const { user } = renderBranches();
    await loaded();
    await user.click(within(card(branchWithLink)).getByTestId('steward-branches-mark-in-review'));
    await waitFor(() => expect(calls(STATUS)).toHaveLength(1));
    const req = calls(STATUS)[0]!;
    expect(req.params.batchId).toBe(branchWithLink.batchId);
    expect(UpdateFeedbackBranchStatusRequestSchema.parse(req.body)).toEqual({ status: 'in_review' });
    expect(await screen.findByText('Marked in review')).toBeInTheDocument();
    // The list is refetched after the change.
    await waitFor(() => expect(calls(LIST).length).toBeGreaterThanOrEqual(2));
  });

  it('updating: that card says so and every status action waits', async () => {
    mockApi(routes);
    mockApi.pending(STATUS);
    const { user } = renderBranches();
    await loaded();
    await user.click(within(card(branchNoLink)).getByTestId('steward-branches-mark-merged'));
    expect(await within(card(branchNoLink)).findByText('Updating…')).toBeInTheDocument();
    for (const el of statusButtons(document.body)) expect(el).toBeDisabled();
    expect(within(card(branchWithLink)).queryByText('Updating…')).toBeNull();
    // Copy still works while a status change is in flight.
    expect(within(card(branchWithLink)).getByTestId('steward-branches-copy')).toBeEnabled();
  });

  it('Mark rejected asks first; Cancel sends nothing; confirming sends the trimmed note', async () => {
    mockApi(routes);
    const { user } = renderBranches();
    await loaded();
    const reject = within(card(branchWithLink)).getByTestId('steward-branches-mark-rejected');
    await user.click(reject);
    let dialog = await screen.findByRole('alertdialog', { name: `Reject ${branchWithLink.branchName}?` });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls(STATUS)).toHaveLength(0);

    await user.click(reject);
    dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByTestId('steward-branches-reject-note'), '  Duplicate of last week.  ');
    await user.click(within(dialog).getByRole('button', { name: 'Mark rejected' }));
    await waitFor(() => expect(calls(STATUS)).toHaveLength(1));
    expect(UpdateFeedbackBranchStatusRequestSchema.parse(calls(STATUS)[0]!.body)).toEqual({
      status: 'rejected',
      note: 'Duplicate of last week.',
    });
    expect(await screen.findByText('Marked rejected')).toBeInTheDocument();
  });

  it('a 409 is "changed since you loaded it" with Refresh, which refetches', async () => {
    mockApi(routes);
    mockApi.error(STATUS, 409, 'CONFLICT', 'Batch is already merged');
    const { user, container } = renderBranches();
    await loaded();
    await user.click(within(card(branchWithLink)).getByTestId('steward-branches-mark-merged'));
    const title = await within(card(branchWithLink)).findByText('This branch changed since you loaded it');
    expect(title.closest('[role="alert"]')).not.toBeNull();
    await expectNoAxeViolations(container);
    const before = calls(LIST).length;
    await user.click(within(card(branchWithLink)).getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(calls(LIST).length).toBe(before + 1));
    await waitFor(() => expect(screen.queryByText('This branch changed since you loaded it')).toBeNull());
  });

  it('any other error stays on that card with the server message', async () => {
    mockApi(routes);
    mockApi.error(STATUS, 502, 'UPSTREAM_ERROR', 'Lakebase unavailable');
    const { user } = renderBranches();
    await loaded();
    await user.click(within(card(branchNoLink)).getByTestId('steward-branches-mark-merged'));
    const title = await within(card(branchNoLink)).findByText("Couldn't change the status");
    expect(title.closest('[role="alert"]')).toHaveTextContent('Lakebase unavailable');
    expect(within(card(branchWithLink)).queryByText("Couldn't change the status")).toBeNull();
  });
});

describe('S10 feedback branches · failed-branch, empty, error, forbidden, offline', () => {
  it('failed-branch: the card shows the failure reason and has no status actions', async () => {
    mockApi(routes);
    const { container } = renderBranches();
    await loaded();
    const failure = within(card(branchFailedWithReason)).getByTestId('steward-branches-failure');
    expect(failure).toHaveTextContent('The feedback pipeline could not open this branch');
    expect(failure).toHaveTextContent(FAILURE_REASON);
    expect(within(card(branchFailedWithReason)).getByText('Not yet')).toBeInTheDocument();
    expect(statusButtons(card(branchFailedWithReason))).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('failed-branch without a reason says where to look', async () => {
    mockApi({ ...routes, [LIST]: [{ ...branchFailedWithReason, summary: null }] });
    renderBranches();
    await loaded(1);
    expect(screen.getByTestId('steward-branches-failure')).toHaveTextContent('Check the feedback job run.');
  });

  it('empty: says no branches yet', async () => {
    mockApi({ ...routes, [LIST]: [] });
    const { container } = renderBranches();
    const empty = await screen.findByTestId('steward-branches-empty-root');
    expect(within(empty).getByText(BRANCHES_EMPTY_TITLE)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('error state, names the problem and Retry reloads', async () => {
    mockApi.error(LIST, 503, 'UPSTREAM_ERROR', 'The SQL warehouse is starting.');
    const { user, container } = renderBranches();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load feedback branches");
    expect(alert).toHaveTextContent('The SQL warehouse is starting.');
    await expectNoAxeViolations(container);
    mockApi(routes);
    await user.click(within(alert).getByRole('button', { name: /retry/i }));
    await loaded();
  });

  it('forbidden: a reviewer sees the steward-only state and branches are never requested', async () => {
    mockApi(routes);
    const { container } = renderBranches({ roles: ['reviewer'] });
    expect(await screen.findByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeInTheDocument();
    expect(calls(LIST)).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('a failed /api/me is an error to retry, not "forbidden"', async () => {
    mockApi(routes);
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'boom');
    renderWithProviders(page(), { route: '/steward/feedback-branches' });
    expect(await screen.findByText(ACCESS_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeNull();
  });

  it('offline: status actions are disabled, copy and expand still work', async () => {
    mockApi(routes);
    const { user, container } = renderBranches();
    await loaded();
    setOnline(false);
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
    for (const el of statusButtons(document.body)) expect(el).toBeDisabled();
    expect(within(card(branchWithLink)).getByTestId('steward-branches-copy')).toBeEnabled();
    await user.click(expandButton(branchWithLink));
    expect(expandButton(branchWithLink)).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations(container);
    setOnline(true);
    await waitFor(() => expect(within(card(branchWithLink)).getByTestId('steward-branches-mark-merged')).toBeEnabled());
  });
});

describe('S10 feedback branches · keyboard (KB K4)', () => {
  it('J/K move between branches, Enter expands, Y copies the focused branch name', async () => {
    mockApi(routes);
    const { user } = renderBranches();
    await loaded();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await pressKey(user, 'J');
    expect(expandButton(branchWithLink)).toHaveFocus();
    await pressKey(user, 'J');
    expect(expandButton(branchNoLink)).toHaveFocus();
    await pressKey(user, 'K');
    expect(expandButton(branchWithLink)).toHaveFocus();

    await pressKey(user, 'Enter');
    expect(expandButton(branchWithLink)).toHaveAttribute('aria-expanded', 'true');
    expect(within(card(branchWithLink)).getByTestId('steward-branches-files')).toBeInTheDocument();

    await pressKey(user, 'Y');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(branchWithLink.branchName));
    const toast = await screen.findByText(BRANCH_COPIED);
    expect(toast.closest('[role="status"]')).toHaveTextContent(branchWithLink.branchName);
    writeText.mockRestore();
  });

  it('status buttons are reachable by Tab, and the reject confirm traps focus', async () => {
    mockApi(routes);
    const { user } = renderBranches();
    await loaded();
    await pressKey(user, 'J');
    expect(expandButton(branchWithLink)).toHaveFocus();
    // expand -> Open on GitHub -> Mark in review -> Mark merged -> Mark rejected
    await pressKey(user, 'Tab');
    expect(within(card(branchWithLink)).getByTestId('steward-branches-open-git')).toHaveFocus();
    await pressKey(user, 'Tab');
    expect(within(card(branchWithLink)).getByTestId('steward-branches-mark-in-review')).toHaveFocus();
    await pressKey(user, 'Tab');
    await pressKey(user, 'Tab');
    const reject = within(card(branchWithLink)).getByTestId('steward-branches-mark-rejected');
    expect(reject).toHaveFocus();

    await pressKey(user, 'Enter');
    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    for (let i = 0; i < 6; i++) {
      await pressKey(user, 'Tab');
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(reject).toHaveFocus());
    expect(calls(STATUS)).toHaveLength(0);
  });
});
