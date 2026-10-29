// @a11y-strict
// client/src/components/review/EditSheet.tsx — Edit sheet: propose display name / description / logic
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · ui Sheet primitive, fields prefilled with the current values
// (brief S1). Only changed, non-empty fields are sent as `edits`; with none, an inline error
// shows and no request is sent (hasProposedEdit, the same rule as VoteBodySchema, session 44).

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Input, Textarea } from '@databricks/appkit-ui/react';
import { hasProposedEdit } from '../../../../shared/contracts';
import type { Asset, VoteBody } from '../../../../shared/contracts';
import { Sheet } from '../ui';
import { sheetSide } from './media';
import { Spinner } from './VoteBar';

export type ProposedEdits = NonNullable<VoteBody['edits']>;

type FieldKey = 'displayName' | 'description' | 'plainEnglishLogic';
type Fields = Record<FieldKey, string>;

export const EDIT_NEEDS_CHANGE_MESSAGE = 'Change at least one field before you submit an edit.';

function currentValues(asset: Asset): Fields {
  return {
    displayName: asset.displayName ?? '',
    description: asset.description ?? '',
    plainEnglishLogic: asset.plainEnglishLogic ?? '',
  };
}

/** Fields whose trimmed value is non-empty and differs from the asset's current value. */
export function changedEdits(values: Fields, asset: Asset): ProposedEdits {
  const current = currentValues(asset);
  const edits: ProposedEdits = {};
  for (const key of Object.keys(values) as FieldKey[]) {
    const value = values[key].trim();
    if (value && value !== current[key].trim()) edits[key] = value;
  }
  return edits;
}

interface EditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset;
  onSubmit: (edits: ProposedEdits) => void;
  submitting: boolean;
}

export function EditSheet({ open, onOpenChange, asset, onSubmit, submitting }: EditSheetProps) {
  const ids = { displayName: useId(), description: useId(), plainEnglishLogic: useId() };
  const errorId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Fields>(() => currentValues(asset));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(currentValues(asset));
      setError(null);
    }
    // Reset on every opening (and if the card changes underneath an open sheet).
  }, [open, asset]);

  const setField = (key: FieldKey, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (error) setError(null);
  };

  const submit = () => {
    if (submitting) return;
    const edits = changedEdits(values, asset);
    if (!hasProposedEdit(edits)) {
      setError(EDIT_NEEDS_CHANGE_MESSAGE);
      firstFieldRef.current?.focus();
      return;
    }
    onSubmit(edits);
  };

  const invalid = error !== null;
  const fieldA11y = { 'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? errorId : undefined };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side={sheetSide()}
      title="Edit definition"
      description={`Propose a change to ${asset.displayName || asset.name}. A steward reviews every edit.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="min-h-[44px]" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="review-edit-sheet-submit"
            className="min-h-[44px] gap-1.5"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? <Spinner /> : null}
            Submit edit
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <p id={errorId} role="alert" className="text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.displayName} className="text-sm font-bold">
            Display name
          </label>
          <Input
            ref={firstFieldRef}
            id={ids.displayName}
            autoFocus
            value={values.displayName}
            disabled={submitting}
            onChange={(e) => setField('displayName', e.target.value)}
            {...fieldA11y}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.description} className="text-sm font-bold">
            Description
          </label>
          <Textarea
            id={ids.description}
            rows={4}
            value={values.description}
            disabled={submitting}
            onChange={(e) => setField('description', e.target.value)}
            {...fieldA11y}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.plainEnglishLogic} className="text-sm font-bold">
            Plain-English logic
          </label>
          <Textarea
            id={ids.plainEnglishLogic}
            rows={4}
            value={values.plainEnglishLogic}
            disabled={submitting}
            onChange={(e) => setField('plainEnglishLogic', e.target.value)}
            {...fieldA11y}
          />
        </div>
      </div>
    </Sheet>
  );
}
