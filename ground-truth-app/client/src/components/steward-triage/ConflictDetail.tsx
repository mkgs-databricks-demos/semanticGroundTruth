// @a11y-strict
// client/src/components/steward-triage/ConflictDetail.tsx — S9 detail pane + resolution bar
// Session 55 · Build 5 · wave 5-3 (inventory S9, brief S9)
//
// Current values come from GET /api/assets/:assetId (the conflict group has
// only the proposals). One card per edit vote, each a radio in the group
// "Proposed descriptions" (or "Proposed edits" when fields differ), with a
// word-level DiffText (<ins>/<del>, never color alone) against the current
// value. Resolution bar: Accept selected edit, Keep current, Reject all
// (the page opens the confirm), optional note (4000 chars).

import { forwardRef, useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import type { Asset, ConflictGroup } from '../../../../shared/contracts';
import { useAsset } from '../../lib/api';
import { formatRelativeTime } from '../../lib/time';
import { cn } from '../../lib/utils';
import { DiffText, Icon, InlineAlert, KeyHint, SkeletonGroup } from '../ui';
import {
  conflictFields,
  currentFieldValue,
  FIELD_LABELS,
  groupProposals,
  initials,
  NOTE_MAX,
  proposalsGroupName,
  tallyLabel,
} from './labels';

export interface ConflictDetailProps {
  group: ConflictGroup;
  choice: string | null;
  onChoose: (voteId: string) => void;
  note: string;
  onNote: (note: string) => void;
  writesDisabled: boolean;
  resolving: boolean;
  onAccept: () => void;
  onKeep: () => void;
  onRejectAll: () => void;
  /** Mobile back link ("Esc back to list"). */
  onBack: () => void;
  /** Stale / error alert from the last resolve, shown above the bar. */
  alert?: ReactNode;
  now?: Date;
}

export const ConflictDetail = forwardRef<HTMLTextAreaElement, ConflictDetailProps>(function ConflictDetail(
  { group, choice, onChoose, note, onNote, writesDisabled, resolving, onAccept, onKeep, onRejectAll, onBack, alert, now },
  noteRef,
) {
  const id = useId();
  const asset = useAsset(group.assetId);
  const fields = conflictFields(group);
  const proposals = groupProposals(group.edits);
  const current: Asset | null = asset.isSuccess ? asset.data : null;
  const disabled = writesDisabled || resolving;

  return (
    <section aria-labelledby={`${id}-title`} data-testid="steward-conflicts-detail" className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
      >
        Back to conflicts
      </button>
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-xl font-bold">
          {group.displayName}
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="steward-conflicts-tally">
          {tallyLabel(group)}
        </p>
      </div>

      <div data-testid="steward-conflicts-current" className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4">
        <h3 className="text-sm font-bold">Current</h3>
        {asset.isPending ? (
          <SkeletonGroup label="Loading the current values" lines={2} />
        ) : asset.isError ? (
          <InlineAlert title="Couldn't load the current values" onRetry={() => void asset.refetch()} retrying={asset.isFetching}>
            {asset.error.message || 'The proposals are shown without a comparison.'}
          </InlineAlert>
        ) : (
          fields.map((f) => (
            <div key={f} className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">{FIELD_LABELS[f]}</p>
              <p className="whitespace-pre-wrap text-sm">{currentFieldValue(asset.data, f) || 'Not set'}</p>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Compared with the current value: <ins className="underline decoration-2">inserted words are underlined</ins>,{' '}
        <del className="line-through decoration-2">removed words are struck through</del>.
      </p>

      <div role="radiogroup" aria-label={proposalsGroupName(fields)} className="flex flex-col gap-3">
        {proposals.map((p, index) => {
          const checked = choice === p.voteId;
          const inputId = `${id}-proposal-${index}`;
          return (
            <div
              key={p.voteId}
              data-testid="steward-conflicts-proposal"
              data-vote-id={p.voteId}
              data-checked={checked ? 'true' : 'false'}
              className={cn(
                'flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                checked ? 'border-primary ring-1 ring-primary' : 'border-border',
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  id={inputId}
                  type="radio"
                  name={`${id}-proposal`}
                  value={p.voteId}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onChoose(p.voteId)}
                  data-testid="steward-conflicts-proposal-select"
                  className="mt-1 h-5 w-5 accent-primary"
                />
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {initials(p.userId)}
                </span>
                <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                  <span className="font-medium">
                    Proposal {index + 1} by {p.userId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <time dateTime={p.createdAt}>{formatRelativeTime(p.createdAt, now)}</time>
                  </span>
                </label>
                {index < 9 ? (
                  <span aria-hidden="true">
                    <KeyHint keys={[String(index + 1)]} />
                  </span>
                ) : null}
              </div>
              {p.edits.map((e) => (
                <div key={e.field} className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-muted-foreground">{FIELD_LABELS[e.field]}</p>
                  {current ? (
                    <DiffText before={currentFieldValue(current, e.field)} after={e.value} className="text-sm" />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{e.value}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {alert}

      <div className="sticky bottom-0 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            ref={noteRef}
            id={`${id}-note`}
            data-testid="steward-conflicts-note"
            aria-keyshortcuts="N"
            aria-describedby={`${id}-note-count`}
            maxLength={NOTE_MAX}
            rows={2}
            value={note}
            disabled={disabled}
            onChange={(e) => onNote(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p id={`${id}-note-count`} className="text-xs text-muted-foreground">
            {note.length} / {NOTE_MAX} characters. Sent to the edit authors with the outcome.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-[44px] gap-1.5"
            disabled={disabled || choice === null}
            onClick={onAccept}
            aria-keyshortcuts="A Enter"
            data-testid="steward-conflicts-accept"
          >
            <Icon name="check" />
            Accept selected edit
          </Button>
          <Button
            variant="secondary"
            className="min-h-[44px]"
            disabled={disabled}
            onClick={onKeep}
            aria-keyshortcuts="C"
            data-testid="steward-conflicts-keep"
          >
            Keep current
          </Button>
          <Button
            variant="destructive"
            className="min-h-[44px] gap-1.5"
            disabled={disabled}
            onClick={onRejectAll}
            aria-keyshortcuts="X"
            data-testid="steward-conflicts-reject-all"
          >
            <Icon name="close" />
            Reject all
          </Button>
        </div>
        {resolving ? (
          <p role="status" className="text-sm text-muted-foreground">
            Resolving…
          </p>
        ) : null}
      </div>
    </section>
  );
});
