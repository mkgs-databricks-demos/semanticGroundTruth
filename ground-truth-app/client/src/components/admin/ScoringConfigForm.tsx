// @a11y-strict
// client/src/components/admin/ScoringConfigForm.tsx — scoring + threshold config form
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S6): "Skip cooldown (hours)" (0-720, plan
// 25), helper text per field, client-side validation (an invalid field shows an
// inline error and sends no request), load and save errors kept apart, saved
// status, disabled offline.

import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import type { AppSettingsDto, UpdateConfigBody } from '../../../../shared/contracts';
import { SKIP_COOLDOWN_HOURS_MAX, SKIP_COOLDOWN_HOURS_MIN } from '../../../../shared/contracts';
import { useAdminConfig, useUpdateAdminConfig } from '../../lib/api';
import { InlineAlert, SkeletonGroup } from '../ui';

type NumericKey = Exclude<keyof UpdateConfigBody, 'adminEmails' | 'stewardEmails'>;

interface FieldSpec {
  key: NumericKey;
  label: string;
  help: string;
  kind: 'positive' | 'unit' | 'int' | 'hours';
  step: number;
  testId?: string;
}

export const SKIP_COOLDOWN_LABEL = 'Skip cooldown (hours)';
export const SKIP_COOLDOWN_ERROR = `Enter ${SKIP_COOLDOWN_HOURS_MIN} to ${SKIP_COOLDOWN_HOURS_MAX} hours`;

export const SCORING_FIELDS: readonly FieldSpec[] = [
  { key: 'wilsonZ', label: 'Wilson z', help: 'Confidence level of the Wilson interval (1.96 = 95%).', kind: 'positive', step: 0.01 },
  { key: 'industryPrior', label: 'Industry prior', help: 'Expected approval rate before any votes (0 to 1).', kind: 'unit', step: 0.01 },
  { key: 'priorWeight', label: 'Prior weight', help: 'How many votes the prior counts as.', kind: 'positive', step: 1 },
  { key: 'priorDecayThreshold', label: 'Prior decay threshold', help: 'Votes after which the prior stops counting.', kind: 'int', step: 1 },
  { key: 'certificationThreshold', label: 'Certification threshold', help: 'Confidence needed to certify an asset (0 to 1).', kind: 'unit', step: 0.01 },
  { key: 'minVotesForCertification', label: 'Minimum votes for certification', help: 'Votes needed before an asset can be certified.', kind: 'int', step: 1 },
  { key: 'stalenessDays', label: 'Staleness (days)', help: 'Days after which a certified asset is stale.', kind: 'int', step: 1 },
  { key: 'freshnessIntervalDays', label: 'Freshness interval (days)', help: 'Days between automatic freshness checks.', kind: 'int', step: 1 },
  {
    key: 'skipCooldownHours',
    label: SKIP_COOLDOWN_LABEL,
    help: 'How long a skipped card stays hidden from that reviewer.',
    kind: 'hours',
    step: 1,
    testId: 'admin-scoring-skip-cooldown',
  },
];

/** Returns the error message for a raw input value, or null when it is valid. */
export function validateField(spec: FieldSpec, raw: string): string | null {
  const value = raw.trim() === '' ? Number.NaN : Number(raw);
  switch (spec.kind) {
    case 'hours':
      return Number.isInteger(value) && value >= SKIP_COOLDOWN_HOURS_MIN && value <= SKIP_COOLDOWN_HOURS_MAX
        ? null
        : SKIP_COOLDOWN_ERROR;
    case 'unit':
      return Number.isFinite(value) && value >= 0 && value <= 1 ? null : 'Enter a value from 0 to 1';
    case 'int':
      return Number.isInteger(value) && value >= 1 ? null : 'Enter a whole number of 1 or more';
    default:
      return Number.isFinite(value) && value > 0 ? null : 'Enter a number greater than 0';
  }
}

function toDraft(config: AppSettingsDto): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const f of SCORING_FIELDS) draft[f.key] = config[f.key] === undefined ? '' : String(config[f.key]);
  return draft;
}

export function ScoringConfigForm({ disabled = false }: { disabled?: boolean }) {
  const config = useAdminConfig();
  const update = useUpdateAdminConfig();
  const baseId = useId();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config.data) setDraft(toDraft(config.data));
  }, [config.data]);

  if (config.isPending) {
    return <SkeletonGroup label="Loading scoring configuration" lines={6} />;
  }

  if (config.isError) {
    return (
      <InlineAlert
        title="Couldn't load the scoring configuration"
        onRetry={() => void config.refetch()}
        retrying={config.isFetching}
      >
        {config.error.message}
      </InlineAlert>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const nextErrors: Record<string, string> = {};
    const body: UpdateConfigBody = {};
    for (const f of SCORING_FIELDS) {
      const raw = draft[f.key] ?? '';
      const error = validateField(f, raw);
      if (error) nextErrors[f.key] = error;
      else body[f.key] = Number(raw);
    }
    setErrors(nextErrors);
    setSaved(false);
    if (Object.keys(nextErrors).length > 0) return;
    update.mutate(body, { onSuccess: () => setSaved(true) });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SCORING_FIELDS.map((f) => {
          const inputId = `${baseId}-${f.key}`;
          const helpId = `${inputId}-help`;
          const errorId = `${inputId}-error`;
          const error = errors[f.key];
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <label htmlFor={inputId} className="text-sm font-medium">
                {f.label}
              </label>
              <Input
                id={inputId}
                type="number"
                inputMode="decimal"
                step={f.step}
                value={draft[f.key] ?? ''}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${helpId} ${errorId}` : helpId}
                data-testid={f.testId}
                onChange={(e) => {
                  setDraft({ ...draft, [f.key]: e.target.value });
                  setSaved(false);
                }}
              />
              <p id={helpId} className="text-xs text-muted-foreground">
                {f.help}
              </p>
              {error ? (
                <p id={errorId} className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {update.isError ? <InlineAlert title="Couldn't save the scoring configuration">{update.error.message}</InlineAlert> : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          className="min-h-[44px]"
          disabled={disabled || update.isPending}
          data-testid="admin-scoring-save"
        >
          {update.isPending ? 'Saving…' : 'Save scoring'}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {saved ? 'Saved' : ''}
        </p>
      </div>
    </form>
  );
}
