// client/src/test/keyboard.ts — helpers for the K1-K6 keyboard-only flows
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §6)
//
// Keyboard flows use the keyboard only (no clicks) and assert focus with
// toHaveFocus(). All helpers take the `user` from userEvent.setup() (or
// renderWithProviders(...).user) so pointer and keyboard state are shared.
//
//   await pressKey(user, 'A');            // a printable key
//   await pressKey(user, 'Escape');       // a named key
//   await pressKey(user, 'Shift+S');      // a chord
//   await pressKeys(user, 'Shift+S', '2');
//   await tabUntil(user, 'Skip to content');
//   expectFocusVisible(screen.getByRole('button', { name: 'Approve' }));

import { getRoles, screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

/** Modifier names accepted in chords, as user-event key names. */
const MODIFIERS: Record<string, string> = {
  shift: 'Shift',
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  meta: 'Meta',
  cmd: 'Meta',
};

/** Arrow aliases so flows read like the strategy table (→ ← ↑ ↓). */
const ALIASES: Record<string, string> = {
  '\u2192': 'ArrowRight',
  '\u2190': 'ArrowLeft',
  '\u2191': 'ArrowUp',
  '\u2193': 'ArrowDown',
  Esc: 'Escape',
  Return: 'Enter',
  Space: ' ',
};

/** One key or chord ('A', 'Escape', 'Shift+S', 'Ctrl+s') as user-event keyboard syntax. */
export function toKeyboardSyntax(key: string): string {
  const named = (k: string): string => {
    const resolved = ALIASES[k] ?? k;
    if (resolved === '{') return '{{';
    if (resolved === '[') return '[[';
    if (resolved === ' ') return '[Space]';
    return resolved.length === 1 ? resolved : `{${resolved}}`;
  };
  // '+' alone is the plus key, not a chord separator.
  const parts = key.length > 1 ? key.split('+') : [key];
  if (parts.length === 1) return named(key);
  const mods = parts.slice(0, -1).map((m) => {
    const name = MODIFIERS[m.toLowerCase()];
    if (!name) throw new Error(`keyboard.ts: unknown modifier "${m}" in "${key}"`);
    return name;
  });
  const last = named(parts[parts.length - 1]);
  return `${mods.map((m) => `{${m}>}`).join('')}${last}${[...mods].reverse().map((m) => `{/${m}}`).join('')}`;
}

/** Press one key or chord. */
export async function pressKey(user: UserEvent, key: string): Promise<void> {
  await user.keyboard(toKeyboardSyntax(key));
}

/** Press several keys or chords in order. */
export async function pressKeys(user: UserEvent, ...keys: string[]): Promise<void> {
  for (const k of keys) await pressKey(user, k);
}

/** True if `el` has accessible name `name` (Testing Library's own name computation). */
function hasAccessibleName(el: Element, name: string | RegExp): boolean {
  for (const [role, elements] of Object.entries(getRoles(document.body))) {
    if (elements.includes(el as HTMLElement) && screen.queryAllByRole(role, { name }).includes(el as HTMLElement)) {
      return true;
    }
  }
  return false;
}

export interface TabUntilOptions {
  /** Tab backwards (Shift+Tab). */
  shift?: boolean;
  /** Give up after this many presses (default 50). */
  max?: number;
}

/**
 * Press Tab until the focused element has accessible name `name`; return it.
 * Fails with the visited focus order if it is never reached.
 */
export async function tabUntil(
  user: UserEvent,
  name: string | RegExp,
  options: TabUntilOptions = {},
): Promise<HTMLElement> {
  const max = options.max ?? 50;
  const visited: string[] = [];
  for (let i = 0; i < max; i++) {
    await user.tab({ shift: options.shift ?? false });
    const active = document.activeElement;
    if (active && active !== document.body && hasAccessibleName(active, name)) {
      return active as HTMLElement;
    }
    visited.push(describe(active));
  }
  throw new Error(
    `tabUntil: no focusable element named ${String(name)} within ${max} Tab presses. Focus order: ${visited.join(' -> ')}`,
  );
}

/** The accessible-ish label of the focused element, for failure messages. */
function describe(el: Element | null): string {
  if (!el || el === document.body) return '<body>';
  const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
  const testId = el.getAttribute('data-testid');
  return `${el.tagName.toLowerCase()}${testId ? `[${testId}]` : ''}${label ? ` "${label}"` : ''}`;
}

/**
 * The element has focus, is visible, and does not remove the focus outline
 * without a focus-visible replacement. jsdom does not compute :focus-visible
 * or CSS, so ring visibility itself is checked by the Chromium visual job.
 */
export function expectFocusVisible(el: Element): void {
  expect(el).toHaveFocus();
  expect(el).toBeVisible();
  const cls = el.getAttribute('class') ?? '';
  if (/(^|\s)(focus(-visible)?:)?outline-none(\s|$)/.test(cls)) {
    expect(
      /focus-visible:(ring|outline)/.test(cls),
      `${describe(el)} has outline-none without a focus-visible ring or outline`,
    ).toBe(true);
  }
}
