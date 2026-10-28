// @a11y-strict
// client/src/components/steward-triage/TriageStates.tsx — shared offline / error helpers for S8-S10
// Session 55 · Build 5 · wave 5-3
//
// Offline (screen_inventory.md §1): V1 has no offline support, so the state
// only explains the problem, keeps what is on screen read-only and disables
// every write. Nothing is queued.

import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api/http';
import { InlineAlert } from '../ui';

export const OFFLINE_TITLE = "You're offline";

export function TriageOfflineAlert({ children }: { children: ReactNode }) {
  return (
    <InlineAlert variant="offline" title={OFFLINE_TITLE}>
      {children}
    </InlineAlert>
  );
}

/** `fetch` threw (TypeError) instead of answering: the offline state, not an API error. */
export function isOfflineError(error: unknown): boolean {
  return error instanceof TypeError;
}

/** 409 CONFLICT / 404 NOT_FOUND on a write: someone else changed it first (stale). */
export function isStaleError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
