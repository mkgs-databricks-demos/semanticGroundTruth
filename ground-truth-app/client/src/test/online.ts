// client/src/test/online.ts — toggle navigator.onLine for offline-state tests
// Session 43 · Build 5 · wave 5-0 (ui_test_strategy.md §5, §8 "offline" rows)
//
//   setOnline(false);   // navigator.onLine === false, 'offline' event fired
//   setOnline(true);    // back online, 'online' event fired
//
// The real navigator.onLine getter is restored after every test.

import { act } from '@testing-library/react';
import { afterEach } from 'vitest';

let overridden = false;

function defineOnLine(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
  overridden = true;
}

/** Set navigator.onLine without dispatching an event (initial state before render). */
export function setInitialOnline(online: boolean): void {
  defineOnLine(online);
}

/** Set navigator.onLine and dispatch `online` / `offline` on window inside act(). */
export function setOnline(online: boolean): void {
  defineOnLine(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

/** Remove the override so navigator.onLine reads jsdom's own getter again. */
export function resetOnline(): void {
  if (!overridden) return;
  // The own property shadows Navigator.prototype.onLine; deleting it restores it.
  delete (window.navigator as { onLine?: boolean }).onLine;
  overridden = false;
}

afterEach(() => {
  resetOnline();
});
