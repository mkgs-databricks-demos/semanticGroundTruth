// client/src/components/review/RejectSheet.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '@databricks/appkit-ui/react';
import type { VoteBody } from '../../../../shared/contracts';

interface RejectSheetProps {
  assetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: VoteBody) => void;
  disabled?: boolean;
}

export function RejectSheet({ assetId, open, onOpenChange, onSubmit, disabled }: RejectSheetProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    onSubmit({
      assetId,
      voteType: 'reject',
      feedback: reason || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Reject asset</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Reason (optional)
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="Why is this definition incorrect or incomplete?"
            />
          </div>
          <Button variant="destructive" onClick={handleSubmit} disabled={disabled} className="w-full">
            Confirm reject
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
