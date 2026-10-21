// client/src/components/review/ProgressBar.tsx
// Session 12 · Wave 4

import { Progress } from '@databricks/appkit-ui/react';

interface ProgressBarProps {
  reviewed: number;
  total: number;
}

export function ProgressBar({ reviewed, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Progress value={pct} className="flex-1 h-1.5" aria-label={`Review progress ${pct}%`} />
      <span>{reviewed}/{total}</span>
    </div>
  );
}
