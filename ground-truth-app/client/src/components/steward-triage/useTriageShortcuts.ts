// @a11y-strict
// client/src/components/steward-triage/useTriageShortcuts.ts — page-level single-key shortcuts (KB K2-K4)
// Session 55 · Build 5 · wave 5-3 (ui_test_strategy.md §6)
//
//   useTriageShortcuts({ j: next, k: prev, '/': focusSearch, Enter: open });
//
// Keys are `KeyboardEvent.key` values; single letters match either case.
// A shortcut never fires:
//   * while the user types (input other than radio / checkbox, textarea,
//     select, contenteditable), so a note or search box keeps its letters;
//   * with Ctrl / Meta / Alt held (browser and OS shortcuts win);
//   * while a dialog or sheet is open (it owns the keyboard, incl. Escape);
//   * for Enter / Space on a button, link or other native control (the
//     control's own activation wins).
// A handler that returns `false` declines the key (default behaviour runs);
// otherwise the event's default is prevented, so "/" does not type a slash
// into the search box it just focused.

import { useEffect, useRef } from 'react';

export type ShortcutHandler = (event: KeyboardEvent) => boolean | void;
export type ShortcutMap = Readonly<Record<string, ShortcutHandler | undefined>>;

const TEXT_INPUT_EXEMPT = new Set(['radio', 'checkbox', 'button', 'submit', 'reset']);

/** True when `target` takes typed text (shortcuts stay out of its way). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !TEXT_INPUT_EXEMPT.has(target.type);
  return false;
}

const NATIVE_ACTIVATION = 'button, a[href], input, select, textarea, summary';

function dialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

function lookup(map: ShortcutMap, key: string): ShortcutHandler | undefined {
  return map[key] ?? (key.length === 1 ? map[key.toLowerCase()] : undefined);
}

export function useTriageShortcuts(map: ShortcutMap, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target) || dialogOpen()) return;
      if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.closest(NATIVE_ACTIVATION)) {
        return;
      }
      const handler = lookup(ref.current, event.key);
      if (!handler) return;
      if (handler(event) !== false) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/**
 * Move focus to the next / previous element of `selector` inside `root`
 * (J/K row focus). Starts at the first (next) or last (previous) when focus
 * is outside the list. Returns the focused element.
 */
export function moveFocus(root: HTMLElement | null, selector: string, delta: 1 | -1): HTMLElement | null {
  if (!root) return null;
  const items = [...root.querySelectorAll<HTMLElement>(selector)];
  if (items.length === 0) return null;
  const active = document.activeElement;
  const current = items.findIndex((el) => el === active || (active instanceof Node && el.contains(active)));
  const index =
    current === -1 ? (delta === 1 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, current + delta));
  items[index].focus();
  return items[index];
}
