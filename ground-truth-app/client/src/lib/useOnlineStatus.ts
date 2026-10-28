// @a11y-strict
// client/src/lib/useOnlineStatus.ts — navigator.onLine as React state
// Session 49 · Build 5 · wave 5-1 (screen_inventory.md §1 "offline" state)
//
// V1 has no offline support (L200-C3 question 2): screens only explain the
// problem and disable writes. The shell banner and every write action read
// this hook, so they agree on one value.

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function getSnapshot(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

/** `true` while the browser reports a connection; re-renders on `online` / `offline`. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
