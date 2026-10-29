// @a11y-strict
// client/src/components/steward-triage/FeedbackQueueTable.tsx — S8 table + pager
// Session 55 · Build 5 · wave 5-3
//
// Columns (inventory S8): Asset (name + type badge), Votes (VoteBar), Skips
// (+ "Often skipped"), Pending edits (+ Resolve link when >= 2), Last activity
// (relative, absolute in the title). The asset name is the row's button: it
// opens the detail sheet and is what J/K move focus between (KB K3), so the
// sheet returns focus to it on Escape.

import { forwardRef } from 'react';
import { Link } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import type { FeedbackQueueItem } from '../../../../shared/contracts';
import { formatRelativeTime } from '../../lib/time';
import { ASSET_TYPE_LABELS } from '../review/AssetTypeBadge';
import { Badge, Icon } from '../ui';
import { canResolve, conflictsHref, isOftenSkipped, OFTEN_SKIPPED, QUEUE_TITLE } from './labels';
import { VoteBar } from './VoteBar';

/** Attribute on each row's focus target (J/K). */
export const QUEUE_ROW_FOCUS = 'data-queue-row-focus';

export interface FeedbackQueueTableProps {
  items: readonly FeedbackQueueItem[];
  onOpen: (assetId: string) => void;
  now?: Date;
}

export const FeedbackQueueTable = forwardRef<HTMLTableElement, FeedbackQueueTableProps>(function FeedbackQueueTable(
  { items, onOpen, now },
  ref,
) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card text-card-foreground">
      <table ref={ref} className="w-full text-left text-sm">
        <caption className="sr-only">{QUEUE_TITLE}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Asset</th>
            <th scope="col" className="px-4 py-3 font-medium">Votes</th>
            <th scope="col" className="px-4 py-3 font-medium">Skips</th>
            <th scope="col" className="px-4 py-3 font-medium">Pending edits</th>
            <th scope="col" className="px-4 py-3 font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.assetId}
              data-testid="steward-queue-row"
              data-asset-id={item.assetId}
              data-pending-edits={item.pendingEdits}
              className="border-b border-border last:border-b-0 focus-within:bg-muted/40"
            >
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    {...{ [QUEUE_ROW_FOCUS]: '' }}
                    onClick={() => onOpen(item.assetId)}
                    className="min-h-[44px] rounded-sm text-left font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {item.displayName}
                  </button>
                  <Badge tone="outline">{ASSET_TYPE_LABELS[item.assetType]}</Badge>
                </div>
              </td>
              <td className="px-4 py-2">
                <VoteBar votes={item.votes} />
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2 tabular-nums">
                  {item.skips}
                  {isOftenSkipped(item) ? (
                    <Badge tone="info" data-testid="steward-queue-often-skipped">
                      <Icon name="info" size={12} />
                      {OFTEN_SKIPPED}
                    </Badge>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2 tabular-nums">
                  {item.pendingEdits}
                  {canResolve(item) ? (
                    <Link
                      to={conflictsHref(item.assetId)}
                      data-testid="steward-queue-resolve-link"
                      aria-keyshortcuts="C"
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <Icon name="fork" size={14} />
                      Resolve{' '}
                      <span className="sr-only">conflicts for {item.displayName}</span>
                    </Link>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {item.lastActivityAt ? (
                  <time dateTime={item.lastActivityAt} title={new Date(item.lastActivityAt).toLocaleString('en-US')}>
                    {formatRelativeTime(item.lastActivityAt, now)}
                  </time>
                ) : (
                  'No activity yet'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export interface QueuePagerProps {
  offset: number;
  limit: number;
  total: number;
  onOffset: (offset: number) => void;
}

export function QueuePager({ offset, limit, total, onOffset }: QueuePagerProps) {
  if (total <= limit && offset === 0) return null;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);
  return (
    <nav aria-label="Feedback queue pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground" data-testid="steward-queue-page-range">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={offset === 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px]"
          disabled={offset + limit >= total}
          onClick={() => onOffset(offset + limit)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
