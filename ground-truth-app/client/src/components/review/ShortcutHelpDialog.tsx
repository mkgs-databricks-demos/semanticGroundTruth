// @a11y-strict
// client/src/components/review/ShortcutHelpDialog.tsx — "?" keyboard shortcut help (brief S1)
// Session 51 · Build 5 · wave 5-2. Modal dialog; Escape closes it (Radix).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@databricks/appkit-ui/react';
import { KeyHint } from '../ui';

const SHORTCUTS: ReadonlyArray<{ keys: string[]; action: string }> = [
  { keys: ['A', '→'], action: 'Approve' },
  { keys: ['R', '←'], action: 'Reject (opens the reject sheet)' },
  { keys: ['E', '↑'], action: 'Edit (opens the edit sheet)' },
  { keys: ['S'], action: 'Skip' },
  { keys: ['Shift', 'S'], action: 'Skip with a reason' },
  { keys: ['1', '2', '3', '4'], action: 'Choose a skip reason' },
  { keys: ['L'], action: 'Show or hide logic' },
  { keys: ['?'], action: 'Show shortcuts' },
  { keys: ['Esc'], action: 'Close' },
];

interface ShortcutHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutHelpDialog({ open, onOpenChange }: ShortcutHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <caption className="sr-only">Review screen keyboard shortcuts</caption>
          <thead>
            <tr>
              <th scope="col" className="pb-2 text-left text-xs font-bold text-muted-foreground">
                Keys
              </th>
              <th scope="col" className="pb-2 text-left text-xs font-bold text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(({ keys, action }) => (
              <tr key={action} className="border-t border-border">
                <td className="py-2 pr-4">
                  <KeyHint keys={keys} />
                </td>
                <td className="py-2">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">Shortcuts are paused while you type in a field.</p>
      </DialogContent>
    </Dialog>
  );
}
