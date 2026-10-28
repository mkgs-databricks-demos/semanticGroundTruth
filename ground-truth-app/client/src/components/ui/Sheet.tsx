// @a11y-strict
// client/src/components/ui/Sheet.tsx — side / bottom sheet with a required title
// Session 42 · Build 5 · wave 5-0. Thin wrapper over the AppKit (Radix Dialog)
// sheet, which already traps focus, closes on Escape and restores focus to the
// trigger. The wrapper makes the accessible name and description mandatory /
// explicit and applies the export's sheet layout (`.review-sheet`).

import type { ReactNode } from 'react';
import {
  Sheet as AppKitSheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@databricks/appkit-ui/react';
import { cn } from '../../lib/utils';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the dialog (rendered as the sheet heading). */
  title: string;
  /** Visible description, linked with aria-describedby. */
  description?: string;
  children: ReactNode;
  /** Action row, e.g. Cancel + primary Button. */
  footer?: ReactNode;
  side?: 'right' | 'bottom' | 'left';
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: SheetProps) {
  return (
    <AppKitSheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('flex flex-col gap-4 bg-card text-card-foreground', className)}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </AppKitSheet>
  );
}
