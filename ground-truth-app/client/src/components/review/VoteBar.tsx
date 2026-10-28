// @a11y-strict
// client/src/components/review/VoteBar.tsx — Reject / Edit / Approve / Skip under the review card
// Session 51 · Build 5 · wave 5-2. Replaces SwipeActions. Icon + text on every button, 44 px
// targets, names "Approve (A)" etc. (brief S1). Skip is a secondary ghost button (--vote-skip)
// with a chevron that opens the skip-reason popover. Disabled while a request is in flight
// (spinner in the pressed button) or offline (reason shown under the bar).

import { useId } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { Icon, KeyHint } from '../ui';
import { SKIP_REASONS_POPOVER_ID } from './SkipReasonPicker';

export type ReviewAction = 'approve' | 'reject' | 'edit' | 'skip';

/** Decorative spinner for the pressed button (the global reduced-motion rule stops the spin). */
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

interface VoteBarProps {
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onToggleReasons: () => void;
  /** The action whose request is in flight. */
  pending: ReviewAction | null;
  /** Disables every action and is shown under the bar (offline). */
  disabledReason: string | null;
  /** Other reasons to disable without a message (next card loading). */
  busy: boolean;
  showHints: boolean;
  reasonsOpen: boolean;
  rejectRef: RefObject<HTMLButtonElement | null>;
  editRef: RefObject<HTMLButtonElement | null>;
  reasonTriggerRef: RefObject<HTMLButtonElement | null>;
  /** The skip-reason popover, anchored to the Skip group. */
  picker: ReactNode;
}

export function VoteBar({
  onApprove,
  onReject,
  onEdit,
  onSkip,
  onToggleReasons,
  pending,
  disabledReason,
  busy,
  showHints,
  reasonsOpen,
  rejectRef,
  editRef,
  reasonTriggerRef,
  picker,
}: VoteBarProps) {
  const reasonId = useId();
  const disabled = pending !== null || disabledReason !== null || busy;
  const describedBy = disabledReason ? reasonId : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <div role="group" aria-label="Review actions" className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button
          ref={rejectRef}
          variant="outline"
          data-testid="review-actions-reject"
          aria-label="Reject (R)"
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={onReject}
          className="min-h-[44px] gap-1.5 border-vote-reject/40 text-vote-reject hover:bg-vote-reject/10"
        >
          {pending === 'reject' ? <Spinner /> : <Icon name="close" size={20} />}
          <span>Reject</span>
        </Button>
        <Button
          ref={editRef}
          variant="outline"
          data-testid="review-actions-edit"
          aria-label="Edit (E)"
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={onEdit}
          className="min-h-[44px] gap-1.5 border-vote-edit/40 text-vote-edit hover:bg-vote-edit/10"
        >
          {pending === 'edit' ? <Spinner /> : <Icon name="pencil" size={20} />}
          <span>Edit</span>
        </Button>
        <Button
          variant="outline"
          data-testid="review-actions-approve"
          aria-label="Approve (A)"
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={onApprove}
          className="min-h-[52px] gap-2 border-2 border-vote-approve px-6 text-base font-bold text-vote-approve hover:bg-vote-approve/10"
        >
          {pending === 'approve' ? <Spinner /> : <Icon name="check" size={20} />}
          <span>Approve</span>
        </Button>
        <div className="relative flex items-center">
          <Button
            variant="ghost"
            data-testid="review-actions-skip"
            aria-label="Skip (S)"
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={onSkip}
            className="min-h-[44px] gap-1.5 text-vote-skip"
          >
            {pending === 'skip' ? <Spinner /> : <Icon name="skip" size={20} />}
            <span>Skip</span>
          </Button>
          <Button
            ref={reasonTriggerRef}
            variant="ghost"
            size="icon"
            data-testid="review-actions-skip-reason"
            aria-label="Choose a skip reason"
            aria-haspopup="dialog"
            aria-expanded={reasonsOpen}
            aria-controls={reasonsOpen ? SKIP_REASONS_POPOVER_ID : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={onToggleReasons}
            className="min-h-[44px] min-w-[44px] text-vote-skip"
          >
            <Icon name="arrowDown" size={16} />
          </Button>
          {picker}
        </div>
      </div>
      {disabledReason ? (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
      {showHints ? (
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <KeyHint keys={['A']} /> approve · <KeyHint keys={['R']} /> reject · <KeyHint keys={['E']} /> edit ·{' '}
          <KeyHint keys={['S']} /> skip · <KeyHint keys={['?']} /> shortcuts
        </p>
      ) : null}
    </div>
  );
}
