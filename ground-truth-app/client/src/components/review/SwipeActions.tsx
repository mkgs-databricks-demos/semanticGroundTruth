// client/src/components/review/SwipeActions.tsx — always-visible vote buttons
// Session 12 · Wave 4

import { Button } from '@databricks/appkit-ui/react';
import { Check, Pencil, X } from 'lucide-react';
import type { VoteType } from '../../../../shared/contracts';

interface SwipeActionsProps {
  onVote: (type: VoteType) => void;
  disabled?: boolean;
}

export function SwipeActions({ onVote, disabled }: SwipeActionsProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        variant="outline"
        size="lg"
        className="rounded-full h-14 w-14 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        onClick={() => onVote('reject')}
        disabled={disabled}
        aria-label="Reject"
      >
        <X className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="rounded-full h-12 w-12 border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
        onClick={() => onVote('edit')}
        disabled={disabled}
        aria-label="Edit"
      >
        <Pencil className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="rounded-full h-14 w-14 border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
        onClick={() => onVote('approve')}
        disabled={disabled}
        aria-label="Approve"
      >
        <Check className="h-6 w-6" />
      </Button>
    </div>
  );
}
