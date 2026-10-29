// @a11y-strict
// client/src/components/steward-triage/VoteBar.tsx — stacked approve / reject / edit bar (S8)
// Session 55 · Build 5 · wave 5-3
//
// One `role="img"` named "8 approvals, 2 rejections, 3 edits" (brief S8), so
// a screen reader hears counts, not colors. Sighted users get the same
// counts as numbers next to icons; the colored segments are extra.

import type { FeedbackQueueItem } from '../../../../shared/contracts';
import { Icon } from '../ui';
import type { IconName } from '../ui';
import { totalVotes, voteBarLabel } from './labels';

const SEGMENTS: readonly { key: keyof FeedbackQueueItem['votes']; icon: IconName; bar: string }[] = [
  { key: 'approve', icon: 'check', bar: 'bg-vote-approve' },
  { key: 'reject', icon: 'close', bar: 'bg-vote-reject' },
  { key: 'edit', icon: 'pencil', bar: 'bg-vote-edit' },
];

export function VoteBar({ votes }: { votes: FeedbackQueueItem['votes'] }) {
  const total = totalVotes(votes);
  return (
    <div role="img" aria-label={voteBarLabel(votes)} data-testid="steward-queue-vote-bar" className="flex flex-col gap-1">
      <span className="flex h-2 w-24 overflow-hidden rounded-full bg-muted">
        {total > 0
          ? SEGMENTS.map((s) =>
              votes[s.key] > 0 ? (
                <span key={s.key} className={s.bar} style={{ width: `${(votes[s.key] / total) * 100}%` }} />
              ) : null,
            )
          : null}
      </span>
      <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-0.5">
            <Icon name={s.icon} size={12} />
            {votes[s.key]}
          </span>
        ))}
      </span>
    </div>
  );
}
