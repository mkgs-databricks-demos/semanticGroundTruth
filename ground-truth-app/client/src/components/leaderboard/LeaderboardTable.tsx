// @a11y-strict
// client/src/components/leaderboard/LeaderboardTable.tsx — ranked reviewer table (S2)
// Session 17 · Wave 1 · brand: muted uppercase header, accent current-user row, medals
// Session 53 · Build 5 · wave 5-2: Figma S2 columns (Rank, Name, Votes,
// Approvals, Edits, Streak), medals with an accessible name, "You" badge,
// visually hidden caption, data-testid per ui_test_strategy §3, no lucide.
// Skips are never a rank or sort column (plan 25): the skipped count lives in
// My stats only. Rows are not focusable (screen_inventory S2 keyboard).

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import type { LeaderboardEntry } from '../../../../shared/contracts';
import { cn } from '../../lib/utils';
import { Badge } from '../ui';
import { MEDAL_LABELS, MedalIcon, isPodium } from './MedalIcon';

const HEAD = 'text-xs font-medium uppercase tracking-wider text-muted-foreground';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function RankCell({ rank }: { rank: number }) {
  if (isPodium(rank)) {
    return (
      <span role="img" aria-label={MEDAL_LABELS[rank]} className="inline-flex items-center gap-1 font-bold tabular-nums">
        <MedalIcon rank={rank} />
        {rank}
      </span>
    );
  }
  return <span className="pl-6 tabular-nums text-muted-foreground">{rank}</span>;
}

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId: string | undefined;
  /** Visually hidden caption, e.g. "Top reviewers, last 7 days". */
  caption: string;
}

export function LeaderboardTable({ entries, currentUserId, caption }: LeaderboardTableProps) {
  return (
    // Session 62 · wave 5-9: this wrapper is the only horizontal scroller (AppKit's inner
    // table-container is kept from scrolling), and it is a focusable, named region so
    // keyboard users can scroll it (axe scrollable-region-focusable at 390 px).
    <div
      data-testid="leaderboard-table-root"
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-border bg-card [&>[data-slot=table-container]]:overflow-visible"
    >
      <Table>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead scope="col" className={cn('w-20', HEAD)}>Rank</TableHead>
            <TableHead scope="col" className={HEAD}>Name</TableHead>
            <TableHead scope="col" className={cn('text-right', HEAD)}>Votes</TableHead>
            <TableHead scope="col" className={cn('text-right', HEAD)}>Approvals</TableHead>
            <TableHead scope="col" className={cn('text-right', HEAD)}>Edits</TableHead>
            <TableHead scope="col" className={cn('text-right', HEAD)}>Streak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isMe = currentUserId !== undefined && entry.userId === currentUserId;
            const name = entry.displayName || entry.email;
            return (
              <TableRow
                key={entry.userId}
                data-testid="leaderboard-table-row"
                data-user-id={entry.userId}
                data-current-user={isMe ? 'true' : undefined}
                className={cn(isMe && 'bg-accent text-accent-foreground hover:bg-accent')}
              >
                <TableCell>
                  <RankCell rank={entry.rank} />
                </TableCell>
                <TableCell>
                  <div
                    className="flex items-center gap-2"
                    data-testid={isMe ? 'leaderboard-table-current-user' : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground"
                    >
                      {initials(name)}
                    </span>
                    <span className="font-medium">{name}</span>
                    {isMe ? <Badge tone="outline">You</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">{entry.totalVotes}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.approvals}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.edits}</TableCell>
                <TableCell className="text-right tabular-nums">{entry.currentStreakDays}d</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
