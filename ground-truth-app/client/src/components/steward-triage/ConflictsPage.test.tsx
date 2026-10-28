// @a11y-strict
// client/src/components/steward-triage/ConflictsPage.test.tsx — S9 Conflicts (all states + KB K2)
// Session 55 · Build 5 · wave 5-3 (ui_test_strategy.md §8 S9 rows, §6 K2)
// Tests completed by the owner after the session hit its step limit.

import { screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../../../shared/contracts';
import { ResolveConflictRequestSchema } from '../../../../shared/contracts';
import { ConflictsPage } from '../../pages/steward/ConflictsPage';
import { expectNoAxeViolations } from '../../test/axe';
import {
  assetReadmissionRate,
  conflictReadmissionRate,
  conflictsRoutes,
  IDS,
  resolutionAcceptEdit,
} from '../../test/fixtures';
import { pressKey } from '../../test/keyboard';
import { calls, mockApi } from '../../test/mockApi';
import { setOnline } from '../../test/online';
import { renderInBothThemes, renderWithProviders } from '../../test/render';
import type { TestTheme } from '../../test/render';
import { ACCESS_ERROR_TITLE, ROLE_GATE_TEST_IDS } from '../access/RoleGate';
import { assetDetailRoutes, conflictDischargeDisposition, twoConflicts } from './fixtures';
import {
  authorsToNotify,
  CONFLICT_STALE_TITLE,
  CONFLICTS_EMPTY_TITLE,
  conflictSummary,
  groupProposals,
  initials,
  joinNames,
  proposalsGroupName,
} from './labels';

const STEWARD: Role[] = ['reviewer', 'steward'];
const LIST = 'GET /api/steward/conflicts';
const RESOLVE = 'POST /api/steward/conflicts/:assetId/resolve';

function page(): ReactElement {
  return (
    <Routes>
      <Route path="/steward/conflicts" element={<ConflictsPage />} />
    </Routes>
  );
}

function renderConflicts(options: { roles?: Role[]; theme?: TestTheme; route?: string } = {}) {
  return renderWithProviders(page(), {
    route: options.route ?? '/steward/conflicts',
    roles: options.roles ?? STEWARD,
    theme: options.theme,
  });
}

const base = { ...assetDetailRoutes, [RESOLVE]: resolutionAcceptEdit };

const items = () => screen.queryAllByTestId('steward-conflicts-list-item');
const item = (assetId: string) => {
  const found = items().find((el) => el.dataset.assetId === assetId);
  if (!found) throw new Error(`no conflict group ${assetId}`);
  return found;
};
const list = () => screen.getByRole('listbox', { name: 'Conflict groups' });
const detail = () => screen.getByTestId('steward-conflicts-detail');
const radios = () => within(screen.getByRole('radiogroup')).getAllByRole('radio');

async function loaded(n = 2) {
  await waitFor(() => expect(items()).toHaveLength(n));
}

/** Pick a group by clicking it and wait for the current values. */
async function openGroup(user: ReturnType<typeof renderConflicts>['user'], assetId: string) {
  await user.click(item(assetId));
  await within(detail()).findByText(/^Current$/);
  await waitFor(() => expect(within(detail()).queryByText('Loading the current values')).toBeNull());
}

describe('S9 helpers', () => {
  it('groups edits by vote, names the radiogroup by field and counts proposals', () => {
    const proposals = groupProposals(conflictReadmissionRate.edits);
    expect(proposals.map((p) => p.voteId)).toEqual([IDS.votes.editAna, IDS.votes.editSam]);
    expect(proposalsGroupName(['description'])).toBe('Proposed descriptions');
    expect(proposalsGroupName(['description', 'display_name'])).toBe('Proposed edits');
    expect(conflictSummary(conflictReadmissionRate)).toBe('2 proposals · 2 rejects');
  });

  it('notifies every distinct author except the resolving steward; initials from the email', () => {
    expect(authorsToNotify(conflictReadmissionRate, IDS.users.priya)).toEqual([IDS.users.ana, IDS.users.sam]);
    expect(authorsToNotify(conflictReadmissionRate, IDS.users.ana)).toEqual([IDS.users.sam]);
    expect(joinNames(['a', 'b', 'c'])).toBe('a, b and c');
    expect(initials(IDS.users.ana)).toBe('AD');
  });
});

describe('S9 conflicts · loading and populated', () => {
  it('shows the page heading and a skeleton while conflicts load', async () => {
    mockApi(base);
    mockApi.pending(LIST);
    const { container } = renderConflicts();
    expect(await screen.findByText('Loading conflicts')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Conflicts' })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('lists one option per group (data-asset-id); nothing is selected and no asset is loaded yet', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    renderConflicts();
    await loaded();
    expect(items().map((el) => el.dataset.assetId)).toEqual([IDS.assets.readmissionRate, IDS.assets.dischargeDisposition]);
    for (const el of items()) expect(el).toHaveAttribute('aria-selected', 'false');
    expect(item(IDS.assets.readmissionRate)).toHaveTextContent('2 proposals · 2 rejects');
    expect(screen.queryByTestId('steward-conflicts-detail')).toBeNull();
    expect(calls('GET /api/assets/:assetId')).toHaveLength(0);
  });

  it('a selected group shows the current value, the proposals with <ins>/<del>, and a named radiogroup', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    expect(item(IDS.assets.readmissionRate)).toHaveAttribute('aria-selected', 'true');
    expect(calls('GET /api/assets/:assetId')[0]!.params.assetId).toBe(IDS.assets.readmissionRate);

    const current = screen.getByTestId('steward-conflicts-current');
    expect(current).toHaveTextContent(assetReadmissionRate.description!);
    expect(screen.getByTestId('steward-conflicts-tally')).toHaveTextContent('8 approvals · 2 rejections');

    const group = screen.getByRole('radiogroup', { name: 'Proposed descriptions' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(within(group).getByRole('radio', { name: /Proposal 1 by ana\.duarte@example\.com/ })).not.toBeChecked();
    const proposals = screen.getAllByTestId('steward-conflicts-proposal');
    expect(proposals.map((p) => p.dataset.voteId)).toEqual([IDS.votes.editAna, IDS.votes.editSam]);
    // Every proposal differs from the current value (an <ins> or a <del>), and the
    // diff marks both inserted and removed words (never color alone).
    for (const p of proposals) expect(p.querySelector('ins, del')).not.toBeNull();
    const region = screen.getByRole('radiogroup');
    expect(region.querySelector('ins')).not.toBeNull();
    expect(region.querySelector('del')).not.toBeNull();
    // Nothing picked yet: Accept is disabled, the other two are not.
    expect(screen.getByTestId('steward-conflicts-accept')).toBeDisabled();
    expect(screen.getByTestId('steward-conflicts-keep')).toBeEnabled();
    expect(screen.getByTestId('steward-conflicts-reject-all')).toBeEnabled();
  });

  it('?assetId= from the queue Resolve link preselects that group', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    renderConflicts({ route: `/steward/conflicts?assetId=${IDS.assets.dischargeDisposition}` });
    await loaded();
    expect(item(IDS.assets.dischargeDisposition)).toHaveAttribute('aria-selected', 'true');
    const d = await screen.findByTestId('steward-conflicts-detail');
    expect(within(d).getByRole('heading', { level: 2, name: 'Discharge Disposition' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Proposed display names' })).toBeInTheDocument();
  });

  it('has no axe violations with a group open, in light and dark', async () => {
    await renderInBothThemes(async (theme) => {
      mockApi({ ...base, [LIST]: twoConflicts });
      const { user, container } = renderConflicts({ theme });
      await loaded();
      await openGroup(user, IDS.assets.readmissionRate);
      await expectNoAxeViolations(container);
    });
  });
});

describe('S9 conflicts · resolving and resolved', () => {
  it('disables the bar while the resolve request runs', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    mockApi.pending(RESOLVE);
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    await user.click(radios()[1]!);
    await user.click(screen.getByTestId('steward-conflicts-accept'));
    expect(await screen.findByText('Resolving…')).toBeInTheDocument();
    expect(screen.getByTestId('steward-conflicts-accept')).toBeDisabled();
    expect(screen.getByTestId('steward-conflicts-keep')).toBeDisabled();
    expect(screen.getByTestId('steward-conflicts-reject-all')).toBeDisabled();
    for (const r of radios()) expect(r).toBeDisabled();
  });

  it('accept: sends accept_edit with the picked voteId, removes the group and names the authors', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    await user.click(radios()[1]!);
    expect(radios()[1]).toBeChecked();
    // The server no longer returns the resolved group.
    mockApi({ [LIST]: [conflictDischargeDisposition] });
    await user.click(screen.getByTestId('steward-conflicts-accept'));

    await waitFor(() => expect(calls(RESOLVE)).toHaveLength(1));
    const req = calls(RESOLVE)[0]!;
    expect(req.params.assetId).toBe(IDS.assets.readmissionRate);
    expect(ResolveConflictRequestSchema.parse(req.body)).toEqual({ resolution: 'accept_edit', voteId: IDS.votes.editSam });

    await loaded(1);
    expect(screen.queryByText(conflictReadmissionRate.displayName)).toBeNull();
    const toast = await screen.findByText('Conflict resolved');
    const region = toast.closest('[role="status"]') as HTMLElement;
    expect(region).toHaveTextContent('Edit accepted.');
    expect(region).toHaveTextContent(`${IDS.users.ana} and ${IDS.users.sam} were notified.`);
    // The next group is selected and focus is back on the list.
    expect(item(IDS.assets.dischargeDisposition)).toHaveAttribute('aria-selected', 'true');
    expect(list()).toHaveFocus();
  });

  it('keep current: sends keep_current with the trimmed note', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    await user.type(screen.getByTestId('steward-conflicts-note'), '  The current text matches the spec.  ');
    await user.click(screen.getByTestId('steward-conflicts-keep'));
    await waitFor(() => expect(calls(RESOLVE)).toHaveLength(1));
    expect(ResolveConflictRequestSchema.parse(calls(RESOLVE)[0]!.body)).toEqual({
      resolution: 'keep_current',
      note: 'The current text matches the spec.',
    });
    expect(await screen.findByText(/Current value kept\./)).toBeInTheDocument();
  });

  it('the last group resolved leaves the empty state', async () => {
    mockApi({ ...base, [LIST]: [conflictReadmissionRate] });
    const { user } = renderConflicts();
    await loaded(1);
    await openGroup(user, IDS.assets.readmissionRate);
    mockApi({ [LIST]: [] });
    await user.click(screen.getByTestId('steward-conflicts-keep'));
    expect(await screen.findByTestId('steward-conflicts-empty-root')).toHaveTextContent(CONFLICTS_EMPTY_TITLE);
  });
});

describe('S9 conflicts · stale', () => {
  it.each([
    [409, 'CONFLICT'],
    [404, 'NOT_FOUND'],
  ] as const)('resolve %i shows the stale alert and Refresh refetches the list', async (status, code) => {
    mockApi({ ...base, [LIST]: twoConflicts });
    mockApi.error(RESOLVE, status, code, 'Already resolved by another steward');
    const { user, container } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    await user.click(screen.getByTestId('steward-conflicts-keep'));
    const alert = await screen.findByText(CONFLICT_STALE_TITLE);
    expect(alert.closest('[role="alert"]')).not.toBeNull();
    await expectNoAxeViolations(container);
    const before = calls(LIST).length;
    mockApi({ [LIST]: [conflictDischargeDisposition] });
    await user.click(screen.getByTestId('steward-conflicts-stale-refresh'));
    await waitFor(() => expect(calls(LIST).length).toBe(before + 1));
    await loaded(1);
    expect(screen.queryByText(CONFLICT_STALE_TITLE)).toBeNull();
  });

  it('any other resolve error is a plain error alert (no Refresh)', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    mockApi.error(RESOLVE, 502, 'UPSTREAM_ERROR', 'Lakebase unavailable');
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    await user.click(screen.getByTestId('steward-conflicts-keep'));
    const title = await screen.findByText("Couldn't resolve the conflict");
    expect(title.closest('[role="alert"]')).toHaveTextContent('Lakebase unavailable');
    expect(screen.queryByTestId('steward-conflicts-stale-refresh')).toBeNull();
    expect(items()).toHaveLength(2);
  });
});

describe('S9 conflicts · empty, error, forbidden, offline', () => {
  it('empty: says reviewers agree', async () => {
    mockApi({ ...conflictsRoutes, [LIST]: [] });
    const { container } = renderConflicts();
    const empty = await screen.findByTestId('steward-conflicts-empty-root');
    expect(within(empty).getByText(CONFLICTS_EMPTY_TITLE)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('error: names the problem and Retry reloads', async () => {
    mockApi(base);
    mockApi.error(LIST, 503, 'UPSTREAM_ERROR', 'The SQL warehouse is starting.');
    const { user, container } = renderConflicts();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load conflicts");
    expect(alert).toHaveTextContent('The SQL warehouse is starting.');
    await expectNoAxeViolations(container);
    mockApi({ [LIST]: twoConflicts });
    await user.click(within(alert).getByRole('button', { name: /retry/i }));
    await loaded();
  });

  it('forbidden: a reviewer sees the steward-only state and conflicts are never requested', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { container } = renderConflicts({ roles: ['reviewer'] });
    expect(await screen.findByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeInTheDocument();
    expect(calls(LIST)).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('a failed /api/me is an error to retry, not "forbidden"', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    mockApi.error('GET /api/me', 500, 'INTERNAL', 'boom');
    renderWithProviders(page(), { route: '/steward/conflicts' });
    expect(await screen.findByText(ACCESS_ERROR_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId(ROLE_GATE_TEST_IDS.steward.forbidden)).toBeNull();
  });

  it('offline: explains the problem, keeps the groups and disables every resolve action', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user, container } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    setOnline(false);
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
    expect(items()).toHaveLength(2);
    expect(screen.getByTestId('steward-conflicts-accept')).toBeDisabled();
    expect(screen.getByTestId('steward-conflicts-keep')).toBeDisabled();
    expect(screen.getByTestId('steward-conflicts-reject-all')).toBeDisabled();
    for (const r of radios()) expect(r).toBeDisabled();
    await expectNoAxeViolations(container);
    // Shortcuts do not write either.
    list().focus();
    await pressKey(user, 'C');
    expect(calls(RESOLVE)).toHaveLength(0);
    setOnline(true);
    await waitFor(() => expect(screen.getByTestId('steward-conflicts-keep')).toBeEnabled());
  });
});

describe('S9 conflicts · keyboard (KB K2)', () => {
  it('J/K move the selected group, 2 picks proposal 2, Enter accepts it and the next group is selected', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    list().focus();

    await pressKey(user, 'J');
    expect(item(IDS.assets.readmissionRate)).toHaveAttribute('aria-selected', 'true');
    await pressKey(user, 'J');
    expect(item(IDS.assets.dischargeDisposition)).toHaveAttribute('aria-selected', 'true');
    expect(item(IDS.assets.readmissionRate)).toHaveAttribute('aria-selected', 'false');
    await pressKey(user, 'K');
    expect(item(IDS.assets.readmissionRate)).toHaveAttribute('aria-selected', 'true');
    expect(list()).toHaveFocus();
    await waitFor(() => expect(radios()).toHaveLength(2));

    await pressKey(user, '2');
    expect(radios()[1]).toBeChecked();
    expect(radios()[0]).not.toBeChecked();

    mockApi({ [LIST]: [conflictDischargeDisposition] });
    await pressKey(user, 'Enter');
    await waitFor(() => expect(calls(RESOLVE)).toHaveLength(1));
    expect(ResolveConflictRequestSchema.parse(calls(RESOLVE)[0]!.body)).toEqual({
      resolution: 'accept_edit',
      voteId: IDS.votes.editSam,
    });
    await loaded(1);
    expect(item(IDS.assets.dischargeDisposition)).toHaveAttribute('aria-selected', 'true');
    expect(list()).toHaveFocus();
  });

  it('X opens the confirm alertdialog with focus on Cancel; Enter on "Reject all" sends reject_all', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    list().focus();
    await pressKey(user, 'J');
    await waitFor(() => expect(radios()).toHaveLength(2));

    await pressKey(user, 'X');
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject all proposals?' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    // Shortcuts are off while the dialog is open.
    await pressKey(user, 'J');
    expect(item(IDS.assets.readmissionRate)).toHaveAttribute('aria-selected', 'true');

    await pressKey(user, 'Tab');
    expect(within(dialog).getByRole('button', { name: 'Reject all' })).toHaveFocus();
    mockApi({ [LIST]: [conflictDischargeDisposition] });
    await pressKey(user, 'Enter');
    await waitFor(() => expect(calls(RESOLVE)).toHaveLength(1));
    expect(ResolveConflictRequestSchema.parse(calls(RESOLVE)[0]!.body)).toEqual({ resolution: 'reject_all' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await loaded(1);
    expect(item(IDS.assets.dischargeDisposition)).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/All proposals rejected\./)).toBeInTheDocument();
  });

  it('Escape on Cancel closes the confirm without a request and focus returns to the list', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    list().focus();
    await pressKey(user, 'J');
    await waitFor(() => expect(radios()).toHaveLength(2));
    await pressKey(user, 'X');
    await screen.findByRole('alertdialog');
    await pressKey(user, 'Escape');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls(RESOLVE)).toHaveLength(0);
    await waitFor(() => expect(list()).toHaveFocus());
  });

  it('Cancel on the confirm opened from the Reject all button returns focus to that button', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    await openGroup(user, IDS.assets.readmissionRate);
    const rejectAll = screen.getByTestId('steward-conflicts-reject-all');
    await user.click(rejectAll);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(rejectAll).toHaveFocus());
    expect(calls(RESOLVE)).toHaveLength(0);
  });

  it('N focuses the note, and letters typed there stay text', async () => {
    mockApi({ ...base, [LIST]: twoConflicts });
    const { user } = renderConflicts();
    await loaded();
    list().focus();
    await pressKey(user, 'J');
    await waitFor(() => expect(radios()).toHaveLength(2));
    await pressKey(user, 'N');
    const note = screen.getByTestId('steward-conflicts-note');
    expect(note).toHaveFocus();
    await user.keyboard('jxc');
    expect(note).toHaveValue('jxc');
    expect(calls(RESOLVE)).toHaveLength(0);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
