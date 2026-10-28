// @a11y-strict
// client/src/components/review/QueryPreview.tsx — "Preview query" section with a Run button
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · brief S1 layout, Databricks icon, test id review-card-query-run,
// disabled while offline.

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { useRunQuery } from '../../lib/api/hooks';
import { ApiError } from '../../lib/api/http';
import { Icon } from '../ui';

const MAX_ROWS = 20;

interface QueryPreviewProps {
  assetId: string;
  readOnly?: boolean;
}

export function QueryPreview({ assetId, readOnly = false }: QueryPreviewProps) {
  const runQuery = useRunQuery();
  const result = runQuery.data;

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Preview query</h3>
        <Button
          variant="outline"
          size="sm"
          data-testid="review-card-query-run"
          className="min-h-[44px] gap-1.5"
          disabled={readOnly || runQuery.isPending}
          onClick={() => runQuery.mutate({ assetId })}
        >
          <Icon name="query" size={16} />
          {runQuery.isPending ? 'Running…' : 'Run'}
        </Button>
      </div>
      {runQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {runQuery.error instanceof ApiError ? runQuery.error.message : 'The query failed. Try again.'}
        </p>
      ) : null}
      {result && !runQuery.isPending ? (
        <div className="max-h-64 overflow-auto rounded-md border border-border" role="region" tabIndex={0} aria-label="Query results">
          <Table>
            <TableHeader>
              <TableRow>
                {result.columns.map((col) => (
                  <TableHead key={col} scope="col" className="text-xs">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.slice(0, MAX_ROWS).map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="text-xs">
                      {cell == null ? <span className="italic text-muted-foreground">null</span> : String(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.truncated ? <p className="px-2 py-1 text-xs text-muted-foreground">Results truncated</p> : null}
        </div>
      ) : null}
    </section>
  );
}
