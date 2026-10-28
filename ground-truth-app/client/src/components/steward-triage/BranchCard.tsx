// @a11y-strict
// client/src/components/steward-triage/BranchCard.tsx — S10 one feedback branch
// Session 55 · Build 5 · wave 5-3 (inventory S10, brief S10)
//
// Branch name (DM Mono) + copy button (always), status badge (text + icon),
// asset count, created / completed / reviewed by. "Open on GitHub" when the
// server sent `htmlUrl` (session 44; opens in a new tab). Expand shows the
// changed files and the summary. A failed branch shows its summary as the
// failure reason. Status actions only where the server accepts them
// (proposed / in_review); the page owns the request and the reject confirm.

import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import type { FeedbackBranch, FeedbackBranchReviewStatus } from '../../../../shared/contracts';
import { formatRelativeTime } from '../../lib/time';
import { Icon, StatusBadge } from '../ui';
import { BRANCH_ACTION_LABELS, BRANCH_ACTIONS, BRANCH_STATUS_SPEC, countLabel, safeHttpUrl } from './labels';

/** Attribute on each card's focus target (J/K). */
export const BRANCH_FOCUS = 'data-branch-focus';

const ACTION_TEST_IDS: Record<FeedbackBranchReviewStatus, string> = {
  in_review: 'steward-branches-mark-in-review',
  merged: 'steward-branches-mark-merged',
  rejected: 'steward-branches-mark-rejected',
};

export function BranchStatusBadge({ status }: { status: FeedbackBranch['status'] }) {
  const spec = BRANCH_STATUS_SPEC[status];
  return <StatusBadge status={spec.status} label={spec.label} />;
}

function When({ iso, now }: { iso: string; now?: Date }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString('en-US')}>
      {formatRelativeTime(iso, now)}
    </time>
  );
}

export interface BranchCardProps {
  branch: FeedbackBranch;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onStatus: (status: FeedbackBranchReviewStatus) => void;
  /** A status change for this branch is in flight. */
  updating: boolean;
  writesDisabled: boolean;
  /** Error from the last status change of this branch. */
  error?: ReactNode;
  now?: Date;
}

export function BranchCard({ branch, expanded, onToggle, onCopy, onStatus, updating, writesDisabled, error, now }: BranchCardProps) {
  const id = useId();
  const url = safeHttpUrl(branch.htmlUrl);
  const actions = BRANCH_ACTIONS[branch.status] ?? [];
  const failed = branch.status === 'failed';

  return (
    <li
      data-testid="steward-branches-card"
      data-batch-id={branch.batchId}
      data-status={branch.status}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="branch" size={20} />
        <h2 id={`${id}-name`} className="min-w-0 text-base font-bold">
          <code data-testid="steward-branches-name" className="break-all font-mono">
            {branch.branchName}
          </code>
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={onCopy}
          aria-label={`Copy branch name ${branch.branchName}`}
          aria-keyshortcuts="Y"
          data-testid="steward-branches-copy"
        >
          <Icon name="copy" size={16} />
        </Button>
        <span data-testid="steward-branches-status" data-status={branch.status}>
          <BranchStatusBadge status={branch.status} />
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Assets</dt>
          <dd>{countLabel(branch.assetCount, 'asset')}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd>
            <When iso={branch.createdAt} now={now} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Completed</dt>
          <dd>{branch.completedAt ? <When iso={branch.completedAt} now={now} /> : 'Not yet'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reviewed by</dt>
          <dd className="break-all">{branch.reviewedBy ?? 'Nobody yet'}</dd>
        </div>
      </dl>

      {failed ? (
        <div data-testid="steward-branches-failure" className="flex items-start gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
          <Icon name="danger" size={16} className="mt-0.5 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <p className="font-bold text-destructive">The feedback pipeline could not open this branch</p>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {branch.summary ?? 'No failure reason was reported. Check the feedback job run.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="min-h-[44px] gap-1.5"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`${id}-files`}
          aria-keyshortcuts="J K Enter"
          data-testid="steward-branches-expand"
          {...{ [BRANCH_FOCUS]: '' }}
        >
          <Icon name={expanded ? 'arrowUp' : 'arrowDown'} size={14} />
          {expanded ? 'Hide files' : `Show files (${branch.files.length})`}{' '}
          <span className="sr-only">of {branch.branchName}</span>
        </Button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="steward-branches-open-git"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon name="external" size={14} />
            Open on GitHub{' '}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        {actions.map((status) => (
          <Button
            key={status}
            variant={status === 'rejected' ? 'destructive' : status === 'merged' ? 'default' : 'secondary'}
            className="min-h-[44px]"
            disabled={writesDisabled || updating}
            onClick={() => onStatus(status)}
            data-testid={ACTION_TEST_IDS[status]}
          >
            {BRANCH_ACTION_LABELS[status]}{' '}
            <span className="sr-only">{branch.branchName}</span>
          </Button>
        ))}
      </div>

      {updating ? (
        <p role="status" className="text-sm text-muted-foreground">
          Updating…
        </p>
      ) : null}
      {error}

      <div id={`${id}-files`} hidden={!expanded} className="flex flex-col gap-3 border-t border-border pt-3">
        {expanded ? (
          <>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">Changed files</h3>
              {branch.files.length ? (
                <ul className="flex flex-col gap-1" data-testid="steward-branches-files">
                  {branch.files.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 break-all font-mono text-xs">
                      <Icon name="fileCode" size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No files recorded.</p>
              )}
            </div>
            {!failed && branch.summary ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold">Summary</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{branch.summary}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
