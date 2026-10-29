// @a11y-strict
// client/src/components/leaderboard/PeriodTabs.tsx — leaderboard period tablist (S2)
// Session 53 · Build 5 · wave 5-2. WAI-ARIA tabs with automatic activation:
// one tab in the Tab order (roving tabindex); ArrowLeft / ArrowRight wrap,
// Home / End jump; moving selects the period (screen_inventory S2 keyboard,
// ui_test_strategy §8 S2 "tabs"). Underline active state, no filled pill
// (ui_brand_plan §6).

import { useRef, type KeyboardEvent } from 'react';
import type { LeaderboardQuery } from '../../../../shared/contracts';
import { cn } from '../../lib/utils';

export type LeaderboardPeriod = LeaderboardQuery['period'];

export interface PeriodSpec {
  value: LeaderboardPeriod;
  label: string;
  /** Used in the table caption: "Top reviewers, last 7 days". */
  caption: string;
}

export const PERIODS: readonly PeriodSpec[] = [
  { value: '7d', label: '7 days', caption: 'last 7 days' },
  { value: '30d', label: '30 days', caption: 'last 30 days' },
  { value: 'all', label: 'All time', caption: 'all time' },
];

export function periodSpec(value: LeaderboardPeriod): PeriodSpec {
  return PERIODS.find((p) => p.value === value) ?? PERIODS[0];
}

export function periodTabId(idPrefix: string, value: LeaderboardPeriod): string {
  return `${idPrefix}-tab-${value}`;
}

export interface PeriodTabsProps {
  value: LeaderboardPeriod;
  onChange: (value: LeaderboardPeriod) => void;
  /** Unique id prefix (useId) for tab ids. */
  idPrefix: string;
  /** id of the tabpanel the tabs control. */
  panelId: string;
}

export function PeriodTabs({ value, onChange, idPrefix, panelId }: PeriodTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, PERIODS.findIndex((p) => p.value === value));

  const select = (next: number) => {
    onChange(PERIODS[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = PERIODS.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Leaderboard period"
      data-testid="leaderboard-period-tabs"
      className="inline-flex gap-1 border-b border-border"
    >
      {PERIODS.map((p, i) => {
        const selected = i === index;
        return (
          <button
            key={p.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={periodTabId(idPrefix, p.value)}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            data-period={p.value}
            onClick={() => select(i)}
            onKeyDown={onKeyDown}
            className={cn(
              '-mb-px min-h-[44px] border-b-2 px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
