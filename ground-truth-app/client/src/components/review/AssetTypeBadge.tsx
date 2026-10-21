// client/src/components/review/AssetTypeBadge.tsx
// Session 12 · Wave 4

import { Badge } from '@databricks/appkit-ui/react';
import type { AssetType } from '../../../../shared/contracts';

const VARIANT_MAP: Record<AssetType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  measure: 'default',
  dimension: 'secondary',
  page: 'outline',
  domain: 'outline',
  subdomain: 'outline',
};

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <Badge variant={VARIANT_MAP[type] ?? 'outline'} className="capitalize">
      {type}
    </Badge>
  );
}
