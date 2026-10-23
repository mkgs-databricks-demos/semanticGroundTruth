// client/src/components/layout/NavLinks.tsx — role-filtered navigation links
// Session 16 · Wave 0 · Active link = 2 px brand-accent underline + medium weight

import { NavLink } from 'react-router';
import {
  ClipboardCheck,
  Trophy,
  Shield,
  BarChart3,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { useMe } from '../../lib/api/hooks';
import { hasRole } from '../../lib/api/roles';

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 text-sm transition-colors ${
    isActive
      ? 'font-medium text-foreground border-b-2 border-brand-accent'
      : 'font-normal text-muted-foreground hover:text-foreground'
  }`;

const bottomLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${
    isActive
      ? 'text-foreground border-t-2 border-brand-accent'
      : 'text-muted-foreground'
  }`;

interface NavLinksProps {
  className?: string;
  linkClass?: (props: { isActive: boolean }) => string;
  onClick?: () => void;
  variant?: 'default' | 'bottom';
}

export function NavLinks({
  className,
  linkClass,
  onClick,
  variant = 'default',
}: NavLinksProps) {
  const { data: me } = useMe();
  const isSteward = hasRole(me, 'steward');
  const isAdmin = hasRole(me, 'admin');

  const cls = linkClass ?? (variant === 'bottom' ? bottomLinkClass : desktopLinkClass);
  const iconSize = variant === 'bottom' ? 'h-5 w-5' : 'h-4 w-4 mr-1.5 inline-block';

  return (
    <nav className={className} aria-label="Main navigation">
      <NavLink to="/" end className={cls} onClick={onClick}>
        {variant === 'bottom' && <ClipboardCheck className={iconSize} />}
        Review
      </NavLink>
      <NavLink to="/leaderboard" className={cls} onClick={onClick}>
        {variant === 'bottom' && <Trophy className={iconSize} />}
        Leaderboard
      </NavLink>
      {isSteward && (
        <NavLink to="/steward" className={cls} onClick={onClick}>
          {variant === 'bottom' && <Shield className={iconSize} />}
          Steward
        </NavLink>
      )}
      {isSteward && (
        <NavLink to="/executive" className={cls} onClick={onClick}>
          {variant === 'bottom' && <BarChart3 className={iconSize} />}
          Executive
        </NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={cls} onClick={onClick}>
          {variant === 'bottom' && <Settings className={iconSize} />}
          Admin
        </NavLink>
      )}
      <NavLink to="/assistant" className={cls} onClick={onClick}>
        {variant === 'bottom' && <MessageSquare className={iconSize} />}
        Assistant
      </NavLink>
    </nav>
  );
}
