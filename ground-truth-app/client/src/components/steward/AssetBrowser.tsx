// client/src/components/steward/AssetBrowser.tsx — filterable paged asset list
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import type { AssetStatus, AssetType } from '../../../../shared/contracts';
import { ASSET_STATUSES, ASSET_TYPES } from '../../../../shared/contracts';
import { useAssets } from '../../lib/api';

const PAGE_SIZE = 20;

export function AssetBrowser({
  onSelect,
}: {
  onSelect: (assetId: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useAssets({
    assetType: (typeFilter || undefined) as AssetType | undefined,
    status: (statusFilter || undefined) as AssetStatus | undefined,
    limit: PAGE_SIZE,
    offset,
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Type"
            value={typeFilter}
            options={ASSET_TYPES as unknown as string[]}
            onChange={(v) => { setTypeFilter(v as AssetType | ''); setOffset(0); }}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            options={ASSET_STATUSES as unknown as string[]}
            onChange={(v) => { setStatusFilter(v as AssetStatus | ''); setOffset(0); }}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : !data || data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No assets match the current filters.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Domain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelect(a.id)}
                  >
                    <TableCell className="font-medium">
                      {a.displayName || a.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{a.assetType}</Badge>
                    </TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.domain ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset + PAGE_SIZE >= data.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <select
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
