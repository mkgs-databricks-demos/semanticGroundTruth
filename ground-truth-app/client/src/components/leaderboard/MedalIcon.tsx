// @a11y-strict
// client/src/components/leaderboard/MedalIcon.tsx — rank 1-3 medal (S2)
// Session 53 · Build 5 · wave 5-2. The Databricks icon set has no trophy or
// medal glyph, so this ports the Figma export's inline trophy path
// (figma/_code/src/pages/LeaderboardPage.tsx `icons.trophy`), drawn in
// currentColor. Decorative: the rank cell carries the accessible name.

import { cn } from '../../lib/utils';

/** Accessible name per podium rank (figma_make_brief S2: "1st place" etc.). */
export const MEDAL_LABELS: Readonly<Record<1 | 2 | 3, string>> = {
  1: '1st place',
  2: '2nd place',
  3: '3rd place',
};

/** Token text color per podium rank (no hex: tokens only). */
const MEDAL_TONE: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'text-warning-text',
  2: 'text-muted-foreground',
  3: 'text-primary',
};

export function isPodium(rank: number): rank is 1 | 2 | 3 {
  return rank === 1 || rank === 2 || rank === 3;
}

export function MedalIcon({ rank, size = 20, className }: { rank: 1 | 2 | 3; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-medal={rank}
      className={cn('shrink-0', MEDAL_TONE[rank], className)}
    >
      <path d="M5 3h6v3a3 3 0 0 1-6 0V3Zm3 6v3M5 14h6M5 4H2v1a3 3 0 0 0 3 3M11 4h3v1a3 3 0 0 1-3 3" />
    </svg>
  );
}
