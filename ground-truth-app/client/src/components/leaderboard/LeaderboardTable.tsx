// client/src/components/leaderboard/LeaderboardTable.tsx — ranked reviewer table
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import type { LeaderboardEntry } from '../../../../shared/contracts';
import { cn } from '../../lib/utils';

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
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Votes</TableHead>
          <TableHead className="text-right">Streak</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <TableRow
              key={entry.userId}
              className={cn(isMe && 'bg-primary/5 font-medium')}
            >
              <TableCell className="font-mono text-muted-foreground">
                #{entry.rank}
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
