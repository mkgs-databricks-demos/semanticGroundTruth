// client/src/components/ui/KeyHint.tsx — keyboard shortcut hint (<kbd>)
// Session 42 · Build 5 · wave 5-0. Visual spec from the Figma export (`.vote kbd`).
// Arrow glyphs get a spoken name so screen readers do not read "left arrow
// symbol" inconsistently; the glyph itself is hidden from assistive tech.

import { cn } from '../../lib/utils';

const SPOKEN: Record<string, string> = {
  '←': 'Left arrow',
  '→': 'Right arrow',
  '↑': 'Up arrow',
  '↓': 'Down arrow',
  '↵': 'Enter',
  Esc: 'Escape',
};

export interface KeyHintProps {
  /** One key per entry, e.g. ['→'] or ['Shift', '?']. */
  keys: string[];
  className?: string;
}

export function KeyHint({ keys, className }: KeyHintProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => {
        const spoken = SPOKEN[key];
        return (
          <kbd
            key={`${key}-${i}`}
            className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground"
          >
            {spoken ? (
              <>
                <span aria-hidden="true">{key}</span>
                <span className="sr-only">{spoken}</span>
              </>
            ) : (
              key
            )}
          </kbd>
        );
      })}
    </span>
  );
}
