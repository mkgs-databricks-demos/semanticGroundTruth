// @a11y-strict
// client/src/components/review/CampaignSelector.tsx — campaign filter in the review toolbar
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · native <select> with a visible label (export), test id review-filters-campaign

import type { Ref } from 'react';
import { useCampaigns } from '../../lib/api/hooks';
import { FILTER_SELECT_CLASS } from './media';

interface CampaignSelectorProps {
  value: string | undefined;
  /** `undefined` = all campaigns. */
  onChange: (value: string | undefined) => void;
  selectRef?: Ref<HTMLSelectElement>;
}

export function CampaignSelector({ value, onChange, selectRef }: CampaignSelectorProps) {
  const { data: campaigns } = useCampaigns({ status: 'active' });
  const options = campaigns ?? [];
  const unknownSelection = value !== undefined && !options.some((c) => c.id === value);

  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      Campaign
      <select
        ref={selectRef}
        data-testid="review-filters-campaign"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">All campaigns</option>
        {unknownSelection ? <option value={value}>Selected campaign</option> : null}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
