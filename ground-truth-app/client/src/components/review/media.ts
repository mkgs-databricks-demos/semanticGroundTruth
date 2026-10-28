// @a11y-strict
// client/src/components/review/media.ts — media-query helpers for the review screen
// Session 51 · Build 5 · wave 5-2

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** OS-level reduced motion (wins over UserSettings.motion 'full', ui_test_strategy §7.4). */
export function prefersReducedMotion(): boolean {
  return matches('(prefers-reduced-motion: reduce)');
}

/** Sheets open from the right on md+ screens and from the bottom on phones (brief S1). */
export function sheetSide(): 'right' | 'bottom' {
  return matches('(min-width: 768px)') ? 'right' : 'bottom';
}

/** Shared look of the native filter selects (44 px target, token colors only). */
export const FILTER_SELECT_CLASS =
  'h-11 min-w-44 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-2 focus-visible:outline-ring';
