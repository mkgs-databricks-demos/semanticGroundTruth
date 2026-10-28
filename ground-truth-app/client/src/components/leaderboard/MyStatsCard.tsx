// @a11y-strict
// client/src/components/leaderboard/MyStatsCard.tsx — current user’s stats card (S2)
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 53 · Build 5 · wave 5-2: 8 stats in a 4-column grid (2 on mobile),
// Skipped shown with the skip icon and the footnote "Skips don't count toward
// rank" (plan 25: shown, never ranked), skeleton + error-with-Retry states,
// data-testid per ui_test_strategy §3.

import type { UserStats } from '../../../../shared/contracts';
import { useUserStats } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Icon, InlineAlert, Skeleton, type IconName } from '../ui';

interface StatSpec {
  label: string;
  icon: IconName;
  value: (s: UserStats) => string;
  testId?: 'leaderboard-stats-rank' | 'leaderboard-stats-skipped';
}

/** Order and labels from figma_make_brief S2. */
export const STAT_SPECS: readonly StatSpec[] = [
  { label: 'Rank', icon: 'ranking', value: (s) => `#${s.rank}`, testId: 'leaderboard-stats-rank' },
  { label: 'Total votes', icon: 'checklist', value: (s) => String(s.totalVotes) },
  { label: 'Approvals', icon: 'check', value: (s) => String(s.approvals) },
  { label: 'Rejections', icon: 'close', value: (s) => String(s.rejections) },
  { label: 'Edits', icon: 'pencil', value: (s) => String(s.edits) },
  { label: 'Streak', icon: 'history', value: (s) => `${s.currentStreakDays}d` },
  { label: 'Coverage', icon: 'dashboard', value: (s) => `${Math.round(s.coveragePct)}%` },
  { label: 'Skipped', icon: 'skip', value: (s) => String(s.skippedCount), testId: 'leaderboard-stats-skipped' },
];

const GRID = 'grid grid-cols-2 gap-4 sm:grid-cols-4';

export function MyStatsCard({ subtitle }: { subtitle?: string }) {
  const { data, isPending, isError, refetch, isFetching } = useUserStats();

  return (
    <section
      aria-labelledby="leaderboard-my-stats-title"
      data-testid="leaderboard-stats-root"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 id="leaderboard-my-stats-title" className="text-lg font-bold">
          My stats
        </h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>

      {data ? (
        <>
          <dl className={GRID}>
            {STAT_SPECS.map((spec) => (
              // dt / dd stay direct children of the group div (axe dlitem); the icon sits in the dt.
              <div key={spec.label} data-testid={spec.testId} className="flex flex-col gap-1">
                <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
                  >
                    <Icon name={spec.icon} size={14} />
                  </span>
                  {spec.label}
                </dt>
                <dd className="pl-9 text-lg font-bold tabular-nums">{spec.value(data)}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="skip" size={14} />
            Skips don&apos;t count toward rank
          </p>
        </>
      ) : isPending ? (
        <div role="status" aria-busy="true" className={GRID}>
          <span className="sr-only">Loading your stats</span>
          {STAT_SPECS.map((spec) => (
            <div key={spec.label} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className={cn('h-5', 'w-10')} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <InlineAlert
          title="We couldn't load your stats"
          onRetry={() => void refetch()}
          retrying={isFetching}
        >
          Your votes are safe. Try again in a moment.
        </InlineAlert>
      ) : null}
    </section>
  );
}
