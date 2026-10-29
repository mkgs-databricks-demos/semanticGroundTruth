// @a11y-strict
// client/src/components/review/SkipReasonPicker.tsx — "Why skip?" popover (F5, brief S1)
// Session 51 · Build 5 · wave 5-2. Opened by Shift+S or the chevron next to Skip. Four options
// from SKIP_REASONS with 1-4 shortcuts (the page handles the number keys); Escape closes and
// returns focus to the chevron (ShellPopover, session 49).

import type { RefObject } from 'react';
import { SKIP_REASONS } from '../../../../shared/contracts';
import type { SkipReason } from '../../../../shared/contracts';
import { ShellPopover } from '../layout/ShellPopover';
import { KeyHint } from '../ui';

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  not_sure: 'Not sure',
  not_my_area: 'Not my area',
  need_context: 'Need more context',
  other: 'Other',
};

export const SKIP_REASONS_POPOVER_ID = 'review-skip-reasons';

interface SkipReasonPickerProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onChoose: (reason: SkipReason) => void;
  cooldownHours: number;
}

export function SkipReasonPicker({ open, onClose, triggerRef, onChoose, cooldownHours }: SkipReasonPickerProps) {
  return (
    <ShellPopover
      id={SKIP_REASONS_POPOVER_ID}
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      label="Why skip?"
      className="bottom-full top-auto mb-2 w-72"
    >
      <div className="flex flex-col gap-1 p-3">
        <h3 className="px-2 pb-1 text-sm font-bold">Why skip?</h3>
        <ul className="flex flex-col gap-1">
          {SKIP_REASONS.map((reason, i) => (
            <li key={reason}>
              <button
                type="button"
                data-testid="review-skip-reason-option"
                data-reason={reason}
                onClick={() => onChoose(reason)}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <KeyHint keys={[String(i + 1)]} />
                {SKIP_REASON_LABELS[reason]}
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          Skipping doesn&apos;t count as a vote. You&apos;ll see this again in {cooldownHours} hours.
        </p>
      </div>
    </ShellPopover>
  );
}
