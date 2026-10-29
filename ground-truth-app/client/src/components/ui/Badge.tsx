// @a11y-strict
// client/src/components/ui/Badge.tsx — small pill label
// Session 42 · Build 5 · wave 5-0. Visual spec from the Figma export
// (DesignSystemPage `.badge`, ReviewPage `.type-badge` / `.pending` / `.info-badge`).
// Semantic tokens only. Status tones draw the status color as text on the card
// surface with a tinted border, because that is the pair contrast.test.ts
// verifies (≥ 4.5:1 in both modes); a tinted fill would lower the ratio.

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone =
  | 'default'
  | 'outline'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-muted text-foreground',
  outline: 'border border-input bg-transparent text-foreground',
  info: 'border border-info/40 bg-card text-info',
  success: 'border border-success/40 bg-card text-success',
  warning: 'border border-warning bg-card text-warning-text',
  danger: 'border border-destructive/40 bg-card text-destructive',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
