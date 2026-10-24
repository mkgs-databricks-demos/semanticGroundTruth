// client/src/components/leaderboard/LeaderboardTable.tsx — ranked reviewer table
// Session 17 · Wave 1 · brand: muted uppercase header, accent current-user row, medals

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../../../../shared/contracts';
import { cn } from '../../lib/utils';

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    const label = rank === 1 ? 'Gold' : rank === 2 ? 'Silver' : 'Bronze';
    return (
      <span className="inline-flex items-center gap-1" aria-label={`${label} medal, rank ${rank}`}>
        <Medal className="h-4 w-4 text-[var(--warning)]" />
        {rank}
      </span>
    );
  }
  return <span className="font-mono text-muted-foreground">#{rank}</span>;
}

export function LeaderboardTable({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string | undefined;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No leaderboard entries yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16 text-xs font-medium uppercase tracking-wider text-muted-foreground">Rank</TableHead>
          <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</TableHead>
          <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Votes</TableHead>
          <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Streak</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <TableRow
              key={entry.userId}
              className={cn(isMe && 'bg-accent font-medium')}
            >
              <TableCell>
                <RankCell rank={entry.rank} />
              </TableCell>
              <TableCell>
                <span className={cn(isMe && 'text-primary')}>
                  {entry.displayName || entry.email}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {entry.totalVotes}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {entry.currentStreakDays}d
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
