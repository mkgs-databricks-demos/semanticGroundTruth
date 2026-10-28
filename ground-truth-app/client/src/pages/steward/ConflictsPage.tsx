// @a11y-strict
// client/src/pages/steward/ConflictsPage.tsx — S9 Conflicts `/steward/conflicts`
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 55 · Build 5 · wave 5-3: the screen (screen_inventory.md S9, brief S9).
//
// Two panes on lg+ (list | detail), one column with a back link below.
// Nothing is selected until the steward picks a group (click, J/K, or
// `?assetId=` from the queue's Resolve link), so the page loads the current
// asset values only for the group being compared.
// Resolve: POST /api/steward/conflicts/:assetId/resolve. While it runs the
// bar is disabled; on success the group leaves the list at once, the next
// group is selected (focus on the list) and a toast names the notified edit
// authors. 409 / 404 is "stale" (another steward resolved it): alert +
// Refresh. KB K2: J/K group, 1-9 proposal, Enter / A accept, C keep current,
// X reject all (confirm, focus on Cancel), N note, Esc back to list (mobile).

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import type { ConflictGroup, ResolveConflictRequest } from '../../../../shared/contracts';
import { RoleGate } from '../../components/access/RoleGate';
import { ConflictDetail } from '../../components/steward-triage/ConflictDetail';
import { ConflictList } from '../../components/steward-triage/ConflictList';
import {
  authorsToNotify,
  CONFLICT_STALE_TITLE,
  CONFLICTS_EMPTY_TITLE,
  CONFLICTS_SUBTITLE,
  CONFLICTS_TITLE,
  groupProposals,
  joinNames,
} from '../../components/steward-triage/labels';
import { TriageConfirmDialog } from '../../components/steward-triage/TriageConfirmDialog';
import {
  errorMessage,
  isOfflineError,
  isStaleError,
  TriageOfflineAlert,
} from '../../components/steward-triage/TriageStates';
import { useTriageShortcuts } from '../../components/steward-triage/useTriageShortcuts';
import { EmptyPanel, InlineAlert, SkeletonGroup, ToastRegion, useToasts } from '../../components/ui';
import { useConflicts, useMe, useResolveConflict } from '../../lib/api';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export { CONFLICTS_TITLE };
export const STEWARD_FORBIDDEN_TITLE = 'Steward access required';
export const STEWARD_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-stewards.';

const RESOLUTION_TEXT: Record<ResolveConflictRequest['resolution'], string> = {
  accept_edit: 'Edit accepted.',
  keep_current: 'Current value kept.',
  reject_all: 'All proposals rejected.',
};

export function ConflictsPage() {
  return (
    <RoleGate
      page="steward"
      role="steward"
      title={CONFLICTS_TITLE}
      forbiddenTitle={STEWARD_FORBIDDEN_TITLE}
      forbiddenDescription={STEWARD_FORBIDDEN_TEXT}
    >
      <Conflicts />
    </RoleGate>
  );
}

const isDesktop = () => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;

function Conflicts() {
  const online = useOnlineStatus();
  const me = useMe();
  const conflicts = useConflicts();
  const resolve = useResolveConflict();
  const { toasts, push, dismiss } = useToasts();
  const [searchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('assetId'));
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Resolved groups, hidden until a list fetched after the resolve arrives. */
  const [hidden, setHidden] = useState<ReadonlyMap<string, number>>(new Map());
  const listRef = useRef<HTMLUListElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const groups: ConflictGroup[] = (conflicts.data ?? []).filter(
    (g) => !((hidden.get(g.assetId) ?? -1) >= conflicts.dataUpdatedAt),
  );
  const selected = groups.find((g) => g.assetId === selectedId) ?? null;
  const proposals = selected ? groupProposals(selected.edits) : [];
  const resolving = resolve.isPending;
  const writesDisabled = !online || resolving;

  // A new group starts with no proposal picked and an empty note.
  useEffect(() => {
    setChoice(null);
    setNote('');
    resolve.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per group only
  }, [selectedId]);

  const select = (assetId: string | null) => setSelectedId(assetId);

  const move = (delta: 1 | -1) => {
    if (groups.length === 0) return;
    const index = groups.findIndex((g) => g.assetId === selectedId);
    const next = index === -1 ? (delta === 1 ? 0 : groups.length - 1) : Math.min(groups.length - 1, Math.max(0, index + delta));
    select(groups[next].assetId);
  };

  const send = (body: ResolveConflictRequest) => {
    if (!selected || writesDisabled) return;
    const group = selected;
    const trimmed = note.trim();
    const request: ResolveConflictRequest = trimmed ? { ...body, note: trimmed } : body;
    resolve.mutate(
      { assetId: group.assetId, body: request },
      {
        onSuccess: () => {
          const index = groups.findIndex((g) => g.assetId === group.assetId);
          const rest = groups.filter((g) => g.assetId !== group.assetId);
          setHidden((h) => new Map(h).set(group.assetId, Date.now()));
          select(rest.length ? rest[Math.min(index, rest.length - 1)].assetId : null);
          const authors = authorsToNotify(group, me.data?.userId);
          push({
            tone: 'success',
            title: 'Conflict resolved',
            description: `${RESOLUTION_TEXT[body.resolution]} ${
              authors.length ? `${joinNames(authors)} ${authors.length === 1 ? 'was' : 'were'} notified.` : 'No edit authors to notify.'
            }`,
          });
          listRef.current?.focus();
        },
      },
    );
  };

  const accept = () => {
    if (choice) send({ resolution: 'accept_edit', voteId: choice });
  };
  const keep = () => send({ resolution: 'keep_current' });
  const openRejectAll = () => {
    if (selected && !writesDisabled) setConfirmOpen(true);
  };

  const refresh = () => {
    resolve.reset();
    void conflicts.refetch();
  };

  const shortcuts: Record<string, (() => boolean | void) | undefined> = {
    j: () => move(1),
    k: () => move(-1),
    a: () => accept(),
    Enter: () => {
      if (!choice) return false;
      accept();
      return true;
    },
    c: () => keep(),
    x: () => openRejectAll(),
    n: () => {
      if (!selected) return false;
      noteRef.current?.focus();
      return true;
    },
    Escape: () => {
      if (!selected || isDesktop()) return false;
      select(null);
      listRef.current?.focus();
      return true;
    },
  };
  for (let n = 1; n <= 9; n++) {
    shortcuts[String(n)] = () => {
      const p = proposals[n - 1];
      if (!p || writesDisabled) return false;
      setChoice(p.voteId);
      return true;
    };
  }
  useTriageShortcuts(shortcuts);

  const offlineNoData =
    !conflicts.data && (conflicts.fetchStatus === 'paused' || (conflicts.isError && isOfflineError(conflicts.error)));

  let resolveAlert = null;
  if (resolve.isError && isStaleError(resolve.error)) {
    resolveAlert = (
      <InlineAlert variant="warning" title={CONFLICT_STALE_TITLE}>
        <p>Refresh to see the conflicts that are still open.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 min-h-[44px]"
          onClick={refresh}
          data-testid="steward-conflicts-stale-refresh"
        >
          Refresh
        </Button>
      </InlineAlert>
    );
  } else if (resolve.isError) {
    resolveAlert = (
      <InlineAlert title="Couldn't resolve the conflict">
        {isOfflineError(resolve.error)
          ? 'The connection dropped. Nothing was changed.'
          : errorMessage(resolve.error, 'The request failed. Try again in a moment.')}
      </InlineAlert>
    );
  }

  let body;
  if (offlineNoData) {
    body = null;
  } else if (conflicts.isPending) {
    body = <SkeletonGroup label="Loading conflicts" lines={6} />;
  } else if (conflicts.isError) {
    body = (
      <InlineAlert title="Couldn't load conflicts" onRetry={() => void conflicts.refetch()} retrying={conflicts.isFetching}>
        {conflicts.error.message || 'The request failed. Try again in a moment.'}
      </InlineAlert>
    );
  } else if (groups.length === 0) {
    body = (
      <div data-testid="steward-conflicts-empty-root">
        <EmptyPanel
          illustration="users"
          title={CONFLICTS_EMPTY_TITLE}
          description="Assets show up here when reviewers propose different edits, or edit and reject the same asset."
        />
      </div>
    );
  } else {
    body = (
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className={selected ? 'hidden lg:block' : undefined}>
          <ConflictList ref={listRef} groups={groups} selectedId={selected?.assetId ?? null} onSelect={select} onMove={move} />
        </div>
        <div className={selected ? undefined : 'hidden lg:block'}>
          {selected ? (
            <ConflictDetail
              ref={noteRef}
              group={selected}
              choice={choice}
              onChoose={setChoice}
              note={note}
              onNote={setNote}
              writesDisabled={!online}
              resolving={resolving}
              onAccept={accept}
              onKeep={keep}
              onRejectAll={openRejectAll}
              onBack={() => {
                select(null);
                listRef.current?.focus();
              }}
              alert={resolveAlert}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Select a conflict to compare the proposals with the current value.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" data-testid="steward-conflicts-root">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{CONFLICTS_TITLE}</h1>
        <p className="text-muted-foreground">{CONFLICTS_SUBTITLE}</p>
      </div>

      {!online ? (
        <TriageOfflineAlert>Resolving is disabled until the connection is back. Nothing is queued.</TriageOfflineAlert>
      ) : null}

      {body}

      <TriageConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reject all proposals?"
        description={`Every proposal for ${selected?.displayName ?? 'this asset'} is closed and the edit authors are notified. The current value stays unchanged.`}
        confirmLabel="Reject all"
        onConfirm={() => send({ resolution: 'reject_all' })}
      />
      <ToastRegion toasts={toasts} onDismiss={dismiss} label="Conflict updates" />
    </div>
  );
}

export default ConflictsPage;
