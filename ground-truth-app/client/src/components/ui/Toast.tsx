// client/src/components/ui/Toast.tsx — toast live region (role="status")
// Session 42 · Build 5 · wave 5-0. The region is always mounted (empty when there
// is nothing to say) so screen readers announce toasts added later. Toasts do
// not take focus; each has a labelled Dismiss button.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { cn } from '../../lib/utils';
import { Icon, type IconName } from './Icon';

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
}

const TONE_SPEC: Record<ToastTone, { icon: IconName; text: string }> = {
  default: { icon: 'info', text: 'text-foreground' },
  success: { icon: 'check', text: 'text-success' },
  error: { icon: 'danger', text: 'text-destructive' },
};

export interface ToastRegionProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  /** Accessible name of the region (default "Notifications"). */
  label?: string;
  className?: string;
}

export function ToastRegion({ toasts, onDismiss, label = 'Notifications', className }: ToastRegionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2', className)}
    >
      {toasts.map((toast) => {
        const spec = TONE_SPEC[toast.tone ?? 'default'];
        return (
          <div
            key={toast.id}
            data-tone={toast.tone ?? 'default'}
            className="flex items-start gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
          >
            <Icon name={spec.icon} size={20} className={cn('mt-0.5', spec.text)} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className={cn('font-bold', spec.text)}>{toast.title}</p>
              {toast.description ? <p className="text-sm text-muted-foreground">{toast.description}</p> : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss: ${toast.title}`}
            >
              <Icon name="close" size={16} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** Local toast state. `push` returns the id; toasts auto-dismiss after `durationMs` (0 = never). */
export function useToasts(durationMs = 5000) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const seq = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      seq.current += 1;
      const id = `toast-${seq.current}`;
      setToasts((current) => [...current, { ...toast, id }]);
      if (durationMs > 0) timers.current.set(id, setTimeout(() => dismiss(id), durationMs));
      return id;
    },
    [dismiss, durationMs],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { toasts, push, dismiss };
}
