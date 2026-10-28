// client/src/components/ui/InlineAlert.tsx — in-place error / warning with Retry
// Session 42 · Build 5 · wave 5-0. role="alert" so the message is announced when
// it appears; the Retry button keeps focus order inside the alert.

import type { ReactNode } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { cn } from '../../lib/utils';
import { Icon, type IconName } from './Icon';

export type InlineAlertVariant = 'error' | 'warning' | 'info' | 'offline' | 'forbidden';

const VARIANT_SPEC: Record<InlineAlertVariant, { icon: IconName; text: string; border: string }> = {
  error: { icon: 'danger', text: 'text-destructive', border: 'border-destructive/40' },
  warning: { icon: 'warning', text: 'text-warning-text', border: 'border-warning' },
  info: { icon: 'info', text: 'text-info', border: 'border-info/40' },
  offline: { icon: 'cloudOff', text: 'text-foreground', border: 'border-border' },
  forbidden: { icon: 'lock', text: 'text-foreground', border: 'border-border' },
};

export interface InlineAlertProps {
  title: string;
  children?: ReactNode;
  variant?: InlineAlertVariant;
  /** Shows a Retry button when set. */
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}

export function InlineAlert({
  title,
  children,
  variant = 'error',
  onRetry,
  retryLabel = 'Retry',
  retrying = false,
  className,
}: InlineAlertProps) {
  const spec = VARIANT_SPEC[variant];
  return (
    <div
      role="alert"
      data-variant={variant}
      className={cn('flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground', spec.border, className)}
    >
      <Icon name={spec.icon} size={20} className={cn('mt-0.5', spec.text)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('font-bold', spec.text)}>{title}</p>
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="min-h-[44px] gap-1.5">
          <Icon name="refresh" size={16} />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
