// @a11y-strict
// client/src/components/review/SynonymChips.tsx — synonym chips with approve / reject / add
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · Databricks icons (F6), section heading, test id review-card-synonyms,
// read-only while offline.

import { useState } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import type { AssetSynonym } from '../../../../shared/contracts';
import { useSynonymAction } from '../../lib/api/hooks';
import { Icon } from '../ui';

interface SynonymChipsProps {
  assetId: string;
  synonyms: AssetSynonym[];
  readOnly?: boolean;
}

export function SynonymChips({ assetId, synonyms, readOnly = false }: SynonymChipsProps) {
  const [adding, setAdding] = useState(false);
  const [newSynonym, setNewSynonym] = useState('');
  const action = useSynonymAction();
  const disabled = readOnly || action.isPending;

  const handleAdd = () => {
    const synonym = newSynonym.trim();
    if (!synonym || disabled) return;
    action.mutate(
      { assetId, action: 'add', synonym },
      {
        onSuccess: () => {
          setNewSynonym('');
          setAdding(false);
        },
      },
    );
  };

  return (
    <section data-testid="review-card-synonyms" className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-muted-foreground">Synonyms</h3>
      <ul className="flex flex-wrap gap-1.5">
        {synonyms.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pl-2.5 pr-1 text-sm">
            <span>{s.synonym}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              +{s.approvals} −{s.rejections}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-vote-approve"
              disabled={disabled}
              onClick={() => action.mutate({ assetId, action: 'approve', synonym: s.synonym })}
              aria-label={`Approve synonym ${s.synonym}`}
            >
              <Icon name="check" size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-vote-reject"
              disabled={disabled}
              onClick={() => action.mutate({ assetId, action: 'reject', synonym: s.synonym })}
              aria-label={`Reject synonym ${s.synonym}`}
            >
              <Icon name="close" size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newSynonym}
            onChange={(e) => setNewSynonym(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            className="h-9 w-48 text-sm"
            placeholder="New synonym"
            aria-label="New synonym"
            maxLength={200}
            autoFocus
          />
          <Button size="sm" className="min-h-9" onClick={handleAdd} disabled={disabled || !newSynonym.trim()}>
            Add
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="min-h-9 gap-1 self-start"
          disabled={readOnly}
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={14} />
          Add synonym
        </Button>
      )}
    </section>
  );
}
