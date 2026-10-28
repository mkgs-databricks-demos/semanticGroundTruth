// @a11y-strict
// client/src/components/executive/KpiCards.tsx — executive summary KPI cards
// Session 17 · Wave 1 · brand: 32px Bold value, 12px muted label
// Session 54 · Build 5 · wave 5-2: each KPI is a group labelled by its label
// (brief S5), data comes from the page (loading / error / empty live there).

import { useId } from 'react';
import type { ExecutiveSummary } from '../../../../shared/contracts';
import { Skeleton } from '../ui';

export interface KpiSpec {
  label: string;
  testId: string;
  value: (s: ExecutiveSummary) => string;
}

const pct = (n: number) => `${Math.round(n)}%`;
const count = (n: number) => n.toLocaleString('en-US');

/** The six KPI groups, in display order. */
export const KPI_SPECS: readonly KpiSpec[] = [
  { label: 'Coverage', testId: 'executive-kpi-coverage', value: (s) => pct(s.coveragePct) },
  { label: 'Certification', testId: 'executive-kpi-certification', value: (s) => pct(s.certificationPct) },
  { label: 'Active reviewers (7d)', testId: 'executive-kpi-active-reviewers', value: (s) => count(s.activeReviewers7d) },
  { label: 'Votes (7d)', testId: 'executive-kpi-votes', value: (s) => count(s.votes7d) },
  { label: 'Active campaigns', testId: 'executive-kpi-active-campaigns', value: (s) => count(s.activeCampaigns) },
  { label: 'Total assets', testId: 'executive-kpi-total-assets', value: (s) => count(s.totalAssets) },
];

export function KpiCards({ summary }: { summary: ExecutiveSummary }) {
  const baseId = useId();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {KPI_SPECS.map((kpi, i) => {
        const labelId = `${baseId}-kpi-${i}`;
        return (
          <li key={kpi.testId}>
            <div
              role="group"
              aria-labelledby={labelId}
              data-testid={kpi.testId}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-card-foreground"
            >
              <p id={labelId} className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </p>
              <p className="text-[32px] font-bold leading-tight tabular-nums">{kpi.value(summary)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Loading state: six card-shaped skeletons announced once. */
export function KpiSkeletons() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Loading executive summary</span>
      {KPI_SPECS.map((kpi) => (
        <Skeleton key={kpi.testId} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
