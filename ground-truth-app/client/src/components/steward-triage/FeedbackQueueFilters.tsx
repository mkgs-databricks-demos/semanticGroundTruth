// @a11y-strict
// client/src/components/steward-triage/FeedbackQueueFilters.tsx — S8 filter bar
// Session 55 · Build 5 · wave 5-3 (brief S8: campaign, asset type, status, search)
//
// Campaign, asset type and status go to GET /api/steward/feedback-queue;
// search has no query parameter in the contract, so it filters the loaded
// page by display name on the client.

import { forwardRef, useId } from 'react';
import type { AssetType, Campaign } from '../../../../shared/contracts';
import { ASSET_TYPES } from '../../../../shared/contracts';
import { ASSET_TYPE_LABELS } from '../review/AssetTypeBadge';
import { SegmentedControl } from '../settings/SegmentedControl';

export type QueueStatus = 'pending' | 'all';

export interface QueueFilters {
  campaignId: string;
  assetType: AssetType | '';
  status: QueueStatus;
  search: string;
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = { campaignId: '', assetType: '', status: 'pending', search: '' };

/** True when any filter differs from the default (decides empty vs filtered-empty). */
export function filtersActive(f: QueueFilters): boolean {
  return f.campaignId !== '' || f.assetType !== '' || f.status !== 'pending' || f.search.trim() !== '';
}

const STATUS_OPTIONS = [
  { value: 'pending' as const, label: 'Pending', testId: 'steward-queue-filter-status-pending' },
  { value: 'all' as const, label: 'All', testId: 'steward-queue-filter-status-all' },
];

const FIELD_CLASS =
  'min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export interface FeedbackQueueFiltersProps {
  value: QueueFilters;
  onChange: (next: Partial<QueueFilters>) => void;
  campaigns: readonly Campaign[];
}

export const FeedbackQueueFilters = forwardRef<HTMLInputElement, FeedbackQueueFiltersProps>(function FeedbackQueueFilters(
  { value, onChange, campaigns },
  searchRef,
) {
  const id = useId();
  return (
    <div role="search" aria-label="Filter the feedback queue" className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-48 flex-col gap-2">
        <label htmlFor={`${id}-campaign`} className="text-sm font-medium text-foreground">
          Campaign
        </label>
        <select
          id={`${id}-campaign`}
          data-testid="steward-queue-filter-campaign"
          className={FIELD_CLASS}
          value={value.campaignId}
          onChange={(e) => onChange({ campaignId: e.target.value })}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-40 flex-col gap-2">
        <label htmlFor={`${id}-type`} className="text-sm font-medium text-foreground">
          Asset type
        </label>
        <select
          id={`${id}-type`}
          data-testid="steward-queue-filter-asset-type"
          className={FIELD_CLASS}
          value={value.assetType}
          onChange={(e) => onChange({ assetType: e.target.value as AssetType | '' })}
        >
          <option value="">All types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ASSET_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div data-testid="steward-queue-filter-status">
        <SegmentedControl<QueueStatus>
          label="Status"
          options={STATUS_OPTIONS}
          value={value.status}
          onChange={(status) => onChange({ status })}
        />
      </div>
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <label htmlFor={`${id}-search`} className="text-sm font-medium text-foreground">
          Search assets
        </label>
        <input
          ref={searchRef}
          id={`${id}-search`}
          type="search"
          data-testid="steward-queue-search"
          className={FIELD_CLASS}
          value={value.search}
          placeholder="Asset name"
          aria-keyshortcuts="/"
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>
    </div>
  );
});
