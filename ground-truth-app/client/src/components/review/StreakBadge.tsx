// @a11y-strict
// client/src/components/review/StreakBadge.tsx — "6-day streak" in the review toolbar
// Session 17 · Wave 1 · semantic token for warning
// Session 51 · Build 5 · wave 5-2 · ui Badge (warning tone), no lucide, test id review-streak-badge

import { useUserStats } from '../../lib/api/hooks';
import { Badge } from '../ui';

export function StreakBadge() {
  const { data: stats } = useUserStats();
  const streak = stats?.currentStreakDays ?? 0;
  if (streak < 1) return null;
  return (
    <Badge tone="warning" data-testid="review-streak-badge">
      {streak}-day streak
    </Badge>
  );
}
