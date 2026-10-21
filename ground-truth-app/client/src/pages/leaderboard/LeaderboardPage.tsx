// client/src/pages/leaderboard/LeaderboardPage.tsx — period tabs + leaderboard
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import { useLeaderboard, useMe } from '../../lib/api';
import { LeaderboardTable } from '../../components/leaderboard/LeaderboardTable';
import { MyStatsCard } from '../../components/leaderboard/MyStatsCard';

const PERIODS = ['7d', '30d', 'all'] as const;

export function LeaderboardPage() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('7d');
  const me = useMe();
  const { data, isLoading, error } = useLeaderboard({ period });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-2xl font-bold">Leaderboard</h2>

      <MyStatsCard />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as (typeof PERIODS)[number])}>
        <TabsList>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        {PERIODS.map((p) => (
          <TabsContent key={p} value={p}>
            {isLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-destructive">
                {error.message}
              </p>
            ) : (
              <LeaderboardTable
                entries={data ?? []}
                currentUserId={me.data?.userId}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
