// client/src/components/review/AssetTypeFilter.tsx
// Session 12 · Wave 4

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@databricks/appkit-ui/react';
import { ASSET_TYPES } from '../../../../shared/contracts';
import type { AssetType } from '../../../../shared/contracts';

interface AssetTypeFilterProps {
  value: AssetType | undefined;
  onChange: (value: AssetType | undefined) => void;
}

export function AssetTypeFilter({ value, onChange }: AssetTypeFilterProps) {
  return (
    <Select
      value={value ?? '__all__'}
      onValueChange={(v) => onChange(v === '__all__' ? undefined : (v as AssetType))}
    >
      <SelectTrigger className="w-40" aria-label="Filter by asset type">
        <SelectValue placeholder="All types" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All types</SelectItem>
        {ASSET_TYPES.map((t) => (
          <SelectItem key={t} value={t} className="capitalize">
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
