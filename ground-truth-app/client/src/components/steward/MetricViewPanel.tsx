// @a11y-strict
// client/src/components/steward/MetricViewPanel.tsx — metric view list + detail + validate
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): toggle buttons (aria-pressed) for the
// list, skeleton / error (Retry) / empty ("No metric views found in this
// catalog") states, Validate result announced through role="status".

import { useState } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import type { MetricViewDetail } from '../../../../shared/contracts';
import { useMetricView, useMetricViews, useValidateMetricView } from '../../lib/api';
import { Badge, EmptyPanel, Icon, InlineAlert, SkeletonGroup } from '../ui';

export const METRIC_VIEWS_EMPTY_TITLE = 'No metric views found in this catalog';

export function MetricViewPanel({ onImport }: { onImport?: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const views = useMetricViews();

  if (views.isPending) {
    return <SkeletonGroup label="Loading metric views" lines={4} />;
  }

  if (views.isError) {
    return (
      <InlineAlert title="Couldn't load metric views" onRetry={() => void views.refetch()} retrying={views.isFetching}>
        {views.error.message}
      </InlineAlert>
    );
  }

  if (views.data.length === 0) {
    return (
      <EmptyPanel
        illustration="unity-catalog"
        title={METRIC_VIEWS_EMPTY_TITLE}
        description="Metric views appear here once they exist in the app's catalog and schema."
        action={
          onImport ? (
            <Button variant="outline" onClick={onImport} className="min-h-[44px]">
              Import assets
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {views.data.map((v) => (
          <li key={v.fullName}>
            <button
              type="button"
              aria-pressed={selected === v.fullName}
              onClick={() => setSelected(v.fullName === selected ? null : v.fullName)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-card-foreground aria-pressed:border-primary"
            >
              <span className="font-mono text-sm">{v.fullName}</span>
              <span className="flex gap-1.5">
                <Badge tone="outline">{v.measureCount} measures</Badge>
                <Badge tone="outline">{v.dimensionCount} dimensions</Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected ? <MetricViewDetailCard fullName={selected} /> : null}
    </div>
  );
}

function MetricViewDetailCard({ fullName }: { fullName: string }) {
  const detail = useMetricView(fullName);
  const validate = useValidateMetricView();

  if (detail.isPending) {
    return <SkeletonGroup label="Loading metric view" lines={4} />;
  }

  if (detail.isError) {
    return (
      <InlineAlert title="Couldn't load the metric view" onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
        {detail.error.message}
      </InlineAlert>
    );
  }

  const data = detail.data;
  return (
    <section aria-label={data.fullName} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-sm font-bold">{data.fullName}</h3>
        <Button
          size="sm"
          variant="outline"
          className="min-h-[44px] gap-1.5"
          disabled={validate.isPending}
          onClick={() => validate.mutate(fullName)}
          data-testid="steward-metric-view-validate"
        >
          <Icon name="check" />
          {validate.isPending ? 'Validating…' : 'Validate'}
        </Button>
      </div>
      {data.comment ? <p className="text-sm text-muted-foreground">{data.comment}</p> : null}

      <ColumnSection title="Measures" columns={data.measures} />
      <ColumnSection title="Dimensions" columns={data.dimensions} />

      <div role="status" className="text-sm">
        {validate.data ? (
          <>
            <p className="font-medium">{validate.data.valid ? 'Validation passed' : 'Validation failed'}</p>
            {validate.data.error ? <p className="mt-1 font-mono text-destructive">{validate.data.error}</p> : null}
          </>
        ) : null}
      </div>
      {validate.isError ? <InlineAlert title="Couldn't validate">{validate.error.message}</InlineAlert> : null}
    </section>
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
      <h4 className="text-sm font-bold">{title}</h4>
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
