// @a11y-strict
// client/src/components/review/ConfidenceMeter.tsx — confidence meter on the review card
// Session 17 · Wave 1 · --confidence-* token bands + numeric value
// Session 51 · Build 5 · wave 5-2 · role="meter" "Confidence 71%", "71% confidence · 11 votes" text (brief S1)

import type { AssetStatus, ConfidenceScore } from '../../../../shared/contracts';
import { Badge, Icon } from '../ui';

/** Band token for a confidence percentage (ui_brand_plan: low < 40 <= mid < 70 <= high). */
export function confidenceColor(pct: number): string {
  if (pct >= 70) return 'var(--confidence-high)';
  if (pct >= 40) return 'var(--confidence-mid)';
  return 'var(--confidence-low)';
}

interface ConfidenceMeterProps {
  confidence: ConfidenceScore | null;
  status: AssetStatus;
}

export function ConfidenceMeter({ confidence, status }: ConfidenceMeterProps) {
  const pct = confidence ? Math.round(confidence.confidence * 100) : 0;
  const votes = confidence?.totalVotes ?? 0;
  const color = confidenceColor(pct);
  const text = confidence ? `${pct}% confidence · ${votes} ${votes === 1 ? 'vote' : 'votes'}` : 'No votes yet';

  return (
    <div data-testid="review-card-confidence" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {text}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`Confidence ${pct}%`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {status === 'CERTIFIED' ? (
        <Badge tone="success" className="gap-1 self-start">
          <Icon name="shield" size={14} />
          Certified
        </Badge>
      ) : null}
    </div>
  );
}
