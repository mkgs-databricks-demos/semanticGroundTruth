// @a11y-strict
// client/src/components/steward-triage/ConflictList.tsx — S9 list of conflict groups (left pane)
// Session 55 · Build 5 · wave 5-3
//
// A single-select listbox (focus stays on the list, `aria-activedescendant`
// points at the selected group), so J/K and Arrow keys change
// `aria-selected` without moving focus into the detail (KB K2).

import { forwardRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { ConflictGroup } from '../../../../shared/contracts';
import { formatRelativeTime } from '../../lib/time';
import { cn } from '../../lib/utils';
import { Badge } from '../ui';
import { conflictFields, conflictSummary, FIELD_LABELS, latestEditAt } from './labels';

export function conflictOptionId(assetId: string): string {
  return `steward-conflict-option-${assetId}`;
}

export interface ConflictListProps {
  groups: readonly ConflictGroup[];
  selectedId: string | null;
  onSelect: (assetId: string) => void;
  /** Arrow Up / Down inside the list (same as K / J). */
  onMove: (delta: 1 | -1) => void;
  now?: Date;
}

export const ConflictList = forwardRef<HTMLUListElement, ConflictListProps>(function ConflictList(
  { groups, selectedId, onSelect, onMove, now },
  ref,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') onMove(1);
    else if (event.key === 'ArrowUp') onMove(-1);
    else return;
    event.preventDefault();
  };
  return (
    <ul
      ref={ref}
      role="listbox"
      aria-label="Conflict groups"
      aria-keyshortcuts="J K"
      tabIndex={0}
      aria-activedescendant={selectedId ? conflictOptionId(selectedId) : undefined}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {groups.map((g) => {
        const selected = g.assetId === selectedId;
        const latest = latestEditAt(g);
        return (
          <li
            key={g.assetId}
            id={conflictOptionId(g.assetId)}
            role="option"
            aria-selected={selected}
            data-testid="steward-conflicts-list-item"
            data-asset-id={g.assetId}
            onClick={() => onSelect(g.assetId)}
            className={cn(
              'flex cursor-pointer flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground',
              selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted/40',
            )}
          >
            <span className="font-medium">{g.displayName}</span>
            <span className="flex flex-wrap gap-1">
              {conflictFields(g).map((f) => (
                <Badge key={f} tone="warning">
                  {FIELD_LABELS[f]}
                </Badge>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              {conflictSummary(g)}
              {latest ? ` · ${formatRelativeTime(latest, now)}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
});
