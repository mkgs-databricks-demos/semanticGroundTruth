/// <reference lib="dom" />
// server/mcp/views/app/view.ts — review card MCP App view: DOM rendering, actions, keyboard
// Session 34 · Wave 4-2 · No enum, no namespace, no default export
//
// Browser code. build.ts bundles it (with main.ts / entry.ts) into
// reviewCardApp.generated.ts. It does not import the ext-apps App class, so
// tests drive it in jsdom with a fake ToolCaller; main.ts wires it to
// App.callServerTool. Server strings are always set with textContent, never
// innerHTML. Design: docs/design/L300-17_mcp_app_review_card.md §4.

import type { ReviewCard } from '../../../../shared/contracts/review';
import type { AssetSynonym, UserStats } from '../../../../shared/contracts/entities';
import type { SkipReason } from '../../../../shared/contracts/values';

/** A vote or skip that has not answered after this long shows "Connection lost". */
export const ACTION_TIMEOUT_MS = 10_000;

/** Consecutive failures before the model is told (app.updateModelContext). */
export const PERSISTENT_FAILURES = 2;

export interface ToolResultLike {
  isError?: boolean;
  content?: ReadonlyArray<{ type: string; text?: string }>;
  structuredContent?: unknown;
}

export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/** The one thing the view needs from the host: proxied MCP tool calls. */
export interface ToolCaller {
  callServerTool(params: ToolCallParams): Promise<ToolResultLike>;
}

export interface ReviewCardViewOptions {
  timeoutMs?: number;
  /** Called once failures reach PERSISTENT_FAILURES in a row. */
  onPersistentError?: (message: string) => void;
}

/** What a tool result means for the view. */
export type ViewModel =
  | { kind: 'loading' }
  | { kind: 'card'; card: ReviewCard }
  | { kind: 'empty' }
  | { kind: 'stats'; stats: UserStats };

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  not_sure: 'Not sure',
  not_my_area: 'Not my area',
  need_context: 'Need more context',
  other: 'Other',
};

export const EMPTY_QUEUE_MESSAGE = 'All caught up! No more cards to review.';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCard(v: unknown): v is ReviewCard {
  return isRecord(v) && isRecord(v.asset) && typeof v.asset.id === 'string';
}

/**
 * Map a tool result's structuredContent to a view model:
 * ReviewCard (review_get_next), VoteResult / skip result (`next`),
 * UserStats (review_get_stats). No structuredContent = empty queue.
 */
export function toViewModel(structured: unknown): ViewModel {
  if (structured === undefined || structured === null) return { kind: 'empty' };
  if (isCard(structured)) return { kind: 'card', card: structured };
  if (isRecord(structured)) {
    if ('vote' in structured || 'skip' in structured || 'next' in structured) {
      return isCard(structured.next) ? { kind: 'card', card: structured.next } : { kind: 'empty' };
    }
    if (typeof structured.totalVotes === 'number') {
      return { kind: 'stats', stats: structured as unknown as UserStats };
    }
  }
  return { kind: 'empty' };
}

/** Joined text content of a tool result (the markdown fallback or error text). */
export function resultText(result: ToolResultLike): string {
  return (result.content ?? [])
    .map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : ''))
    .filter(Boolean)
    .join('\n');
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
  return node;
}

type ActionKind = 'approve' | 'reject' | 'edit' | 'skip';

interface PendingCall {
  params: ToolCallParams;
  label: string;
  /** Card slides out while the call is in flight (votes, skips). */
  transition: boolean;
}

interface EditFields {
  display_name?: string;
  description?: string;
  plain_english_logic?: string;
}

/**
 * The interactive review card. Renders into `root`, calls tools through
 * `caller`, and re-renders from each response's structuredContent.
 */
export class ReviewCardView {
  private model: ViewModel = { kind: 'loading' };
  private busy = false;
  private editing = false;
  private failures = 0;
  private lastCall: PendingCall | null = null;
  private readonly banner: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly root: HTMLElement;
  private readonly caller: ToolCaller;
  private readonly options: ReviewCardViewOptions;

  constructor(root: HTMLElement, caller: ToolCaller, options: ReviewCardViewOptions = {}) {
    this.root = root;
    this.caller = caller;
    this.options = options;
    this.banner = h('div', { class: 'banner', role: 'status', 'aria-live': 'polite', hidden: '' });
    this.content = h('div', { class: 'content' });
    root.replaceChildren(this.banner, this.content);
    root.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.render();
  }

  /** Current view model (for tests and main.ts). */
  get state(): ViewModel {
    return this.model;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  /** Render a tool result pushed by the host (ui/notifications/tool-result). */
  showToolResult(result: ToolResultLike): void {
    if (result.isError) {
      this.showError(resultText(result) || 'The server returned an error.', false);
      return;
    }
    this.clearBanner();
    this.editing = false;
    this.model = toViewModel(result.structuredContent);
    this.render();
  }

  /** Adapt layout to the host's container width (hostContext.containerDimensions). */
  setContainerWidth(width: number | undefined): void {
    this.root.classList.toggle('narrow', typeof width === 'number' && width < 320);
  }

  // ── actions ──────────────────────────────────────────────────────────────

  approve(): Promise<void> {
    return this.vote('approve');
  }

  reject(): Promise<void> {
    return this.vote('reject');
  }

  async skip(): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    const select = this.content.querySelector<HTMLSelectElement>('select.skip-reason');
    const reason = select?.value ? (select.value as SkipReason) : undefined;
    const args: Record<string, unknown> = { asset_id: card.asset.id };
    if (reason) args.reason = reason;
    if (card.campaign) args.campaign_id = card.campaign.campaignId;
    await this.run({ params: { name: 'review_skip_card', arguments: args }, label: 'Skipping', transition: true });
  }

  openEdit(): void {
    if (!this.currentCard() || this.busy) return;
    this.editing = true;
    this.render();
    this.content.querySelector<HTMLInputElement>('form.edit input, form.edit textarea')?.focus();
  }

  closeEdit(): void {
    if (!this.editing) return;
    this.editing = false;
    this.render();
    this.content.querySelector<HTMLButtonElement>('button[data-action="edit"]')?.focus();
  }

  async saveEdit(fields: EditFields): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    const a = card.asset;
    const edits: EditFields = {};
    if (fields.display_name !== undefined && fields.display_name.trim() && fields.display_name !== a.displayName) {
      edits.display_name = fields.display_name.trim();
    }
    if (fields.description !== undefined && fields.description !== (a.description ?? '')) {
      edits.description = fields.description;
    }
    if (fields.plain_english_logic !== undefined && fields.plain_english_logic !== (a.plainEnglishLogic ?? '')) {
      edits.plain_english_logic = fields.plain_english_logic;
    }
    if (Object.keys(edits).length === 0) {
      this.setBanner('Change at least one field before saving the edit.', 'error');
      return;
    }
    await this.run({
      params: { name: 'review_submit_vote', arguments: { asset_id: a.id, vote_type: 'edit', edits } },
      label: 'Saving edit',
      transition: true,
    });
  }

  async addSynonym(synonym: string): Promise<void> {
    const card = this.currentCard();
    const text = synonym.trim();
    if (!card || !text) return;
    await this.run({
      params: { name: 'review_add_synonym', arguments: { asset_id: card.asset.id, action: 'add', synonym: text } },
      label: 'Adding synonym',
      transition: false,
    });
  }

  /** Load the next card (empty state "Check again", stats "Review next card"). */
  async loadNext(): Promise<void> {
    await this.run({ params: { name: 'review_get_next', arguments: {} }, label: 'Loading', transition: false });
  }

  /** Re-run the call that failed or timed out. */
  async retry(): Promise<void> {
    const call = this.lastCall;
    if (call) await this.run(call);
  }

  private vote(voteType: 'approve' | 'reject'): Promise<void> {
    const card = this.currentCard();
    if (!card) return Promise.resolve();
    return this.run({
      params: { name: 'review_submit_vote', arguments: { asset_id: card.asset.id, vote_type: voteType } },
      label: voteType === 'approve' ? 'Approving' : 'Rejecting',
      transition: true,
    });
  }

  private currentCard(): ReviewCard | null {
    return this.model.kind === 'card' ? this.model.card : null;
  }

  private async run(call: PendingCall): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.lastCall = call;
    const cardEl = this.content.querySelector('.card');
    if (call.transition) cardEl?.classList.add('leaving');
    this.setBusy(true);
    this.setBanner(`${call.label}\u2026`, 'info');

    let result: ToolResultLike;
    try {
      result = await withTimeout(this.caller.callServerTool(call.params), this.options.timeoutMs ?? ACTION_TIMEOUT_MS);
    } catch (err) {
      this.busy = false;
      cardEl?.classList.remove('leaving');
      this.setBusy(false);
      const msg = err instanceof TimeoutError
        ? 'Connection lost.'
        : `Request failed: ${err instanceof Error ? err.message : String(err)}`;
      this.showError(msg, true);
      return;
    }

    this.busy = false;
    if (result.isError) {
      cardEl?.classList.remove('leaving');
      this.setBusy(false);
      this.showError(resultText(result) || 'The server returned an error.', true);
      return;
    }

    this.failures = 0;
    this.lastCall = null;
    this.clearBanner();
    if (call.params.name === 'review_add_synonym') {
      this.applySynonyms(result.structuredContent);
      return;
    }
    this.editing = false;
    this.model = toViewModel(result.structuredContent);
    this.render();
  }

  private applySynonyms(structured: unknown): void {
    const card = this.currentCard();
    // MCP_TOOL_CONTRACTS returns a bare array today; accept an { items } or
    // { synonyms } envelope too (MCP clients require an object, see session 34 requests).
    const list = Array.isArray(structured)
      ? structured
      : isRecord(structured) && Array.isArray(structured.items)
        ? structured.items
        : isRecord(structured) && Array.isArray(structured.synonyms)
          ? structured.synonyms
          : null;
    if (card && list) {
      const synonyms = list as AssetSynonym[];
      this.model = { kind: 'card', card: { ...card, synonyms, asset: { ...card.asset, synonyms } } };
    }
    this.render();
    this.content.querySelector<HTMLInputElement>('input.synonym-input')?.focus();
  }

  private showError(message: string, retryable: boolean): void {
    this.failures += 1;
    this.setBanner(message, 'error', retryable && this.lastCall ? 'Retry' : undefined);
    if (this.failures >= PERSISTENT_FAILURES) this.options.onPersistentError?.(message);
  }

  // ── keyboard ─────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.editing) {
        e.preventDefault();
        this.closeEdit();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
    if (this.model.kind !== 'card' || this.busy || this.editing) return;
    const key = e.key.toLowerCase();
    const action: ActionKind | undefined =
      key === 'a' ? 'approve' : key === 'r' ? 'reject' : key === 'e' ? 'edit' : key === 's' ? 'skip' : undefined;
    if (!action) return;
    e.preventDefault();
    this.dispatch(action);
  }

  private dispatch(action: ActionKind): void {
    if (action === 'approve') void this.approve();
    else if (action === 'reject') void this.reject();
    else if (action === 'edit') this.openEdit();
    else void this.skip();
  }

  // ── rendering ────────────────────────────────────────────────────────────

  private setBusy(busy: boolean): void {
    this.root.setAttribute('aria-busy', String(busy));
    this.content
      .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'button, input, select, textarea',
      )
      .forEach((el) => {
        el.disabled = busy;
      });
  }

  private setBanner(message: string, tone: 'info' | 'error', actionLabel?: string): void {
    this.banner.hidden = false;
    this.banner.className = `banner ${tone}`;
    this.banner.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    const children: Node[] = [h('span', { class: 'banner-text' }, message)];
    if (actionLabel) {
      const btn = h('button', { type: 'button', class: 'btn small', 'data-action': 'retry' }, actionLabel);
      btn.addEventListener('click', () => void this.retry());
      children.push(btn);
    }
    this.banner.replaceChildren(...children);
  }

  private clearBanner(): void {
    this.banner.hidden = true;
    this.banner.className = 'banner';
    this.banner.replaceChildren();
  }

  private render(): void {
    const m = this.model;
    this.root.setAttribute('aria-busy', 'false');
    if (m.kind === 'loading') {
      this.content.replaceChildren(h('p', { class: 'placeholder' }, 'Loading review card\u2026'));
      return;
    }
    if (m.kind === 'empty') {
      const again = h('button', { type: 'button', class: 'btn', 'data-action': 'next' }, 'Check again');
      again.addEventListener('click', () => void this.loadNext());
      this.content.replaceChildren(
        h('section', { class: 'empty', 'aria-label': 'Review queue' }, h('p', {}, EMPTY_QUEUE_MESSAGE), again),
      );
      return;
    }
    if (m.kind === 'stats') {
      this.content.replaceChildren(this.renderStats(m.stats));
      return;
    }
    const section = this.renderCard(m.card);
    this.content.replaceChildren(section);
    if (!this.editing && this.root.ownerDocument.hasFocus()) section.focus({ preventScroll: true });
  }

  private renderStats(s: UserStats): HTMLElement {
    const rows: [string, string][] = [
      ['Total votes', String(s.totalVotes)],
      ['Approvals', String(s.approvals)],
      ['Rejections', String(s.rejections)],
      ['Edits', String(s.edits)],
      ['Skipped (not votes)', `${s.skippedCount} (${s.skippedToday} today)`],
      ['Current streak', `${s.currentStreakDays} days`],
      ['Rank', `#${s.rank}`],
      ['Coverage', `${s.coveragePct}%`],
    ];
    const next = h('button', { type: 'button', class: 'btn primary', 'data-action': 'next' }, 'Review next card');
    next.addEventListener('click', () => void this.loadNext());
    return h(
      'section',
      { class: 'card stats', 'aria-label': 'Your review stats' },
      h('header', { class: 'card-header' }, h('h2', {}, 'Your review stats')),
      h(
        'div',
        { class: 'card-body' },
        h('table', {}, h('tbody', {}, ...rows.map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v))))),
      ),
      h('footer', { class: 'card-footer' }, next),
    );
  }

  private renderCard(card: ReviewCard): HTMLElement {
    const a = card.asset;
    const name = a.displayName || a.name;
    const domain = a.domain ? `${a.domain}${a.subdomain ? ` / ${a.subdomain}` : ''}` : '';

    const actions = h('div', { class: 'actions', role: 'toolbar', 'aria-label': 'Review actions' });
    const button = (action: ActionKind, label: string, key: string, cls: string) => {
      const b = h(
        'button',
        { type: 'button', class: `btn ${cls}`, 'data-action': action, 'aria-keyshortcuts': key, title: `${label} (${key})` },
        label,
        h('kbd', { 'aria-hidden': 'true' }, key),
      );
      b.addEventListener('click', () => this.dispatch(action));
      return b;
    };
    const reasonSelect = h(
      'select',
      { class: 'skip-reason', 'aria-label': 'Skip reason' },
      h('option', { value: '' }, 'No reason'),
      ...(Object.entries(SKIP_REASON_LABELS) as [SkipReason, string][]).map(([value, label]) => h('option', { value }, label)),
    );
    actions.append(
      button('approve', 'Approve', 'A', 'primary'),
      button('reject', 'Reject', 'R', 'secondary'),
      button('edit', 'Edit', 'E', 'secondary'),
      button('skip', 'Skip', 'S', 'ghost'),
      reasonSelect,
    );

    const body = h('div', { class: 'card-body' });
    if (a.description) body.append(h('p', { class: 'description' }, a.description));
    if (a.plainEnglishLogic) body.append(h('p', { class: 'logic' }, h('strong', {}, 'Logic: '), a.plainEnglishLogic));
    body.append(this.renderSynonyms(card));
    if (card.examples.length > 0) {
      body.append(
        h(
          'div',
          { class: 'examples' },
          h('strong', {}, 'Example questions:'),
          h('ul', {}, ...card.examples.map((e) => h('li', {}, e.questionText))),
        ),
      );
    }
    if (card.confidence) {
      const c = card.confidence;
      body.append(
        h(
          'p',
          { class: 'confidence' },
          'Confidence: ',
          h('strong', {}, formatPct(c.confidence)),
          ` (${c.totalVotes} votes: ${c.approvals} approve, ${c.rejections} reject, ${c.edits} edit)`,
        ),
      );
    }
    if (card.campaign) body.append(h('p', { class: 'campaign' }, 'Campaign: ', h('em', {}, card.campaign.name)));

    return h(
      'section',
      { class: 'card', tabindex: '-1', 'aria-label': `Review card: ${name}`, 'data-asset-id': a.id },
      h(
        'header',
        { class: 'card-header' },
        h('h2', {}, name, h('span', { class: 'badge' }, a.assetType)),
        h('div', { class: 'meta' }, a.status, domain ? ` \u00b7 ${domain}` : ''),
      ),
      actions,
      this.editing ? this.renderEditForm(card) : null,
      body,
      h(
        'footer',
        { class: 'card-footer' },
        h('span', {}, `Reason: ${card.reason}`),
        h('span', {}, `${card.progress.reviewed} / ${card.progress.total} reviewed`),
      ),
    );
  }

  private renderSynonyms(card: ReviewCard): HTMLElement {
    const input = h('input', { type: 'text', class: 'synonym-input', 'aria-label': 'New synonym', placeholder: 'Add a synonym', maxlength: '200' });
    const form = h(
      'form',
      { class: 'synonym-form' },
      input,
      h('button', { type: 'submit', class: 'btn small secondary', 'data-action': 'add-synonym' }, 'Add synonym'),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.addSynonym(input.value);
    });
    return h(
      'div',
      { class: 'synonyms' },
      h('strong', {}, 'Synonyms: '),
      card.synonyms.length > 0 ? card.synonyms.map((s) => s.synonym).join(', ') : 'none yet',
      form,
    );
  }

  private renderEditForm(card: ReviewCard): HTMLElement {
    const a = card.asset;
    const displayName = h('input', { type: 'text', name: 'display_name', id: 'edit-display-name' });
    displayName.value = a.displayName;
    const description = h('textarea', { name: 'description', id: 'edit-description', rows: '3' });
    description.value = a.description ?? '';
    const logic = h('textarea', { name: 'plain_english_logic', id: 'edit-logic', rows: '3' });
    logic.value = a.plainEnglishLogic ?? '';
    const cancel = h('button', { type: 'button', class: 'btn ghost', 'data-action': 'cancel-edit' }, 'Cancel');
    cancel.addEventListener('click', () => this.closeEdit());
    const form = h(
      'form',
      { class: 'edit', 'aria-label': 'Edit asset' },
      h('label', { for: 'edit-display-name' }, 'Display name'),
      displayName,
      h('label', { for: 'edit-description' }, 'Description'),
      description,
      h('label', { for: 'edit-logic' }, 'Plain-English logic'),
      logic,
      h(
        'div',
        { class: 'edit-actions' },
        h('button', { type: 'submit', class: 'btn primary', 'data-action': 'save-edit' }, 'Save edit'),
        cancel,
      ),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.saveEdit({
        display_name: displayName.value,
        description: description.value,
        plain_english_logic: logic.value,
      });
    });
    return form;
  }
}
