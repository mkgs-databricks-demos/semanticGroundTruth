// client/src/components/ui/Skeleton.tsx — loading placeholder
// Session 42 · Build 5 · wave 5-0. The block itself is decorative; a group of
// skeletons announces one "Loading …" message through `label` (role="status").
// The pulse animation is removed by the global prefers-reduced-motion rule.

import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export interface SkeletonGroupProps {
  /** Text announced to assistive tech while loading, e.g. "Loading review queue". */
  label: string;
  /** Number of skeleton lines (default 3). */
  lines?: number;
  className?: string;
}

export function SkeletonGroup({ label, lines = 3, className }: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
