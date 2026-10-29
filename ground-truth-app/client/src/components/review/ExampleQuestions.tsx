// @a11y-strict
// client/src/components/review/ExampleQuestions.tsx — "Use it in a sentence" example questions
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · Databricks icons (F6), section heading per brief S1,
// test id review-card-examples, read-only while offline.

import { useState } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import type { ExampleQuestion } from '../../../../shared/contracts';
import { useExampleAction } from '../../lib/api/hooks';
import { Icon } from '../ui';

interface ExampleQuestionsProps {
  assetId: string;
  examples: ExampleQuestion[];
  readOnly?: boolean;
}

export function ExampleQuestions({ assetId, examples, readOnly = false }: ExampleQuestionsProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const action = useExampleAction();
  const disabled = readOnly || action.isPending;

  const handleAdd = () => {
    const questionText = text.trim();
    if (!questionText || disabled) return;
    action.mutate(
      { assetId, action: 'add', questionText },
      {
        onSuccess: () => {
          setText('');
          setAdding(false);
        },
      },
    );
  };

  return (
    <section data-testid="review-card-examples" className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-muted-foreground">Use it in a sentence</h3>
      {examples.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {examples.map((q) => (
            <li key={q.id} className="flex items-start gap-1 text-sm">
              <span className="flex-1 py-1.5">{q.questionText}</span>
              {!q.approved ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-vote-approve"
                    disabled={disabled}
                    onClick={() => action.mutate({ assetId, action: 'approve', questionId: q.id })}
                    aria-label={`Approve question: ${q.questionText}`}
                  >
                    <Icon name="check" size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-vote-reject"
                    disabled={disabled}
                    onClick={() => action.mutate({ assetId, action: 'reject', questionId: q.id })}
                    aria-label={`Reject question: ${q.questionText}`}
                  >
                    <Icon name="close" size={14} />
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No example questions yet.</p>
      )}
      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setAdding(false);
            }}
            className="h-9 flex-1 text-sm"
            placeholder="Type an example question…"
            aria-label="New example question"
            autoFocus
          />
          <Button size="sm" className="min-h-9" onClick={handleAdd} disabled={disabled || !text.trim()}>
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
          Add question
        </Button>
      )}
    </section>
  );
}
