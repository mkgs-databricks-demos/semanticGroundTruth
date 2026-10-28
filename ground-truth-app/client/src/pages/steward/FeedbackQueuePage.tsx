// @a11y-strict
// client/src/pages/steward/FeedbackQueuePage.tsx — S8 Feedback queue `/steward/feedback-queue`
// Session 49 · Build 5 · wave 5-1: route + lazy chunk + final export name.
// Session 55 · Build 5 · wave 5-3: the screen (screen_inventory.md S8, brief S8).
//
// States: loading, populated, empty (+ "View campaigns"), filtered-empty
// (+ Clear filters), error (+ Retry), forbidden (RoleGate), offline (read-only
// page: the alert explains; what is loaded stays). KB K3: "/" search, J/K row
// focus, Enter opens the detail sheet (Escape returns focus to the row),
// C opens Conflicts for a row with >= 2 pending edits.

import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import type { FeedbackQueueQuery } from '../../../../shared/contracts';
import { RoleGate } from '../../components/access/RoleGate';
import { AssetDetailSheet } from '../../components/steward/AssetDetailSheet';
import {
  DEFAULT_QUEUE_FILTERS,
  FeedbackQueueFilters,
  filtersActive,
} from '../../components/steward-triage/FeedbackQueueFilters';
import type { QueueFilters } from '../../components/steward-triage/FeedbackQueueFilters';
import { FeedbackQueueTable, QUEUE_ROW_FOCUS, QueuePager } from '../../components/steward-triage/FeedbackQueueTable';
import {
  canResolve,
  conflictsHref,
  QUEUE_EMPTY_TITLE,
  QUEUE_FILTERED_EMPTY_TITLE,
  QUEUE_SUBTITLE,
  QUEUE_TITLE,
} from '../../components/steward-triage/labels';
import { TriageOfflineAlert, isOfflineError } from '../../components/steward-triage/TriageStates';
import { moveFocus, useTriageShortcuts } from '../../components/steward-triage/useTriageShortcuts';
import { EmptyPanel, InlineAlert, SkeletonGroup } from '../../components/ui';
import { useCampaigns, useFeedbackQueue } from '../../lib/api';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export { QUEUE_TITLE };
export const STEWARD_FORBIDDEN_TITLE = 'Steward access required';
export const STEWARD_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-stewards.';

/** Rows per page. */
export const QUEUE_PAGE_SIZE = 25;

export function FeedbackQueuePage() {
  return (
    <RoleGate
      page="steward"
      role="steward"
      title={QUEUE_TITLE}
      forbiddenTitle={STEWARD_FORBIDDEN_TITLE}
      forbiddenDescription={STEWARD_FORBIDDEN_TEXT}
    >
      <FeedbackQueue />
    </RoleGate>
  );
}

function FeedbackQueue() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_QUEUE_FILTERS);
  const [offset, setOffset] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  /** The row button that opened the sheet (the sheet has no Radix trigger, so focus is returned by hand). */
  const openerRef = useRef<HTMLElement | null>(null);

  const openDetail = (assetId: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetailId(assetId);
  };
  const closeDetail = () => {
    setDetailId(null);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener) window.setTimeout(() => opener.focus(), 0);
  };

  const params: Partial<FeedbackQueueQuery> = {
    status: filters.status,
    limit: QUEUE_PAGE_SIZE,
    offset,
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.assetType ? { assetType: filters.assetType } : {}),
  };
  const queue = useFeedbackQueue(params);
  const campaigns = useCampaigns();

  const term = filters.search.trim().toLowerCase();
  const rows = useMemo(
    () => (queue.data?.items ?? []).filter((i) => term === '' || i.displayName.toLowerCase().includes(term)),
    [queue.data, term],
  );

  const changeFilters = (next: Partial<QueueFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    // Search filters the loaded page; the others change the request.
    if (Object.keys(next).some((k) => k !== 'search')) setOffset(0);
  };
  const clearFilters = () => {
    setFilters(DEFAULT_QUEUE_FILTERS);
    setOffset(0);
  };

  const focusedRow = (): HTMLElement | null => {
    const active = document.activeElement;
    return active instanceof HTMLElement && tableRef.current?.contains(active)
      ? active.closest<HTMLElement>('[data-testid="steward-queue-row"]')
      : null;
  };

  useTriageShortcuts({
    '/': () => {
      searchRef.current?.focus();
    },
    j: () => {
      moveFocus(tableRef.current, `[${QUEUE_ROW_FOCUS}]`, 1);
    },
    k: () => {
      moveFocus(tableRef.current, `[${QUEUE_ROW_FOCUS}]`, -1);
    },
    c: () => {
      const row = focusedRow();
      const assetId = row?.dataset.assetId;
      const pendingEdits = Number(row?.dataset.pendingEdits ?? 0);
      if (!assetId || !canResolve({ pendingEdits })) return false;
      void navigate(conflictsHref(assetId));
      return true;
    },
  });

  const offlineNoData = !queue.data && (queue.fetchStatus === 'paused' || (queue.isError && isOfflineError(queue.error)));

  let body;
  if (offlineNoData) {
    body = null;
  } else if (queue.isPending) {
    body = <SkeletonGroup label="Loading feedback queue" lines={6} />;
  } else if (queue.isError) {
    body = (
      <InlineAlert
        title="Couldn't load the feedback queue"
        onRetry={() => void queue.refetch()}
        retrying={queue.isFetching}
      >
        {queue.error.message || 'The request failed. Try again in a moment.'}
      </InlineAlert>
    );
  } else if (rows.length === 0 && !filtersActive(filters) && offset === 0) {
    body = (
      <div data-testid="steward-queue-empty-root">
        <EmptyPanel
          illustration="data-quality-3"
          title={QUEUE_EMPTY_TITLE}
          description="New votes, edits and skips show up here as reviewers work through campaigns."
          action={
            <Link
              to="/steward"
              className="inline-flex min-h-[44px] items-center font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              View campaigns
            </Link>
          }
        />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div data-testid="steward-queue-filtered-empty-root">
        <EmptyPanel
          illustration="data-quality-3"
          title={QUEUE_FILTERED_EMPTY_TITLE}
          description="Try another campaign, asset type or search term."
          action={
            <Button variant="outline" className="min-h-[44px]" onClick={clearFilters} data-testid="steward-queue-clear-filters">
              Clear filters
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <>
        <FeedbackQueueTable ref={tableRef} items={rows} onOpen={openDetail} />
        <QueuePager offset={offset} limit={QUEUE_PAGE_SIZE} total={queue.data.total} onOffset={setOffset} />
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" data-testid="steward-queue-root">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{QUEUE_TITLE}</h1>
        <p className="text-muted-foreground">{QUEUE_SUBTITLE}</p>
      </div>

      {!online ? (
        <TriageOfflineAlert>The queue shows what was loaded last and refreshes when the connection is back.</TriageOfflineAlert>
      ) : null}

      <FeedbackQueueFilters ref={searchRef} value={filters} onChange={changeFilters} campaigns={campaigns.data ?? []} />

      {body}

      <AssetDetailSheet
        assetId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      />
    </div>
  );
}

export default FeedbackQueuePage;
