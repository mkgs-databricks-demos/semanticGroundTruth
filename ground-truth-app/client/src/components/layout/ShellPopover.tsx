// @a11y-strict
// client/src/components/layout/ShellPopover.tsx — non-modal popover for the header (bell, account)
// Session 49 · Build 5 · wave 5-1 (screen_inventory.md S0 keyboard)
//
// role="dialog" with an accessible name, anchored under its trigger.
// Opening moves focus into the popover; Escape closes it and returns focus to
// the trigger (KB K6); a pointer press outside closes it without moving focus.

import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { cn } from '../../lib/utils';

export interface ShellPopoverProps {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Button that toggles the popover; gets focus back on Escape. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Accessible name of the dialog. */
  label: string;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function ShellPopover({
  id,
  open,
  onClose,
  triggerRef,
  label,
  children,
  className,
  'data-testid': testId,
}: ShellPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the effect (which would steal focus on every render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCloseRef.current();
      triggerRef.current?.focus();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, triggerRef]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      data-testid={testId}
      className={cn(
        'absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg',
        'focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
    </div>
  );
}
