// @a11y-strict
// client/src/components/review/AssetTypeFilter.tsx — asset-type filter in the review toolbar
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · native <select> with a visible label (export), test id review-filters-asset-type

import { ASSET_TYPES } from '../../../../shared/contracts';
import type { AssetType } from '../../../../shared/contracts';
import { ASSET_TYPE_LABELS } from './AssetTypeBadge';
import { FILTER_SELECT_CLASS } from './media';

interface AssetTypeFilterProps {
  value: AssetType | undefined;
  /** `undefined` = all types. */
  onChange: (value: AssetType | undefined) => void;
}

export function AssetTypeFilter({ value, onChange }: AssetTypeFilterProps) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      Asset type
      <select
        data-testid="review-filters-asset-type"
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as AssetType | undefined)}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">All types</option>
        {ASSET_TYPES.map((t) => (
          <option key={t} value={t}>
            {ASSET_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
    </label>
  );
}
