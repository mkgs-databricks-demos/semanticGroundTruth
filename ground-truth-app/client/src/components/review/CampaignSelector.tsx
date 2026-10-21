// client/src/components/review/CampaignSelector.tsx
// Session 12 · Wave 4

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@databricks/appkit-ui/react';
import { useCampaigns } from '../../lib/api/hooks';

interface CampaignSelectorProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function CampaignSelector({ value, onChange }: CampaignSelectorProps) {
  const { data: campaigns } = useCampaigns({ status: 'active' });

  return (
    <Select
      value={value ?? '__all__'}
      onValueChange={(v) => onChange(v === '__all__' ? undefined : v)}
    >
      <SelectTrigger className="w-48" aria-label="Filter by campaign">
        <SelectValue placeholder="All campaigns" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All campaigns</SelectItem>
        {campaigns?.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
