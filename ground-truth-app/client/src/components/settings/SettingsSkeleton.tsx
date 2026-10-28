// @a11y-strict
// client/src/components/settings/SettingsSkeleton.tsx — S7 loading state (form skeleton)
// Session 52 · Build 5 · wave 5-2. One role="status" announces "Loading settings";
// the blocks are decorative.

import { Skeleton } from '../ui/Skeleton';

export function SettingsSkeleton({ label = 'Loading settings' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-11 w-full max-w-md" />
        </div>
      ))}
    </div>
  );
}
