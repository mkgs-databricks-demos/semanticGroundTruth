// @a11y-strict
// client/src/components/review/ProgressBar.tsx — review progress on the card
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · progressbar "Review progress 42 of 120", brand-accent fill (brief S1)

interface ProgressBarProps {
  reviewed: number;
  total: number;
  /** Visible caption ("Campaign progress" on campaign cards). */
  label?: string;
}

export function ProgressBar({ reviewed, total, label = 'Review progress' }: ProgressBarProps) {
  const max = Math.max(total, 0);
  const pct = max > 0 ? Math.min(100, Math.round((reviewed / max) * 100)) : 0;
  return (
    <div data-testid="review-card-progress" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">
          {reviewed} of {total} reviewed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Review progress ${reviewed} of ${total}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(reviewed, max)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
