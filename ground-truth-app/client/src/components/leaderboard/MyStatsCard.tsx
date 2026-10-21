// client/src/components/leaderboard/MyStatsCard.tsx — current user’s stats card
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { useUserStats } from '../../lib/api';

export function MyStatsCard() {
  const { data, isLoading, error } = useUserStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error?.message ?? 'Unable to load stats.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Stat label="Rank" value={`#${data.rank}`} />
          <Stat label="Total Votes" value={data.totalVotes} />
          <Stat label="Approvals" value={data.approvals} />
          <Stat label="Rejections" value={data.rejections} />
          <Stat label="Edits" value={data.edits} />
          <Stat label="Streak" value={`${data.currentStreakDays}d`} />
          <Stat label="Coverage" value={`${Math.round(data.coveragePct)}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
