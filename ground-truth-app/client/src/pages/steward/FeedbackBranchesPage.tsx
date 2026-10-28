// @a11y-strict
// client/src/pages/steward/FeedbackBranchesPage.tsx — S10 Feedback branches `/steward/feedback-branches`
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 55 · Build 5 · wave 5-3: the screen (screen_inventory.md S10, brief S10).
//
// States: loading, populated, empty, failed-branch (card shows the failure
// reason), updating (that card's actions disabled), error (+ Retry),
// forbidden (RoleGate), offline (status actions disabled; copy still works).
// Status change: POST /api/steward/feedback-branches/:batchId/status with
// UpdateFeedbackBranchStatusRequest; "Mark rejected" asks first (optional
// note). KB K4: J/K move between branches, Enter expands, Y copies the name.

import { useId, useRef, useState } from 'react';
import type { FeedbackBranch, FeedbackBranchReviewStatus, UpdateFeedbackBranchStatusRequest } from '../../../../shared/contracts';
import { RoleGate } from '../../components/access/RoleGate';
import { BRANCH_FOCUS, BranchCard } from '../../components/steward-triage/BranchCard';
import {
  BRANCH_COPIED,
  BRANCH_STATUS_SPEC,
  BRANCHES_EMPTY_TEXT,
  BRANCHES_EMPTY_TITLE,
  BRANCHES_SUBTITLE,
  BRANCHES_TITLE,
  NOTE_MAX,
} from '../../components/steward-triage/labels';
import { TriageConfirmDialog } from '../../components/steward-triage/TriageConfirmDialog';
import {
  errorMessage,
  isOfflineError,
  isStaleError,
  TriageOfflineAlert,
} from '../../components/steward-triage/TriageStates';
import { moveFocus, useTriageShortcuts } from '../../components/steward-triage/useTriageShortcuts';
import { EmptyPanel, InlineAlert, SkeletonGroup, ToastRegion, useToasts } from '../../components/ui';
import { useFeedbackBranches, useUpdateFeedbackBranchStatus } from '../../lib/api';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export { BRANCHES_TITLE };
export const STEWARD_FORBIDDEN_TITLE = 'Steward access required';
export const STEWARD_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-stewards.';

export function FeedbackBranchesPage() {
  return (
    <RoleGate
      page="steward"
      role="steward"
      title={BRANCHES_TITLE}
      forbiddenTitle={STEWARD_FORBIDDEN_TITLE}
      forbiddenDescription={STEWARD_FORBIDDEN_TEXT}
    >
      <FeedbackBranches />
    </RoleGate>
  );
}

function FeedbackBranches() {
  const online = useOnlineStatus();
  const branches = useFeedbackBranches();
  const update = useUpdateFeedbackBranchStatus();
  const { toasts, push, dismiss } = useToasts();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [rejecting, setRejecting] = useState<FeedbackBranch | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const noteId = useId();

  const toggle = (batchId: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });

  const copy = async (branch: FeedbackBranch) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(branch.branchName);
      push({ tone: 'success', title: BRANCH_COPIED, description: branch.branchName });
    } catch {
      push({ tone: 'error', title: "Couldn't copy the branch name", description: 'Select the name and copy it yourself.' });
    }
  };

  const send = (branch: FeedbackBranch, body: UpdateFeedbackBranchStatusRequest) => {
    if (!online) return;
    update.mutate(
      { batchId: branch.batchId, body },
      {
        onSuccess: (updated) => {
          push({
            tone: 'success',
            title: `Marked ${BRANCH_STATUS_SPEC[updated.status].label.toLowerCase()}`,
            description: updated.branchName,
          });
        },
      },
    );
  };

  const onStatus = (branch: FeedbackBranch, status: FeedbackBranchReviewStatus) => {
    if (status === 'rejected') {
      setRejectNote('');
      setRejecting(branch);
      return;
    }
    send(branch, { status });
  };

  const focusedBranch = (): FeedbackBranch | null => {
    const active = document.activeElement;
    const card = active instanceof HTMLElement ? active.closest<HTMLElement>('[data-testid="steward-branches-card"]') : null;
    const batchId = card?.dataset.batchId;
    return branches.data?.find((b) => b.batchId === batchId) ?? null;
  };

  useTriageShortcuts({
    j: () => {
      moveFocus(listRef.current, `[${BRANCH_FOCUS}]`, 1);
    },
    k: () => {
      moveFocus(listRef.current, `[${BRANCH_FOCUS}]`, -1);
    },
    y: () => {
      const branch = focusedBranch();
      if (!branch) return false;
      void copy(branch);
      return true;
    },
  });

  const pendingBatch = update.isPending ? update.variables?.batchId : undefined;
  const failedBatch = update.isError ? update.variables?.batchId : undefined;

  const updateError = (branch: FeedbackBranch) => {
    if (branch.batchId !== failedBatch) return undefined;
    const stale = isStaleError(update.error);
    return (
      <InlineAlert
        variant={stale ? 'warning' : 'error'}
        title={stale ? 'This branch changed since you loaded it' : "Couldn't change the status"}
        onRetry={
          stale
            ? () => {
                update.reset();
                void branches.refetch();
              }
            : undefined
        }
        retryLabel="Refresh"
      >
        {stale
          ? 'Refresh to see its current status.'
          : isOfflineError(update.error)
            ? 'The connection dropped. Nothing was changed.'
            : errorMessage(update.error, 'The request failed. Try again in a moment.')}
      </InlineAlert>
    );
  };

  const offlineNoData =
    !branches.data && (branches.fetchStatus === 'paused' || (branches.isError && isOfflineError(branches.error)));

  let body;
  if (offlineNoData) {
    body = null;
  } else if (branches.isPending) {
    body = <SkeletonGroup label="Loading feedback branches" lines={6} />;
  } else if (branches.isError) {
    body = (
      <InlineAlert title="Couldn't load feedback branches" onRetry={() => void branches.refetch()} retrying={branches.isFetching}>
        {branches.error.message || 'The request failed. Try again in a moment.'}
      </InlineAlert>
    );
  } else if (branches.data.length === 0) {
    body = (
      <div data-testid="steward-branches-empty-root">
        <EmptyPanel illustration="governance" title={BRANCHES_EMPTY_TITLE} description={BRANCHES_EMPTY_TEXT} />
      </div>
    );
  } else {
    body = (
      <ul ref={listRef} aria-label={BRANCHES_TITLE} className="flex flex-col gap-4">
        {branches.data.map((b) => (
          <BranchCard
            key={b.batchId}
            branch={b}
            expanded={expanded.has(b.batchId)}
            onToggle={() => toggle(b.batchId)}
            onCopy={() => void copy(b)}
            onStatus={(status) => onStatus(b, status)}
            updating={pendingBatch === b.batchId}
            writesDisabled={!online || update.isPending}
            error={updateError(b)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" data-testid="steward-branches-root">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{BRANCHES_TITLE}</h1>
        <p className="text-muted-foreground">{BRANCHES_SUBTITLE}</p>
      </div>

      {!online ? (
        <TriageOfflineAlert>Status changes are disabled until the connection is back. Copying branch names still works.</TriageOfflineAlert>
      ) : null}

      {body}

      <TriageConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={`Reject ${rejecting?.branchName ?? 'this branch'}?`}
        description="The branch is recorded as rejected. Close or delete it in Git yourself."
        confirmLabel="Mark rejected"
        onConfirm={() => {
          if (!rejecting) return;
          const note = rejectNote.trim();
          send(rejecting, note ? { status: 'rejected', note } : { status: 'rejected' });
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-sm font-medium">
            Note (optional)
          </label>
          <textarea
            id={noteId}
            data-testid="steward-branches-reject-note"
            maxLength={NOTE_MAX}
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>
      </TriageConfirmDialog>
      <ToastRegion toasts={toasts} onDismiss={dismiss} label="Branch updates" />
    </div>
  );
}

export default FeedbackBranchesPage;
