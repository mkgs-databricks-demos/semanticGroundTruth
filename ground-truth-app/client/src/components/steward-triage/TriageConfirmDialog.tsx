// @a11y-strict
// client/src/components/steward-triage/TriageConfirmDialog.tsx — destructive confirm (S9 Reject all, S10 Mark rejected)
// Session 55 · Build 5 · wave 5-3
//
// An `alertdialog` (Radix AlertDialog via AppKit): focus starts on Cancel
// (KB K2), is trapped inside, and Escape / Cancel return it to the trigger.
// `children` sits between the description and the buttons (S10: the
// optional note).
//
// The dialog is controlled and has no Radix Trigger, so Radix would focus a
// null trigger on close and focus would fall to <body>. The element focused
// when the dialog opens (the button, or the list for a shortcut) is kept and
// gets focus back on close, if it is still in the document.

import { useRef } from 'react';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@databricks/appkit-ui/react';
import { Icon } from '../ui';

export interface TriageConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  children?: ReactNode;
}

export function TriageConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
}: TriageConfirmDialogProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          // Runs before AlertDialog moves focus to Cancel.
          const active = document.activeElement;
          returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocus.current;
          returnFocus.current = null;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" className="min-h-[44px]">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" className="min-h-[44px] gap-1.5" onClick={onConfirm}>
              <Icon name="close" />
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
