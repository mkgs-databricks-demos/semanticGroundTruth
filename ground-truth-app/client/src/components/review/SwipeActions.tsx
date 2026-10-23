// client/src/components/review/SwipeActions.tsx — always-visible vote buttons
// Session 17 · Wave 1 · semantic tokens, visible labels, ≥ 44 × 44 px targets

import { Button } from '@databricks/appkit-ui/react';
import { Check, Pencil, SkipForward, X } from 'lucide-react';
import type { VoteType } from '../../../../shared/contracts';

interface SwipeActionsProps {
  onVote: (type: VoteType) => void;
  disabled?: boolean;
}

export function SwipeActions({ onVote, disabled }: SwipeActionsProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button
        variant="outline"
        className="min-h-[44px] min-w-[44px] gap-1.5 rounded-full border-vote-reject/40 text-vote-reject hover:bg-vote-reject/10"
        onClick={() => onVote('reject')}
        disabled={disabled}
        aria-label="Reject (← key)"
      >
        <X className="h-5 w-5" />
        <span className="text-xs font-medium">Reject</span>
      </Button>
      <Button
        variant="outline"
        className="min-h-[44px] min-w-[44px] gap-1.5 rounded-full border-vote-edit/40 text-vote-edit hover:bg-vote-edit/10"
        onClick={() => onVote('edit')}
        disabled={disabled}
        aria-label="Edit (↑ key)"
      >
        <Pencil className="h-4 w-4" />
        <span className="text-xs font-medium">Edit</span>
      </Button>
      <Button
        variant="outline"
        className="min-h-[44px] min-w-[44px] gap-1.5 rounded-full border-vote-approve/40 text-vote-approve hover:bg-vote-approve/10"
        onClick={() => onVote('approve')}
        disabled={disabled}
        aria-label="Approve (→ key)"
      >
        <Check className="h-5 w-5" />
        <span className="text-xs font-medium">Approve</span>
      </Button>
      <Button
        variant="ghost"
        className="min-h-[44px] min-w-[44px] gap-1.5 rounded-full text-vote-skip hover:bg-vote-skip/10"
        onClick={() => onVote('skip')}
        disabled={disabled}
        aria-label="Skip (S key)"
      >
        <SkipForward className="h-4 w-4" />
        <span className="text-xs font-medium">Skip</span>
      </Button>
    </div>
  );
}
