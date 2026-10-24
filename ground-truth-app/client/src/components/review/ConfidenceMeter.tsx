// client/src/components/review/ConfidenceMeter.tsx
// Session 17 · Wave 1 · --confidence-* token bands + numeric value

import { Badge } from '@databricks/appkit-ui/react';
import { ShieldCheck } from 'lucide-react';
import type { AssetStatus, ConfidenceScore } from '../../../../shared/contracts';

interface ConfidenceMeterProps {
  confidence: ConfidenceScore | null;
  status: AssetStatus;
}

function bandColor(pct: number): string {
  if (pct >= 70) return 'var(--confidence-high)';
  if (pct >= 40) return 'var(--confidence-mid)';
  return 'var(--confidence-low)';
}

export function ConfidenceMeter({ confidence, status }: ConfidenceMeterProps) {
  const pct = confidence ? Math.round(confidence.confidence * 100) : 0;
  const isCertified = status === 'CERTIFIED';
  const color = bandColor(pct);

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence ${pct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-normal"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs font-medium tabular-nums w-10 text-right"
        style={{ color }}
      >
        {pct}%
      </span>
      {isCertified && (
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          Certified
        </Badge>
      )}
    </div>
  );
}
