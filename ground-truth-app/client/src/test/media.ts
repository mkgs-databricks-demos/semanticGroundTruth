// client/src/test/media.ts — matchMedia stub for OS preferences
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §7.3 theme `system`, §7.4 reduced motion)
//
//   stubMatchMedia({ prefersDark: true });            // (prefers-color-scheme: dark)
//   stubMatchMedia({ prefersReducedMotion: true });   // (prefers-reduced-motion: reduce)
//   stubMatchMedia({ queries: { '(min-width: 768px)': true } });
//
// setup.ts installs an always-false matchMedia; this replaces it for one test
// and puts it back afterwards.

import { afterEach } from 'vitest';

export const PREFERS_DARK = '(prefers-color-scheme: dark)';
export const PREFERS_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export interface MediaPreferences {
  prefersDark?: boolean;
  prefersReducedMotion?: boolean;
  /** Any other media query string -> matches. */
  queries?: Record<string, boolean>;
}

const baseline = window.matchMedia;

function normalize(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

/** Replace window.matchMedia so the listed queries match. Unlisted queries do not. */
export function stubMatchMedia(prefs: MediaPreferences): void {
  const table = new Map<string, boolean>();
  if (prefs.prefersDark !== undefined) table.set(PREFERS_DARK, prefs.prefersDark);
  if (prefs.prefersReducedMotion !== undefined) {
    table.set(PREFERS_REDUCED_MOTION, prefs.prefersReducedMotion);
  }
  for (const [q, v] of Object.entries(prefs.queries ?? {})) table.set(normalize(q), v);

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: table.get(normalize(query)) ?? false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/** Put back the matchMedia from setup.ts. */
export function resetMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: baseline });
}

afterEach(() => {
  resetMatchMedia();
});
