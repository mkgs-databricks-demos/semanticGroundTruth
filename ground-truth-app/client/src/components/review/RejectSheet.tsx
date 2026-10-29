// @a11y-strict
// client/src/components/review/RejectSheet.tsx — Reject sheet: optional "What's wrong?" feedback
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · ui Sheet primitive (right on md+, bottom on phones), 4000-char
// counter, destructive "Reject" with closeIcon, spinner while submitting (brief S1). Feedback is
// optional (screen_inventory S1, VoteBody.feedback?); the textarea gets focus on open (KB K1).

import { useEffect, useId, useState } from 'react';
import { Button, Textarea } from '@databricks/appkit-ui/react';
import { Icon, Sheet } from '../ui';
import { sheetSide } from './media';
import { Spinner } from './VoteBar';

export const FEEDBACK_MAX = 4000;

interface RejectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  /** Trimmed feedback, or undefined when the reviewer left it empty. */
  onSubmit: (feedback: string | undefined) => void;
  submitting: boolean;
}

export function RejectSheet({ open, onOpenChange, assetName, onSubmit, submitting }: RejectSheetProps) {
  const fieldId = useId();
  const countId = useId();
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const submit = () => {
    if (submitting) return;
    const feedback = text.trim();
    onSubmit(feedback ? feedback : undefined);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side={sheetSide()}
      title="Reject definition"
      description={`Tell the steward what needs attention in ${assetName}.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-[44px]" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="review-reject-sheet-submit"
            className="min-h-[44px] gap-1.5"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? <Spinner /> : <Icon name="close" size={16} />}
            Reject
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm font-bold">
          What&apos;s wrong? <span className="font-normal text-muted-foreground">Optional</span>
        </label>
        <Textarea
          id={fieldId}
          autoFocus
          rows={6}
          maxLength={FEEDBACK_MAX}
          value={text}
          disabled={submitting}
          aria-describedby={countId}
          placeholder="Help the steward understand what needs attention"
          onChange={(e) => setText(e.target.value)}
        />
        <p id={countId} className="text-xs text-muted-foreground tabular-nums">
          {text.length} / {FEEDBACK_MAX}
        </p>
      </div>
    </Sheet>
  );
}
