// @a11y-strict
// client/src/components/layout/ThemeToggle.tsx — header theme shortcut (light → dark → system)
// Session 49 · Build 5 · wave 5-1 (F9: writes through PUT /api/me/settings via
// usePersistedTheme; Settings is the full control). The accessible name says
// what the next press does, so tests find it by test id (ui_test_strategy §2).

import type { Theme } from '../../../../shared/contracts';
import { usePersistedTheme } from '../../lib/settings/ThemeSync';
import { ShellGlyph } from './ShellIcons';

const CYCLE: readonly Theme[] = ['light', 'dark', 'system'];

export function nextTheme(current: Theme): Theme {
  return CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
}

export function ThemeToggle() {
  const { theme, setTheme } = usePersistedTheme();
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      data-testid="shell-theme-toggle"
      data-theme-current={theme}
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ShellGlyph name={theme === 'dark' ? 'moon' : theme === 'system' ? 'monitor' : 'sun'} />
    </button>
  );
}
