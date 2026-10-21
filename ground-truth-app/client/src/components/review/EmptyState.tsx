// client/src/components/review/EmptyState.tsx
// Session 12 · Wave 4

import { PartyPopper } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <PartyPopper className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">All caught up!</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        There are no assets waiting for your review right now. Check back later
        or switch campaigns.
      </p>
    </div>
  );
}
