// client/src/components/review/EditSheet.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '@databricks/appkit-ui/react';
import type { ReviewCard, VoteBody } from '../../../../shared/contracts';

interface EditSheetProps {
  card: ReviewCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: VoteBody) => void;
  disabled?: boolean;
}

export function EditSheet({ card, open, onOpenChange, onSubmit, disabled }: EditSheetProps) {
  const [description, setDescription] = useState(card.asset.description ?? '');
  const [plainEnglish, setPlainEnglish] = useState(card.asset.plainEnglishLogic ?? '');
  const [displayName, setDisplayName] = useState(card.asset.displayName);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    onSubmit({
      assetId: card.asset.id,
      voteType: 'edit',
      feedback: feedback || undefined,
      edits: {
        description: description || undefined,
        plainEnglishLogic: plainEnglish || undefined,
        displayName: displayName || undefined,
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit: {card.asset.displayName || card.asset.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-display-name" className="text-sm font-medium">
              Display name
            </label>
            <Textarea
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              rows={1}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="edit-logic" className="text-sm font-medium">
              Plain-English logic
            </label>
            <Textarea
              id="edit-logic"
              value={plainEnglish}
              onChange={(e) => setPlainEnglish(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="edit-feedback" className="text-sm font-medium">
              Feedback (optional)
            </label>
            <Textarea
              id="edit-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              className="mt-1"
              placeholder="Why are you suggesting these changes?"
            />
          </div>
          <Button onClick={handleSubmit} disabled={disabled} className="w-full">
            Submit edits
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
