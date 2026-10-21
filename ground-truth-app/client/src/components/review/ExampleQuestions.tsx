// client/src/components/review/ExampleQuestions.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import { Check, Plus, X } from 'lucide-react';
import type { ExampleQuestion } from '../../../../shared/contracts';
import { useExampleAction } from '../../lib/api/hooks';

interface ExampleQuestionsProps {
  assetId: string;
  examples: ExampleQuestion[];
}

export function ExampleQuestions({ assetId, examples }: ExampleQuestionsProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const action = useExampleAction();

  const handleAdd = () => {
    if (!text.trim()) return;
    action.mutate(
      { assetId, action: 'add', questionText: text.trim() },
      { onSuccess: () => { setText(''); setAdding(false); } },
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Example questions</p>
      <ul className="space-y-1">
        {examples.map((q) => (
          <li key={q.id} className="flex items-start gap-1 text-sm">
            <span className="flex-1">{q.questionText}</span>
            {!q.approved && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={() => action.mutate({ assetId, action: 'approve', questionId: q.id })}
                  aria-label={`Approve question: ${q.questionText}`}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 shrink-0"
                  onClick={() => action.mutate({ assetId, action: 'reject', questionId: q.id })}
                  aria-label={`Reject question: ${q.questionText}`}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="h-7 text-xs flex-1"
            placeholder="Type an example question…"
            aria-label="New example question"
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={action.isPending}>
            Add
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setAdding(true)}
          aria-label="Add example question"
        >
          <Plus className="h-3 w-3" /> Add question
        </Button>
      )}
    </div>
  );
}
