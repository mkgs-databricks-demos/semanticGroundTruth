// client/src/components/review/QueryPreview.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { Play } from 'lucide-react';
import { useRunQuery } from '../../lib/api/hooks';
import { ApiError } from '../../lib/api/http';

const MAX_ROWS = 20;

export function QueryPreview({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const runQuery = useRunQuery();

  const handleRun = () => {
    setOpen(true);
    runQuery.mutate({ assetId });
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={handleRun}
        aria-label="Run validation query"
      >
        <Play className="h-3 w-3" />
        Preview query
      </Button>
    );
  }

  if (runQuery.isPending) {
    return <p className="text-xs text-muted-foreground animate-pulse">Running query…</p>;
  }

  if (runQuery.isError) {
    const msg =
      runQuery.error instanceof ApiError
        ? runQuery.error.message
        : 'Query failed';
    return <p className="text-xs text-destructive">{msg}</p>;
  }

  const result = runQuery.data;
  if (!result) return null;

  const rows = result.rows.slice(0, MAX_ROWS);

  return (
    <div className="rounded-md border overflow-auto max-h-64">
      <Table>
        <TableHeader>
          <TableRow>
            {result.columns.map((col) => (
              <TableHead key={col} className="text-xs">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} className="text-xs">
                  {cell == null ? <span className="text-muted-foreground italic">null</span> : String(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {result.truncated && (
        <p className="text-[10px] text-muted-foreground px-2 py-1">Results truncated</p>
      )}
    </div>
  );
}
