// @a11y-strict
// client/src/components/layout/RouteFallback.tsx — Suspense fallback for lazy routes
// Session 49 · Build 5 · wave 5-1. A page-shaped skeleton (title bar + body
// lines), never a spinner; announces "Loading page" once.

import { Skeleton, SkeletonGroup } from '../ui/Skeleton';

export function RouteFallback() {
  return (
    <div data-testid="shell-route-skeleton" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <SkeletonGroup label="Loading page" lines={5} />
    </div>
  );
}
