// @a11y-strict
// client/src/components/leaderboard/BadgeList.tsx — badge labels for gamification
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { Badge } from '@databricks/appkit-ui/react';

const BADGE_LABELS: Record<string, string> = {
  first_vote: 'First Vote',
  ten_votes: '10 Votes',
  fifty_votes: '50 Votes',
  hundred_votes: '100 Votes',
  streak_7: '7-Day Streak',
  streak_30: '30-Day Streak',
};

export function BadgeList({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge key={b} variant="secondary">
          {BADGE_LABELS[b] ?? b}
        </Badge>
      ))}
    </div>
  );
}
