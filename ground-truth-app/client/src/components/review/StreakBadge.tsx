// client/src/components/review/StreakBadge.tsx
// Session 17 · Wave 1 · semantic token for warning

import { Badge } from '@databricks/appkit-ui/react';
import { Flame } from 'lucide-react';
import { useUserStats } from '../../lib/api/hooks';

export function StreakBadge() {
  const { data: stats } = useUserStats();
  const streak = stats?.currentStreakDays ?? 0;

  if (streak < 1) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <Flame className="h-3 w-3 text-[var(--warning)]" />
      {streak}d streak
    </Badge>
  );
}
