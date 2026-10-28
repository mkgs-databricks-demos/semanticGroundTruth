// @a11y-strict
// client/src/pages/leaderboard/LeaderboardPage.tsx — S2 Leaderboard
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 53 · Build 5 · wave 5-2 (screen_inventory S2, figma_make_brief S2,
// ui_test_strategy §8 S2 rows). States: loading (stats skeleton + 5 row
// skeletons), populated (medals, "You" row), empty ("Start reviewing" → /),
// error (alert + Retry), offline (cached data + "Last updated" note; nothing
// cached → offline alert). The page is read-only, so offline disables nothing.

import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import { useLeaderboard, useMe } from '../../lib/api';
import { formatRelativeTime } from '../../lib/time';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { LeaderboardTable } from '../../components/leaderboard/LeaderboardTable';
import { MyStatsCard } from '../../components/leaderboard/MyStatsCard';
import {
  PeriodTabs,
  periodSpec,
  periodTabId,
  type LeaderboardPeriod,
} from '../../components/leaderboard/PeriodTabs';
import { EmptyPanel, Icon, InlineAlert, Skeleton } from '../../components/ui';

/** Rows requested per period (screen_inventory S2: limit=25). */
export const LEADERBOARD_LIMIT = 25;
const SKELETON_ROWS = 5;

function TableSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <span className="sr-only">Loading leaderboard</span>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <Skeleton key={i} data-testid="leaderboard-table-skeleton" className="h-10 w-full" />
      ))}
    </div>
  );
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('7d');
  const idPrefix = `leaderboard${useId().replace(/:/g, '')}`;
  const panelId = `${idPrefix}-panel`;
  const online = useOnlineStatus();
  const me = useMe();
  const board = useLeaderboard({ period, limit: LEADERBOARD_LIMIT });
  const spec = periodSpec(period);

  let body;
  if (board.data) {
    body =
      board.data.length === 0 ? (
        <div data-testid="leaderboard-empty-root">
          <EmptyPanel
            illustration="users"
            title="No reviews in this period yet"
            description="Be the first to help your team certify a semantic asset."
            action={
              <Button asChild>
                <Link to="/">Start reviewing</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <LeaderboardTable
          entries={board.data}
          currentUserId={me.data?.userId}
          caption={`Top reviewers, ${spec.caption}`}
        />
      );
  } else if (board.isError) {
    body = (
      <InlineAlert title="We couldn't load the leaderboard">
        <p>Your stats are safe. Try loading this page again.</p>
        <Button
          variant="outline"
          size="sm"
          data-testid="leaderboard-error-retry"
          className="mt-2 min-h-[44px] gap-1.5"
          disabled={board.isFetching}
          onClick={() => void board.refetch()}
        >
          <Icon name="refresh" size={16} />
          Retry
        </Button>
      </InlineAlert>
    );
  } else if (!online) {
    body = (
      <InlineAlert variant="offline" title="You're offline">
        The leaderboard loads when the connection is back.
      </InlineAlert>
    );
  } else {
    body = <TableSkeleton />;
  }

  const showLastUpdated = !online && board.data !== undefined && board.dataUpdatedAt > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            See who&apos;s helping make semantic definitions more trustworthy.
          </p>
        </div>
        {showLastUpdated ? (
          <p data-testid="leaderboard-offline-note" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon name="cloudOff" size={16} />
            Offline. Last updated {formatRelativeTime(new Date(board.dataUpdatedAt).toISOString())}
          </p>
        ) : null}
      </div>

      <MyStatsCard subtitle={me.data ? me.data.displayName || me.data.email : undefined} />

      <section aria-labelledby={`${idPrefix}-rankings-title`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={`${idPrefix}-rankings-title`} className="text-lg font-bold">
              Top reviewers
            </h2>
            <p className="text-sm text-muted-foreground">Ranked by votes in the selected period</p>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} idPrefix={idPrefix} panelId={panelId} />
        </div>
        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={periodTabId(idPrefix, period)}
          tabIndex={0}
          className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </div>
      </section>
    </div>
  );
}
