// client/src/components/review/SynonymChips.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import { Badge, Button, Input } from '@databricks/appkit-ui/react';
import { Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AssetSynonym } from '../../../../shared/contracts';
import { useSynonymAction } from '../../lib/api/hooks';

interface SynonymChipsProps {
  assetId: string;
  synonyms: AssetSynonym[];
}

export function SynonymChips({ assetId, synonyms }: SynonymChipsProps) {
  const [adding, setAdding] = useState(false);
  const [newSynonym, setNewSynonym] = useState('');
  const action = useSynonymAction();

  const handleAdd = () => {
    if (!newSynonym.trim()) return;
    action.mutate(
      { assetId, action: 'add', synonym: newSynonym.trim() },
      { onSuccess: () => { setNewSynonym(''); setAdding(false); } },
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Synonyms</p>
      <div className="flex flex-wrap gap-1.5">
        {synonyms.map((s) => (
          <Badge key={s.id} variant="outline" className="gap-1 pr-1">
            <span>{s.synonym}</span>
            <span className="text-[10px] text-muted-foreground ml-1">
              +{s.approvals} −{s.rejections}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={() => action.mutate({ assetId, action: 'approve', synonym: s.synonym })}
              aria-label={`Approve synonym ${s.synonym}`}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={() => action.mutate({ assetId, action: 'reject', synonym: s.synonym })}
              aria-label={`Reject synonym ${s.synonym}`}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <Input
              value={newSynonym}
              onChange={(e) => setNewSynonym(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="h-6 w-28 text-xs"
              placeholder="New synonym"
              aria-label="New synonym"
              autoFocus
            />
            <Button size="sm" className="h-6 text-xs" onClick={handleAdd} disabled={action.isPending}>
              Add
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setAdding(true)}
            aria-label="Add synonym"
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>
    </div>
  );
}
