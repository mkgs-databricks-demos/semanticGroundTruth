// @a11y-strict
// client/src/components/layout/NavLinks.tsx — role-filtered navigation links
// Session 16 · Wave 0 · Active link = 2 px brand-accent underline + medium weight
// Session 49 · Build 5 · wave 5-1: one NavItem for every variant, Databricks
// icons (F6, F7), role-gated items are skeletons until GET /api/me resolves.

import type { Role } from '../../../../shared/contracts';
import { useMe } from '../../lib/api/hooks';
import { hasRole } from '../../lib/api/roles';
import { cn } from '../../lib/utils';
import type { IconName } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { NavItem } from './NavItem';
import type { NavItemVariant } from './NavItem';

export interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  /** Route slug for the test id (`shell-nav-link-<slug>`). */
  slug: string;
  /** Minimum app role; every authenticated user is a reviewer. */
  role: Role;
  end?: boolean;
}

/** Main navigation in display order (Figma ShellPage `nav`). */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { to: '/', label: 'Review', icon: 'checklist', slug: 'review', role: 'reviewer', end: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'ranking', slug: 'leaderboard', role: 'reviewer' },
  { to: '/assistant', label: 'Assistant', icon: 'sparkle', slug: 'assistant', role: 'reviewer' },
  { to: '/steward', label: 'Steward', icon: 'shield', slug: 'steward', role: 'steward' },
  { to: '/executive', label: 'Executive', icon: 'dashboard', slug: 'executive', role: 'steward' },
  { to: '/admin', label: 'Admin', icon: 'gear', slug: 'admin', role: 'admin' },
];

const GATED_COUNT = NAV_ENTRIES.filter((e) => e.role !== 'reviewer').length;

interface NavLinksProps {
  /** Accessible name of the <nav> landmark (unique per landmark on the page). */
  label: string;
  variant?: NavItemVariant;
  className?: string;
  /** Only the first N visible items (bottom nav). */
  limit?: number;
  onNavigate?: () => void;
}

export function NavLinks({ label, variant = 'desktop', className, limit, onNavigate }: NavLinksProps) {
  const { data: me, isPending } = useMe();
  const visible = NAV_ENTRIES.filter((e) => e.role === 'reviewer' || hasRole(me, e.role));
  const items = limit ? visible.slice(0, limit) : visible;
  // While GET /api/me is pending the role-gated items are unknown: show placeholders.
  const skeletons = isPending ? Math.max(0, (limit ?? Infinity) - items.length) : 0;

  return (
    <nav aria-label={label} className={className}>
      <ul className={cn('flex h-full', variant === 'drawer' ? 'flex-col gap-1' : 'items-stretch gap-5', variant === 'bottom' && 'w-full gap-0')}>
        {items.map((e) => (
          <li key={e.to} className="flex">
            <NavItem
              to={e.to}
              label={e.label}
              icon={e.icon}
              end={e.end}
              variant={variant}
              onNavigate={onNavigate}
              data-testid={variant === 'desktop' ? `shell-nav-link-${e.slug}` : undefined}
            />
          </li>
        ))}
        {Array.from({ length: Math.min(skeletons, GATED_COUNT) }, (_, i) => (
          <li key={`skeleton-${i}`} className="flex items-center" aria-hidden="true">
            <Skeleton data-testid="shell-nav-skeleton" className="h-7 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
