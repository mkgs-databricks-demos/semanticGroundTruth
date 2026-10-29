// @a11y-strict
// client/src/components/admin/ConfirmDialog.tsx — destructive confirm (role="alertdialog")
// Session 54 · Build 5 · wave 5-2 (screen_inventory.md S6: "confirm dialogs
// focus the safe button first"). AppKit AlertDialog (Radix) traps focus,
// focuses Cancel on open, closes on Escape and returns focus to the trigger.

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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" className="min-h-[44px]">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" className="min-h-[44px]" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
