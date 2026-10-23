// client/src/components/steward/MetricViewPanel.tsx — metric view list + detail + validate
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import type { MetricViewDetail } from '../../../../shared/contracts';
import { useMetricView, useMetricViews, useValidateMetricView } from '../../lib/api';

export function MetricViewPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: views, isLoading, error } = useMetricViews();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!views || views.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No metric views found.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {views.map((v) => (
          <Card
            key={v.fullName}
            className={`cursor-pointer transition-colors ${
              selected === v.fullName ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelected(v.fullName === selected ? null : v.fullName)}
          >
            <CardContent className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">{v.fullName}</span>
              <div className="flex gap-1.5">
                <Badge variant="outline">{v.measureCount}m</Badge>
                <Badge variant="outline">{v.dimensionCount}d</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && <MetricViewDetailCard fullName={selected} />}
    </div>
  );
}

function MetricViewDetailCard({ fullName }: { fullName: string }) {
  const { data, isLoading, error } = useMetricView(fullName);
  const validate = useValidateMetricView();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{error?.message ?? 'Not found.'}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{data.fullName}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={validate.isPending}
            onClick={() => validate.mutate(fullName)}
          >
            {validate.isPending ? 'Validating…' : 'Validate'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.comment && (
          <p className="text-sm text-muted-foreground">{data.comment}</p>
        )}

        <ColumnSection title="Measures" columns={data.measures} />
        <ColumnSection title="Dimensions" columns={data.dimensions} />

        {validate.data && (
          <div className="mt-2 rounded-md border p-3 text-sm">
            <p className={validate.data.valid ? 'text-[var(--success)]' : 'text-destructive'}>
              {validate.data.valid ? 'Validation passed' : 'Validation failed'}
            </p>
            {validate.data.error && (
              <p className="mt-1 text-destructive">{validate.data.error}</p>
            )}
          </div>
        )}

        {validate.error && (
          <p className="text-sm text-destructive">{validate.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnSection({
  title,
  columns,
}: {
  title: string;
  columns: MetricViewDetail['measures'];
}) {
  if (columns.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1">
        {columns.map((c) => (
          <li key={c.name} className="text-sm">
            <span className="font-mono">{c.name}</span>
            {c.comment && (
              <span className="ml-2 text-muted-foreground">— {c.comment}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
