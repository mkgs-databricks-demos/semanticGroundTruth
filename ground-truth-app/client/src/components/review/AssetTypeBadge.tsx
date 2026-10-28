// @a11y-strict
// client/src/components/review/AssetTypeBadge.tsx — asset type badge on the review card
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · Databricks icon + label (brief S1), test id review-card-type-badge

import type { AssetType } from '../../../../shared/contracts';
import { Badge, Icon } from '../ui';
import type { IconName } from '../ui';

/** Visible labels, shared with the asset-type filter. */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  measure: 'Measure',
  dimension: 'Dimension',
  page: 'Page',
  domain: 'Domain',
  subdomain: 'Subdomain',
};

const TYPE_ICONS: Record<AssetType, IconName> = {
  measure: 'measure',
  dimension: 'tag',
  page: 'dashboard',
  domain: 'checklist',
  subdomain: 'checklist',
};

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <Badge tone="outline" data-testid="review-card-type-badge" className="gap-1">
      <Icon name={TYPE_ICONS[type]} size={14} />
      {ASSET_TYPE_LABELS[type]}
    </Badge>
  );
}
