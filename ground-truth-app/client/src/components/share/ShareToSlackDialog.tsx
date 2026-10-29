// @a11y-strict
// client/src/components/share/ShareToSlackDialog.tsx — Share to Slack (G5 Option A)
// Session 56 · Build 5 · wave 5-3. Spec: docs/research/05_slack_mcp_notifications.md
// §Exact changes 6; server routes from session 50; hooks from session 49.
//
// Modal dialog (AppKit / Radix: focus trap, Escape closes, focus returns to
// `returnFocusRef` or the trigger). Contents:
//   * channel picker: a combobox over GET /api/slack/channels?query=, debounced;
//   * read-only preview of the text the server builds + an optional note;
//   * mode "Draft to me" (default) / "Send to channel";
//   * results: drafted, sent (permalink, opens in a new tab), needs_slack_login
//     ("Connect Slack in Catalog Explorer → system.ai.slack", login link when the
//     server has one), 403, 429 (retry-after), other errors with Retry.
// The server always builds the message; the client sends only
// { channelId, mode, message? } (ShareSlackRequest).

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@databricks/appkit-ui/react';
import { SLACK_SHARE_MESSAGE_MAX } from '../../../../shared/contracts';
import type {
  Asset,
  Notification,
  ShareSlackRequest,
  ShareSlackResponse,
  SlackChannel,
  SlackShareMode,
} from '../../../../shared/contracts';
import { useShareAssetToSlack, useShareNotificationToSlack, useSlackChannels } from '../../lib/api/hooks';
import { ApiError } from '../../lib/api/http';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';
import { InlineAlert } from '../ui/InlineAlert';
import { RadioCardGroup } from '../ui/RadioCardGroup';
import type { RadioCardOption } from '../ui/RadioCardGroup';

// ── Public constants (tests and callers use them) ─────────────────────────────────────

export const SHARE_DIALOG_TITLE = 'Share to Slack';
export const CHANNEL_SEARCH_DEBOUNCE_MS = 300;
export const SLACK_CONNECT_HINT = 'Connect Slack in Catalog Explorer → system.ai.slack';
export const SHARE_LOGIN_TITLE = 'Connect Slack to share';
export const SHARE_FORBIDDEN_TITLE = "You can't share to Slack";
export const SHARE_RATE_LIMITED_TITLE = 'Slack is busy';
export const SHARE_ERROR_TITLE = "Couldn't share to Slack";
export const CHANNELS_ERROR_TITLE = "Couldn't load Slack channels";

/** What is being shared. */
export type ShareTarget =
  | { kind: 'notification'; notification: Notification }
  | { kind: 'asset'; asset: Asset };

export interface ShareToSlackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog renders nothing while this is null. */
  target: ShareTarget | null;
  /**
   * Element that gets focus when the dialog closes. Needed when the trigger
   * unmounts while the dialog is open (the bell closes its popover first).
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const MODE_OPTIONS: RadioCardOption<SlackShareMode>[] = [
  {
    value: 'draft',
    label: 'Draft to me',
    description: 'Saves a Slack draft for you to review and send.',
    icon: 'pencil',
  },
  {
    value: 'send',
    label: 'Send to channel',
    description: 'Posts the message to the channel now.',
    icon: 'send',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Display name of the shared item (dialog description, button subject). */
export function shareSubject(target: ShareTarget): string {
  return target.kind === 'notification' ? target.notification.title : target.asset.displayName || target.asset.name;
}

/**
 * Read-only preview of the text the server sends (session 50 buildShareMessage).
 * The server adds the confidence and the link with the app's origin, so the
 * preview names them instead of guessing their values.
 */
export function sharePreviewLines(target: ShareTarget, note: string): string[] {
  const lines: string[] = [];
  if (target.kind === 'notification') {
    lines.push(target.notification.title);
    if (target.notification.body.trim()) lines.push(target.notification.body.trim());
  } else {
    const a = target.asset;
    lines.push(`Asset: ${a.name} (${a.assetType})`);
    lines.push(`Status: ${a.status} · Confidence: added when sent`);
  }
  lines.push('Open in Semantic Ground Truth: (link added when sent)');
  if (note.trim()) lines.push('', `Note: ${note.trim()}`);
  return lines;
}

/** Only https links from the server are rendered as links. */
export function safeHttpsUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function retryAfterSeconds(error: ApiError): number | null {
  const v = error.details?.retryAfterSeconds;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.ceil(v) : null;
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ── Dialog ───────────────────────────────────────────────────────────────────────

export function ShareToSlackDialog({ open, onOpenChange, target, returnFocusRef }: ShareToSlackDialogProps) {
  // Escape inside the open channel list closes the list, not the dialog.
  const pickerOpenRef = useRef<(() => boolean) | null>(null);
  if (!target) return null;
  const subject = shareSubject(target);
  const targetKey = target.kind === 'notification' ? `n:${target.notification.id}` : `a:${target.asset.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="share-slack-dialog-root"
        className="max-h-[90vh] overflow-y-auto bg-card text-card-foreground"
        onEscapeKeyDown={(event) => {
          if (pickerOpenRef.current?.()) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          const el = returnFocusRef?.current;
          if (el && el.isConnected) {
            event.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{SHARE_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{`Share “${subject}” with a Slack channel.`}</DialogDescription>
        </DialogHeader>
        {/* Keyed by target so each share starts with a fresh form and mutation. */}
        <ShareForm key={targetKey} target={target} onDone={() => onOpenChange(false)} pickerOpenRef={pickerOpenRef} />
      </DialogContent>
    </Dialog>
  );
}

interface ShareFormProps {
  target: ShareTarget;
  onDone: () => void;
  pickerOpenRef: { current: (() => boolean) | null };
}

function ShareForm({ target, onDone, pickerOpenRef }: ShareFormProps) {
  const online = useOnlineStatus();
  const formId = useId();
  const noteId = useId();
  const previewId = useId();
  const [channel, setChannel] = useState<SlackChannel | null>(null);
  const [mode, setMode] = useState<SlackShareMode>('draft');
  const [note, setNote] = useState('');

  const shareNotification = useShareNotificationToSlack();
  const shareAsset = useShareAssetToSlack();
  const mutation = target.kind === 'notification' ? shareNotification : shareAsset;

  const submit = () => {
    if (!channel || mutation.isPending) return;
    const body: ShareSlackRequest = { channelId: channel.id, mode };
    if (note.trim()) body.message = note.trim();
    if (target.kind === 'notification') {
      shareNotification.mutate({ notificationId: target.notification.id, body });
    } else {
      shareAsset.mutate({ assetId: target.asset.id, body });
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const response = mutation.isSuccess ? mutation.data : null;
  const finished = response?.status === 'sent' || response?.status === 'drafted';

  if (finished && response && channel) {
    return (
      <>
        <ShareSuccess response={response} channel={channel} />
        <DialogFooter>
          <Button type="button" className="min-h-[44px]" onClick={onDone} autoFocus>
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  // The alerts and the footer sit outside the <form>: InlineAlert's Retry is a
  // default (submit) button, which would otherwise send the share twice. The
  // submit button joins the form with the `form` attribute.
  return (
    <>
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <ChannelPicker value={channel} onChange={setChannel} pickerOpenRef={pickerOpenRef} disabled={mutation.isPending} />

      <div className="flex flex-col gap-1.5">
        <p id={previewId} className="text-sm font-medium">
          Message preview
        </p>
        <pre
          data-testid="share-slack-preview-text"
          className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-sans text-sm text-foreground"
        >
          {sharePreviewLines(target, note).join('\n')}
        </pre>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium">
          Add a note (optional)
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={SLACK_SHARE_MESSAGE_MAX}
          rows={3}
          disabled={mutation.isPending}
          aria-describedby={`${noteId}-count`}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        <p id={`${noteId}-count`} className="text-xs text-muted-foreground">
          {`${note.length} of ${SLACK_SHARE_MESSAGE_MAX} characters`}
        </p>
      </div>

      <RadioCardGroup legend="Share as" options={MODE_OPTIONS} value={mode} onChange={setMode} disabled={mutation.isPending} />
    </form>

      <div aria-live="polite" data-testid="share-slack-result-region">
        {response?.status === 'needs_slack_login' ? (
          <NeedsLogin loginUrl={response.loginUrl} />
        ) : mutation.isError ? (
          <ShareErrorAlert error={mutation.error} onRetry={submit} retrying={mutation.isPending} />
        ) : null}
        {!online ? (
          <InlineAlert variant="offline" title="You're offline">
            Sharing is available again when you reconnect.
          </InlineAlert>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={formId}
          className="min-h-[44px] gap-2"
          disabled={!channel || mutation.isPending || !online}
          data-testid="share-slack-submit-button"
        >
          <Icon name="send" size={16} />
          {mutation.isPending ? 'Sharing…' : mode === 'draft' ? 'Save draft' : 'Send to Slack'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────────

function NewTabLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* The space lives in the text node: a leading space inside the sr-only span is dropped from the accessible name. */}
      {`${children} `}
      <Icon name="external" size={14} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function ShareSuccess({ response, channel }: { response: ShareSlackResponse; channel: SlackChannel }) {
  const permalink = safeHttpsUrl(response.permalink);
  const sent = response.status === 'sent';
  return (
    <div role="status" data-testid="share-slack-result-root" data-status={response.status} className="flex gap-3 rounded-md border border-border p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-success">
        <Icon name="check" size={18} />
      </span>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-bold">{sent ? `Sent to #${channel.name}` : `Draft saved for #${channel.name}`}</p>
        <p className="text-muted-foreground">
          {sent ? 'The message is in the channel now.' : 'Open your Slack drafts to review and send it.'}
        </p>
        {permalink ? <NewTabLink href={permalink}>{sent ? 'View in Slack' : 'Open draft in Slack'}</NewTabLink> : null}
      </div>
    </div>
  );
}

function NeedsLogin({ loginUrl }: { loginUrl?: string }) {
  const href = safeHttpsUrl(loginUrl);
  return (
    <InlineAlert variant="warning" title={SHARE_LOGIN_TITLE}>
      <span className="flex flex-col gap-1">
        <span>{`${SLACK_CONNECT_HINT}, then try again.`}</span>
        {href ? (
          <NewTabLink href={href}>Connect Slack</NewTabLink>
        ) : (
          <span>Open system.ai.slack in Catalog Explorer and click Login.</span>
        )}
      </span>
    </InlineAlert>
  );
}

function ShareErrorAlert({ error, onRetry, retrying }: { error: Error; onRetry: () => void; retrying: boolean }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <InlineAlert variant="forbidden" title={SHARE_FORBIDDEN_TITLE}>
        {error.message || 'You need EXECUTE on system.ai.slack. Ask an admin for access.'}
      </InlineAlert>
    );
  }
  if (error instanceof ApiError && error.status === 429) {
    const wait = retryAfterSeconds(error);
    return (
      <InlineAlert variant="warning" title={SHARE_RATE_LIMITED_TITLE} onRetry={onRetry} retrying={retrying}>
        {wait ? `Too many requests. Try again in ${wait} seconds.` : 'Too many requests. Try again in a moment.'}
      </InlineAlert>
    );
  }
  return (
    <InlineAlert title={SHARE_ERROR_TITLE} onRetry={onRetry} retrying={retrying}>
      {error.message}
    </InlineAlert>
  );
}

// ── Channel picker (combobox) ──────────────────────────────────────────────────────
// WAI-ARIA combobox with a listbox popup: typing filters (debounced server
// search), ArrowDown / ArrowUp move the active option, Enter picks it, Escape
// closes the list (the dialog stays open). Focus stays in the input.

interface ChannelPickerProps {
  value: SlackChannel | null;
  onChange: (channel: SlackChannel | null) => void;
  pickerOpenRef: { current: (() => boolean) | null };
  disabled?: boolean;
}

function ChannelPicker({ value, onChange, pickerOpenRef, disabled = false }: ChannelPickerProps) {
  const inputId = useId();
  const listId = useId();
  const statusId = useId();
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [touched, setTouched] = useState(false);
  const query = useDebouncedValue(text.replace(/^#/, '').trim(), CHANNEL_SEARCH_DEBOUNCE_MS);
  const channels = useSlackChannels({ query }, { enabled: touched });
  const options = channels.data ?? [];
  const showList = expanded && options.length > 0;

  const expandedRef = useRef(showList);
  expandedRef.current = showList;
  useEffect(() => {
    pickerOpenRef.current = () => expandedRef.current;
    return () => {
      pickerOpenRef.current = null;
    };
  }, [pickerOpenRef]);

  const pick = (c: SlackChannel) => {
    onChange(c);
    setText(`#${c.name}`);
    setExpanded(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setTouched(true);
      setExpanded(true);
      if (options.length) setActive((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setExpanded(true);
      if (options.length) setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      if (showList && active >= 0 && options[active]) {
        event.preventDefault();
        pick(options[active]);
      } else if (!value) {
        // Nothing chosen yet: Enter must not submit the form.
        event.preventDefault();
      }
    } else if (event.key === 'Escape' && showList) {
      setExpanded(false);
      setActive(-1);
    }
  };

  const status = !touched
    ? ''
    : channels.isPending
      ? 'Searching channels…'
      : channels.isError
        ? ''
        : options.length === 0
          ? query
            ? `No channels match “${query}”.`
            : 'No channels found.'
          : `${options.length} channel${options.length === 1 ? '' : 's'} found.`;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        Channel
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-describedby={statusId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search channels"
        value={text}
        disabled={disabled}
        data-testid="share-slack-channel-input"
        onFocus={() => {
          setTouched(true);
          setExpanded(true);
        }}
        onBlur={() => setExpanded(false)}
        onChange={(e) => {
          setText(e.target.value);
          setTouched(true);
          setExpanded(true);
          setActive(-1);
          if (value) onChange(null);
        }}
        onKeyDown={onKeyDown}
        className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Slack channels"
        hidden={!showList}
        className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
      >
        {showList
          ? options.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={value?.id === c.id}
                data-testid="share-slack-channel-option"
                data-channel-id={c.id}
                // Keep focus in the input; pick on mouse down before blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center px-3 text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                )}
              >
                {`#${c.name}`}
              </li>
            ))
          : null}
      </ul>
      <p id={statusId} role="status" className="min-h-[1rem] text-xs text-muted-foreground">
        {status}
      </p>
      {channels.isError ? (
        <InlineAlert title={CHANNELS_ERROR_TITLE} onRetry={() => void channels.refetch()} retrying={channels.isFetching}>
          {channels.error.message}
        </InlineAlert>
      ) : null}
    </div>
  );
}
