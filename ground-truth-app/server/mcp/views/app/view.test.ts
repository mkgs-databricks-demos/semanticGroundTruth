// @vitest-environment jsdom
// server/mcp/views/app/view.test.ts — review card view in jsdom with a fake ToolCaller
// Session 34 · Wave 4-2 · actions, optimistic UI + revert, timeout/retry, keyboard, edit, synonyms, escaping

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_TIMEOUT_MS,
  EMPTY_QUEUE_MESSAGE,
  ReviewCardView,
  toViewModel,
  type ToolCallParams,
  type ToolResultLike,
} from './view';
import { renderCardMarkdown } from '../markdown';
import {
  ASSET_ID,
  CAMPAIGN_ID,
  NEXT_ASSET_ID,
  USER_STATS,
  makeCard,
  makeSkipResponse,
  makeVoteResult,
} from '../../testFixtures';

type CallFn = (p: ToolCallParams) => Promise<ToolResultLike>;

function setup(options: { onPersistentError?: (m: string) => void } = {}) {
  const root = document.createElement('main');
  document.body.replaceChildren(root);
  const call = vi.fn<CallFn>(() => Promise.resolve({ content: [] }));
  const view = new ReviewCardView(root, { callServerTool: call }, options);
  return { root, view, call };
}

function showCard(view: ReviewCardView, card = makeCard()) {
  view.showToolResult({ content: [{ type: 'text', text: renderCardMarkdown(card) }], structuredContent: card });
}

function q<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}

function key(target: Element, k: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe('rendering', () => {
  it('shows a loading placeholder before the first tool result', () => {
    const { root } = setup();
    expect(root.textContent).toContain('Loading review card');
  });

  it('renders the card from structuredContent with the action bar', () => {
    const { root, view } = setup();
    showCard(view);
    const card = q(root, 'section.card');
    expect(card.dataset.assetId).toBe(ASSET_ID);
    expect(q(root, 'h2').textContent).toBe('Total Revenuemeasure');
    const text = root.textContent ?? '';
    expect(text).toContain('PENDING · Finance / Revenue');
    expect(text).toContain('Sum of all revenue line items');
    expect(text).toContain('Logic: SUM(revenue) grouped by period');
    expect(text).toContain('gross revenue');
    expect(text).toContain('What was total revenue last quarter?');
    expect(text).toContain('Confidence: 72.0% (10 votes: 7 approve, 2 reject, 1 edit)');
    expect(text).toContain('Q4 Finance review');
    expect(text).toContain('Reason: low_confidence');
    expect(text).toContain('5 / 20 reviewed');

    const toolbar = q(root, '[role="toolbar"]');
    const buttons = Array.from(toolbar.querySelectorAll('button'));
    expect(buttons.map((b) => b.dataset.action)).toEqual(['approve', 'reject', 'edit', 'skip']);
    expect(buttons.map((b) => b.getAttribute('aria-keyshortcuts'))).toEqual(['A', 'R', 'E', 'S']);
    expect(q<HTMLSelectElement>(root, 'select.skip-reason').options).toHaveLength(5);
  });

  it('says the same thing as the markdown fallback', () => {
    const { root, view } = setup();
    const card = makeCard();
    showCard(view, card);
    const md = renderCardMarkdown(card);
    const text = root.textContent ?? '';
    for (const fact of [
      'Total Revenue',
      'measure',
      'PENDING',
      'Finance / Revenue',
      'Sum of all revenue line items',
      'SUM(revenue) grouped by period',
      'gross revenue',
      'What was total revenue last quarter?',
      '72.0%',
      '10 votes',
      'Q4 Finance review',
      'low_confidence',
    ]) {
      expect(text, fact).toContain(fact);
      expect(md, fact).toContain(fact);
    }
    // Both offer approve / reject / edit / skip.
    for (const action of ['approve', 'reject', 'edit', 'skip']) {
      expect(md.toLowerCase()).toContain(action);
      expect(root.querySelector(`button[data-action="${action}"]`)).not.toBeNull();
    }
  });

  it('sets server text with textContent (no HTML injection)', () => {
    const { root, view } = setup();
    showCard(view, makeCard(ASSET_ID, { displayName: '<img src=x onerror="alert(1)">', description: '<script>bad()</script>' }));
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('section.card script')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('renders the empty state when there is no structuredContent', async () => {
    const { root, view, call } = setup();
    view.showToolResult({ content: [{ type: 'text', text: 'No more assets to review.' }] });
    expect(root.textContent).toContain(EMPTY_QUEUE_MESSAGE);
    q<HTMLButtonElement>(root, 'button[data-action="next"]').click();
    await tick();
    expect(call).toHaveBeenCalledWith({ name: 'review_get_next', arguments: {} });
  });

  it('renders review stats, including skips as not votes', () => {
    const { root, view } = setup();
    view.showToolResult({ structuredContent: USER_STATS });
    expect(view.state.kind).toBe('stats');
    expect(root.textContent).toContain('Skipped (not votes)3 (1 today)');
    expect(root.textContent).toContain('#3');
  });

  it('switches to a narrow layout below 320px', () => {
    const { root, view } = setup();
    view.setContainerWidth(280);
    expect(root.classList.contains('narrow')).toBe(true);
    view.setContainerWidth(600);
    expect(root.classList.contains('narrow')).toBe(false);
  });
});

describe('toViewModel', () => {
  it('maps every UI tool result shape', () => {
    expect(toViewModel(undefined)).toEqual({ kind: 'empty' });
    expect(toViewModel(makeCard()).kind).toBe('card');
    expect(toViewModel(makeVoteResult(makeCard(NEXT_ASSET_ID)))).toMatchObject({ kind: 'card', card: { asset: { id: NEXT_ASSET_ID } } });
    expect(toViewModel(makeVoteResult(null))).toEqual({ kind: 'empty' });
    expect(toViewModel({ ...makeSkipResponse(), next: makeCard(NEXT_ASSET_ID) })).toMatchObject({ kind: 'card' });
    expect(toViewModel({ ...makeSkipResponse(), next: null })).toEqual({ kind: 'empty' });
    expect(toViewModel(USER_STATS).kind).toBe('stats');
  });
});

describe('actions', () => {
  it('approve: optimistic transition, then renders the next card', async () => {
    const { root, view, call } = setup();
    showCard(view);
    const pending = deferred<ToolResultLike>();
    call.mockReturnValueOnce(pending.promise);

    q<HTMLButtonElement>(root, 'button[data-action="approve"]').click();
    expect(call).toHaveBeenCalledWith({
      name: 'review_submit_vote',
      arguments: { asset_id: ASSET_ID, vote_type: 'approve' },
    });
    expect(q(root, 'section.card').classList.contains('leaving')).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(q<HTMLButtonElement>(root, 'button[data-action="reject"]').disabled).toBe(true);
    expect(q(root, '.banner').textContent).toContain('Approving');

    pending.resolve({ structuredContent: makeVoteResult(makeCard(NEXT_ASSET_ID)) });
    await tick();
    expect(q(root, 'section.card').dataset.assetId).toBe(NEXT_ASSET_ID);
    expect(q(root, 'section.card').classList.contains('leaving')).toBe(false);
    expect(q<HTMLElement>(root, '.banner').hidden).toBe(true);
    expect(view.isBusy).toBe(false);
  });

  it('error result reverts to the same card with an alert and Retry', async () => {
    const { root, view, call } = setup();
    showCard(view);
    call.mockResolvedValueOnce({ isError: true, content: [{ type: 'text', text: 'Error [CONFLICT]: asset changed' }] });
    q<HTMLButtonElement>(root, 'button[data-action="reject"]').click();
    await tick();
    const card = q(root, 'section.card');
    expect(card.dataset.assetId).toBe(ASSET_ID);
    expect(card.classList.contains('leaving')).toBe(false);
    const banner = q(root, '.banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('asset changed');
    expect(q<HTMLButtonElement>(root, 'button[data-action="approve"]').disabled).toBe(false);

    call.mockResolvedValueOnce({ structuredContent: makeVoteResult(makeCard(NEXT_ASSET_ID), 'reject') });
    q<HTMLButtonElement>(banner, 'button[data-action="retry"]').click();
    await tick();
    expect(call).toHaveBeenLastCalledWith({ name: 'review_submit_vote', arguments: { asset_id: ASSET_ID, vote_type: 'reject' } });
    expect(q(root, 'section.card').dataset.assetId).toBe(NEXT_ASSET_ID);
  });

  it('shows "Connection lost" after the timeout and keeps the card', async () => {
    vi.useFakeTimers();
    const { root, view, call } = setup();
    showCard(view);
    call.mockReturnValueOnce(new Promise<ToolResultLike>(() => undefined));
    q<HTMLButtonElement>(root, 'button[data-action="approve"]').click();
    await vi.advanceTimersByTimeAsync(ACTION_TIMEOUT_MS);
    expect(q(root, '.banner').textContent).toContain('Connection lost.');
    expect(root.querySelector('.banner button[data-action="retry"]')).not.toBeNull();
    expect(q(root, 'section.card').dataset.assetId).toBe(ASSET_ID);
    expect(view.isBusy).toBe(false);
  });

  it('tells the model after repeated failures', async () => {
    const onPersistentError = vi.fn();
    const { root, view, call } = setup({ onPersistentError });
    showCard(view);
    call.mockResolvedValue({ isError: true, content: [{ type: 'text', text: 'Error [INTERNAL]: boom' }] });
    q<HTMLButtonElement>(root, 'button[data-action="approve"]').click();
    await tick();
    expect(onPersistentError).not.toHaveBeenCalled();
    q<HTMLButtonElement>(root, 'button[data-action="approve"]').click();
    await tick();
    expect(onPersistentError).toHaveBeenCalledWith('Error [INTERNAL]: boom');
  });

  it('skip sends the reason and campaign, and is not a vote', async () => {
    const { root, view, call } = setup();
    showCard(view);
    q<HTMLSelectElement>(root, 'select.skip-reason').value = 'not_my_area';
    call.mockResolvedValueOnce({ structuredContent: { ...makeSkipResponse(), next: null } });
    q<HTMLButtonElement>(root, 'button[data-action="skip"]').click();
    await tick();
    expect(call).toHaveBeenCalledWith({
      name: 'review_skip_card',
      arguments: { asset_id: ASSET_ID, reason: 'not_my_area', campaign_id: CAMPAIGN_ID },
    });
    expect(call.mock.calls.some(([p]) => p.name === 'review_submit_vote')).toBe(false);
    expect(root.textContent).toContain(EMPTY_QUEUE_MESSAGE);
  });

  it('edit sends only the changed fields; an unchanged edit is not sent', async () => {
    const { root, view, call } = setup();
    showCard(view);
    view.openEdit();
    const form = q<HTMLFormElement>(root, 'form.edit');
    form.requestSubmit();
    await tick();
    expect(call).not.toHaveBeenCalled();
    expect(q(root, '.banner').textContent).toContain('Change at least one field');

    q<HTMLTextAreaElement>(form, 'textarea[name="description"]').value = 'Sum of booked revenue';
    call.mockResolvedValueOnce({ structuredContent: makeVoteResult(makeCard(NEXT_ASSET_ID), 'edit') });
    form.requestSubmit();
    await tick();
    expect(call).toHaveBeenCalledWith({
      name: 'review_submit_vote',
      arguments: { asset_id: ASSET_ID, vote_type: 'edit', edits: { description: 'Sum of booked revenue' } },
    });
    expect(root.querySelector('form.edit')).toBeNull();
  });

  it('add synonym updates the card in place (array or { items } envelope)', async () => {
    const { root, view, call } = setup();
    showCard(view);
    const synonyms = [...makeCard().synonyms, { ...makeCard().synonyms[0], id: 'syn-2', synonym: 'turnover' }];
    call.mockResolvedValueOnce({ structuredContent: synonyms });
    q<HTMLInputElement>(root, 'input.synonym-input').value = '  turnover ';
    q<HTMLFormElement>(root, 'form.synonym-form').requestSubmit();
    await tick();
    expect(call).toHaveBeenCalledWith({
      name: 'review_add_synonym',
      arguments: { asset_id: ASSET_ID, action: 'add', synonym: 'turnover' },
    });
    expect(q(root, '.synonyms').textContent).toContain('gross revenue, turnover');
    expect(q(root, 'section.card').dataset.assetId).toBe(ASSET_ID);

    call.mockResolvedValueOnce({ structuredContent: { items: [...synonyms, { ...synonyms[0], id: 'syn-3', synonym: 'sales' }] } });
    await view.addSynonym('sales');
    expect(q(root, '.synonyms').textContent).toContain('turnover, sales');
  });
});

describe('keyboard', () => {
  it('A / R / S trigger actions when the card has focus', async () => {
    const { root, view, call } = setup();
    showCard(view);
    call.mockResolvedValue({ structuredContent: makeVoteResult(makeCard()) });
    key(q(root, 'section.card'), 'r');
    await tick();
    expect(call).toHaveBeenLastCalledWith({ name: 'review_submit_vote', arguments: { asset_id: ASSET_ID, vote_type: 'reject' } });
    key(q(root, 'button[data-action="approve"]'), 'A');
    await tick();
    expect(call).toHaveBeenLastCalledWith({ name: 'review_submit_vote', arguments: { asset_id: ASSET_ID, vote_type: 'approve' } });
    call.mockResolvedValueOnce({ structuredContent: { ...makeSkipResponse(), next: makeCard() } });
    key(q(root, 'section.card'), 's');
    await tick();
    expect(call.mock.lastCall?.[0].name).toBe('review_skip_card');
  });

  it('ignores shortcuts while typing and with modifier keys', () => {
    const { root, view, call } = setup();
    showCard(view);
    key(q(root, 'input.synonym-input'), 'a');
    key(q(root, 'select.skip-reason'), 's');
    key(q(root, 'section.card'), 'a', { ctrlKey: true });
    key(q(root, 'section.card'), 'r', { metaKey: true });
    expect(call).not.toHaveBeenCalled();
  });

  it('E opens the edit form with focus in it; Escape closes it and returns focus', () => {
    const { root, view } = setup();
    showCard(view);
    key(q(root, 'section.card'), 'e');
    const form = q(root, 'form.edit');
    expect(form.contains(document.activeElement)).toBe(true);
    key(q(form, 'textarea[name="description"]'), 'Escape');
    expect(root.querySelector('form.edit')).toBeNull();
    expect(document.activeElement).toBe(q(root, 'button[data-action="edit"]'));
  });
});
