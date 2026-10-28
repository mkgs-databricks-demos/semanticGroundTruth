// client/src/components/ui/StatusBadge.tsx — status = text + icon, never color only
// Session 42 · Build 5 · wave 5-0 (ui_brand_plan §7, screen_inventory findings).

import { Badge, type BadgeTone } from './Badge';
import { Icon, type IconName } from './Icon';

export type Status =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'conflict'
  | 'open'
  | 'merged'
  | 'warning'
  | 'error';

export const STATUS_SPEC: Record<Status, { label: string; icon: IconName; tone: BadgeTone }> = {
  pending: { label: 'Pending', icon: 'history', tone: 'outline' },
  approved: { label: 'Approved', icon: 'check', tone: 'success' },
  rejected: { label: 'Rejected', icon: 'close', tone: 'danger' },
  edited: { label: 'Edited', icon: 'pencil', tone: 'info' },
  conflict: { label: 'Conflict', icon: 'fork', tone: 'warning' },
  open: { label: 'Open', icon: 'branch', tone: 'info' },
  merged: { label: 'Merged', icon: 'commit', tone: 'success' },
  warning: { label: 'Warning', icon: 'warning', tone: 'warning' },
  error: { label: 'Error', icon: 'danger', tone: 'danger' },
};

export interface StatusBadgeProps {
  status: Status;
  /** Overrides the default visible label; the text is always rendered. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const spec = STATUS_SPEC[status];
  return (
    <Badge tone={spec.tone} data-status={status} className={className}>
      <Icon name={spec.icon} size={12} />
      <span>{label ?? spec.label}</span>
    </Badge>
  );
}
