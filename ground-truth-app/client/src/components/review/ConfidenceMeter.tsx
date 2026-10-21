// client/src/components/review/ConfidenceMeter.tsx
// Session 12 · Wave 4

import { Badge, Progress } from '@databricks/appkit-ui/react';
import { ShieldCheck } from 'lucide-react';
import type { AssetStatus, ConfidenceScore } from '../../../../shared/contracts';

interface ConfidenceMeterProps {
  confidence: ConfidenceScore | null;
  status: AssetStatus;
}

export function ConfidenceMeter({ confidence, status }: ConfidenceMeterProps) {
  const pct = confidence ? Math.round(confidence.confidence * 100) : 0;
  const isCertified = status === 'CERTIFIED';

  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className="flex-1 h-2" aria-label={`Confidence ${pct}%`} />
      <span className="text-xs font-medium text-muted-foreground w-10 text-right">
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
