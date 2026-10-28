// @a11y-strict
// client/src/components/layout/StewardSubNav.tsx — steward sections on every /steward* route
// Session 49 · Build 5 · wave 5-1 (screen_inventory.md §2: Console, Feedback
// queue, Conflicts, Feedback branches; the three new screens are deep-linkable)
//
// Count badges come from the three list endpoints (useStewardBadgeCounts):
// pending queue total, conflict groups, branches waiting for review
// (`proposed`). A count that is loading, failed or zero shows no badge. The
// number is also in the link's accessible name ("Conflicts, 2 waiting").

import { Badge } from '../ui/Badge';
import type { IconName } from '../ui/Icon';
import { useStewardBadgeCounts } from '../../lib/api/hooks';
import type { StewardBadgeCounts } from '../../lib/api/hooks';
import { NavItem } from './NavItem';

interface SubNavEntry {
  to: string;
  label: string;
  icon: IconName;
  count?: keyof StewardBadgeCounts;
  end?: boolean;
}

export const STEWARD_SECTIONS: readonly SubNavEntry[] = [
  { to: '/steward', label: 'Console', icon: 'shield', end: true },
  { to: '/steward/feedback-queue', label: 'Feedback queue', icon: 'checklist', count: 'feedbackQueue' },
  { to: '/steward/conflicts', label: 'Conflicts', icon: 'fork', count: 'conflicts' },
  { to: '/steward/feedback-branches', label: 'Feedback branches', icon: 'branch', count: 'feedbackBranches' },
];

function CountBadge({ value, section }: { value: number | null | undefined; section: string }) {
  if (!value) return null;
  return (
    <>
      <Badge tone="default" aria-hidden="true" data-testid="shell-subnav-count" data-section={section}>
        {value > 99 ? '99+' : value}
      </Badge>
      <span className="sr-only">{`, ${value} waiting`}</span>
    </>
  );
}

export function StewardSubNav() {
  const counts = useStewardBadgeCounts(true);
  return (
    <nav aria-label="Steward sections" className="border-b border-border bg-background" data-testid="shell-subnav-root">
      <ul className="mx-auto flex h-11 max-w-screen-2xl items-stretch gap-5 overflow-x-auto px-4 md:px-6">
        {STEWARD_SECTIONS.map((s) => (
          <li key={s.to} className="flex shrink-0">
            <NavItem
              to={s.to}
              label={s.label}
              icon={s.icon}
              end={s.end}
              trailing={s.count ? <CountBadge value={counts[s.count]} section={s.count} /> : null}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
