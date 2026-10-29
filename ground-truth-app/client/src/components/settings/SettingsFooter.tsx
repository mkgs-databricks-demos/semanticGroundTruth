// @a11y-strict
// client/src/components/settings/SettingsFooter.tsx — sticky "unsaved changes" footer (S7 dirty / saving)
// Session 52 · Build 5 · wave 5-2
//
// Shown only while the form is dirty. The status text is a polite live region
// so "Saving changes…" is announced. Save is disabled while saving and while
// offline. An invalid field does not disable it: pressing Save then shows the
// inline error and moves focus to the field (no request is sent).
// The Ctrl+S hint is visual only; aria-keyshortcuts announces the shortcut.

import { Button } from '@databricks/appkit-ui/react';
import { KeyHint } from '../ui/KeyHint';

export interface SettingsFooterProps {
  saving: boolean;
  offline: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SettingsFooter({ saving, offline, onSave, onDiscard }: SettingsFooterProps) {
  const message = saving
    ? 'Saving changes…'
    : offline
      ? "You're offline. Reconnect to save your changes."
      : 'You have unsaved changes';
  return (
    <div
      data-testid="settings-footer-root"
      className="sticky bottom-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg md:bottom-4"
    >
      <p role="status" aria-live="polite" className="text-sm font-medium">
        {message}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="settings-footer-discard"
          disabled={saving}
          onClick={onDiscard}
          className="min-h-[44px]"
        >
          Discard
        </Button>
        <Button
          type="button"
          data-testid="settings-footer-save"
          disabled={saving || offline}
          onClick={onSave}
          aria-keyshortcuts="Control+S Meta+S"
          className="min-h-[44px] gap-2"
        >
          {saving ? 'Saving…' : 'Save changes'}
          <span aria-hidden="true" className="hidden sm:inline-flex">
            <KeyHint keys={['Ctrl', 'S']} />
          </span>
        </Button>
      </div>
    </div>
  );
}
