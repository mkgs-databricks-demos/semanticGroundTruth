// client/src/components/executive/KpiCards.tsx — executive summary KPI cards
// Session 17 · Wave 1 · brand: 32px Bold value, 12px muted label

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { useExecutiveSummary } from '../../lib/api';

export function KpiCards() {
  const { data, isLoading, error } = useExecutiveSummary();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error?.message ?? 'Unable to load executive summary.'}
      </p>
    );
  }

  const kpis: { label: string; value: string | number }[] = [
    { label: 'Coverage', value: `${Math.round(data.coveragePct)}%` },
    { label: 'Certification', value: `${Math.round(data.certificationPct)}%` },
    { label: 'Active Reviewers (7d)', value: data.activeReviewers7d },
    { label: 'Votes (7d)', value: data.votes7d },
    { label: 'Active Campaigns', value: data.activeCampaigns },
    { label: 'Total Assets', value: data.totalAssets },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {kpi.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[32px] leading-tight font-bold tabular-nums">{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
