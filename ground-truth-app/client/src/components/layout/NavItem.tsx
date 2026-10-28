// @a11y-strict
// client/src/components/layout/NavItem.tsx — the one navigation item (desktop, drawer, bottom nav)
// Session 49 · Build 5 · wave 5-1 (F6: Databricks icons; F7: same item
// everywhere, underline active state, never a filled pill)
//
// NavLink sets aria-current="page" on the active item; the underline is the
// visual cue (2 px brand accent) and the weight change is the non-color one.

import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { cn } from '../../lib/utils';

export type NavItemVariant = 'desktop' | 'drawer' | 'bottom';

export interface NavItemProps {
  to: string;
  label: string;
  icon: IconName;
  variant?: NavItemVariant;
  /** Match only the exact path ("/" and "/steward" console). */
  end?: boolean;
  onNavigate?: () => void;
  /** Extra content after the label (sub-nav count badge). */
  trailing?: ReactNode;
  'data-testid'?: string;
}

const BASE =
  'group inline-flex items-center gap-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const VARIANT: Record<NavItemVariant, { link: string; active: string; idle: string; iconSize: number }> = {
  desktop: {
    link: 'h-full border-b-2 px-1 font-medium',
    active: 'border-brand-accent text-foreground font-bold',
    idle: 'border-transparent text-muted-foreground hover:text-foreground',
    iconSize: 16,
  },
  drawer: {
    link: 'min-h-11 w-full rounded-md px-3 font-medium',
    active: 'text-foreground font-bold underline decoration-brand-accent decoration-2 underline-offset-8',
    idle: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    iconSize: 18,
  },
  bottom: {
    link: 'min-h-11 flex-1 flex-col justify-center gap-0.5 border-t-2 px-2 text-xs font-medium',
    active: 'border-brand-accent text-foreground font-bold',
    idle: 'border-transparent text-muted-foreground',
    iconSize: 20,
  },
};

export function NavItem({
  to,
  label,
  icon,
  variant = 'desktop',
  end,
  onNavigate,
  trailing,
  'data-testid': testId,
}: NavItemProps) {
  const spec = VARIANT[variant];
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      data-testid={testId}
      className={({ isActive }) => cn(BASE, spec.link, isActive ? spec.active : spec.idle)}
    >
      <Icon name={icon} size={spec.iconSize} />
      <span>{label}</span>
      {trailing}
    </NavLink>
  );
}
