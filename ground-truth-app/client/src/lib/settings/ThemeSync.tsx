// @a11y-strict
// client/src/lib/settings/ThemeSync.tsx — theme follows the user's saved settings (F9)
// Session 49 · Build 5 · wave 5-1
//
// * <ThemeSync /> (mounted once, in the router root of App.tsx) seeds
//   next-themes from GET /api/me/settings `theme` the first time the settings
//   load, so the theme follows the user across devices. Later changes come
//   from the user (header toggle, Settings page), not from refetches.
// * usePersistedTheme() is the write path for those controls: it switches
//   next-themes at once (which also writes localStorage `sgt-theme`) and then
//   saves `{ theme }` through PUT /api/me/settings. A failed save keeps the
//   local theme; nothing is rolled back (the theme is a preference, not data).
//   Offline, the theme still changes locally and no request is sent (S7).

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { THEMES } from '../../../../shared/contracts';
import type { Theme } from '../../../../shared/contracts';
import { useMySettings, useUpdateMySettings } from '../api/hooks';

/** Same key as main.tsx's ThemeProvider. */
export const THEME_STORAGE_KEY = 'sgt-theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Seeds next-themes from the saved settings once. Renders nothing. */
export function ThemeSync() {
  const { data: settings } = useMySettings();
  const { theme, setTheme } = useTheme();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !settings) return;
    seeded.current = true;
    if (isTheme(settings.theme) && settings.theme !== theme) setTheme(settings.theme);
  }, [settings, theme, setTheme]);

  return null;
}

export interface PersistedTheme {
  /** Selected theme (`system` follows the OS). */
  theme: Theme;
  /** Theme actually applied (`light` | `dark`). */
  resolvedTheme: 'light' | 'dark';
  /** Apply now, then save to the user's settings. */
  setTheme: (next: Theme) => void;
  /** True while the PUT is in flight. */
  saving: boolean;
}

/** Read and change the theme; changes are written through PUT /api/me/settings. */
export function usePersistedTheme(): PersistedTheme {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const save = useUpdateMySettings();
  return {
    theme: isTheme(theme) ? theme : 'system',
    resolvedTheme: resolvedTheme === 'dark' ? 'dark' : 'light',
    setTheme: (next: Theme) => {
      setTheme(next);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      save.mutate({ theme: next });
    },
    saving: save.isPending,
  };
}
