// @a11y-strict
// client/src/components/ui/DiffText.tsx — word-level diff with <ins> / <del>
// Session 42 · Build 5 · wave 5-0 (screen_inventory: conflict detail, "insertions
// underlined + --vote-approve tint, deletions struck + --vote-reject tint, never
// color alone"). Text stays in the foreground color, so contrast is unchanged;
// the tint is a non-text cue next to the underline / strike-through, and
// screen readers hear "inserted" / "deleted" markers.

import { cn } from '../../lib/utils';

export type DiffPart = { type: 'same' | 'ins' | 'del'; text: string };

/** Split into words and the whitespace between them (whitespace kept as tokens). */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Word-level diff (LCS). Adjacent parts of the same type are merged. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('del', a[i++]);
    } else {
      push('ins', b[j++]);
    }
  }
  while (i < a.length) push('del', a[i++]);
  while (j < b.length) push('ins', b[j++]);
  return parts;
}

export interface DiffTextProps {
  before: string;
  after: string;
  className?: string;
}

export function DiffText({ before, after, className }: DiffTextProps) {
  const parts = diffWords(before, after);
  return (
    <p className={cn('whitespace-pre-wrap text-foreground', className)} data-slot="diff-text">
      {parts.map((part, idx) => {
        if (part.type === 'same') return <span key={idx}>{part.text}</span>;
        if (part.type === 'ins') {
          return (
            <ins key={idx} className="rounded-sm bg-vote-approve/15 underline decoration-2 underline-offset-2">
              <span className="sr-only">[inserted: </span>
              {part.text}
              <span className="sr-only">]</span>
            </ins>
          );
        }
        return (
          <del key={idx} className="rounded-sm bg-vote-reject/15 line-through decoration-2">
            <span className="sr-only">[deleted: </span>
            {part.text}
            <span className="sr-only">]</span>
          </del>
        );
      })}
    </p>
  );
}
