// client/src/components/admin/ScoringConfigForm.tsx — scoring + threshold config form
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@databricks/appkit-ui/react';
import type { AppSettingsDto } from '../../../../shared/contracts';
import { useAdminConfig, useUpdateAdminConfig } from '../../lib/api';

const FIELDS: { key: keyof AppSettingsDto; label: string; min?: number; max?: number; step?: number }[] = [
  { key: 'wilsonZ', label: 'Wilson Z-score', min: 0, step: 0.01 },
  { key: 'industryPrior', label: 'Industry Prior', min: 0, max: 1, step: 0.01 },
  { key: 'priorWeight', label: 'Prior Weight', min: 0, step: 1 },
  { key: 'priorDecayThreshold', label: 'Prior Decay Threshold', min: 1, step: 1 },
  { key: 'certificationThreshold', label: 'Certification Threshold', min: 0, max: 1, step: 0.01 },
  { key: 'minVotesForCertification', label: 'Min Votes for Certification', min: 1, step: 1 },
  { key: 'stalenessDays', label: 'Staleness Days', min: 1, step: 1 },
  { key: 'freshnessIntervalDays', label: 'Freshness Interval (days)', min: 1, step: 1 },
];

export function ScoringConfigForm() {
  const { data: config, isLoading, error } = useAdminConfig();
  const update = useUpdateAdminConfig();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (config) {
      const initial: Record<string, string> = {};
      for (const f of FIELDS) {
        const val = config[f.key];
        if (val !== undefined && val !== null) {
          initial[f.key] = String(val);
        }
      }
      setDraft(initial);
    }
  }, [config]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Scoring Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Scoring Configuration</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const patch: Record<string, number> = {};
    for (const f of FIELDS) {
      const val = draft[f.key];
      if (val !== undefined && val !== '') {
        const num = Number(val);
        if (!Number.isNaN(num)) {
          patch[f.key] = num;
        }
      }
    }
    update.mutate(patch as Parameters<typeof update.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Scoring Configuration</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block space-y-1">
              <span className="text-sm font-medium">{f.label}</span>
              <Input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            </label>
          ))}

          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Configuration'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
