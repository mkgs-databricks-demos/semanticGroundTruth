// @a11y-strict
// client/src/components/steward/AssetBrowser.tsx — filterable paged asset list
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): Name / Type / Status / Domain table,
// type + status filters (server) and a name filter on the current page,
// paging, a button per row so Enter opens the detail sheet, skeleton / error
// (Retry) / empty ("No assets registered" + Import assets) / no-match states.

import { useId, useState } from 'react';
import {
  Button,
  Input,
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
import { Badge, EmptyPanel, Icon, InlineAlert, SkeletonGroup } from '../ui';

export const PAGE_SIZE = 20;
export const ASSETS_EMPTY_TITLE = 'No assets registered';
export const ASSETS_NO_MATCH_TEXT = 'No assets match the current filters.';

export interface AssetBrowserProps {
  onSelect: (assetId: string) => void;
  onImport: () => void;
  writesDisabled?: boolean;
}

export function AssetBrowser({ onSelect, onImport, writesDisabled = false }: AssetBrowserProps) {
  const searchId = useId();
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const assets = useAssets({
    assetType: typeFilter || undefined,
    status: statusFilter || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const filtered = !!typeFilter || !!statusFilter;
  const needle = search.trim().toLowerCase();
  const rows = (assets.data?.items ?? []).filter(
    (a) => !needle || `${a.displayName ?? ''} ${a.name}`.toLowerCase().includes(needle),
  );

  if (assets.isSuccess && assets.data.total === 0 && !filtered) {
    return (
      <EmptyPanel
        illustration="unity-catalog"
        title={ASSETS_EMPTY_TITLE}
        description="Import metric views from Unity Catalog or a Git folder to start reviewing."
        action={
          <Button onClick={onImport} disabled={writesDisabled} className="min-h-[44px] gap-1.5">
            <Icon name="plus" />
            Import assets
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-sm font-medium">
            Filter by name
          </label>
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name on this page"
            data-testid="steward-assets-search"
          />
        </div>
        <FilterSelect
          label="Type"
          value={typeFilter}
          options={ASSET_TYPES}
          onChange={(v) => {
            setTypeFilter(v as AssetType | '');
            setOffset(0);
          }}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={ASSET_STATUSES}
          onChange={(v) => {
            setStatusFilter(v as AssetStatus | '');
            setOffset(0);
          }}
        />
      </div>

      {assets.isPending ? (
        <SkeletonGroup label="Loading assets" lines={8} />
      ) : assets.isError ? (
        <InlineAlert title="Couldn't load assets" onRetry={() => void assets.refetch()} retrying={assets.isFetching}>
          {assets.error.message}
        </InlineAlert>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{ASSETS_NO_MATCH_TEXT}</p>
      ) : (
        <>
          <Table aria-label="Assets">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} data-testid="steward-assets-row" data-asset-id={a.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="min-h-[44px] text-left underline-offset-4 hover:underline"
                      onClick={() => onSelect(a.id)}
                    >
                      {a.displayName || a.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge tone="outline">{a.assetType}</Badge>
                  </TableCell>
                  <TableCell>{a.status}</TableCell>
                  <TableCell className="text-muted-foreground">{a.domain ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <nav aria-label="Asset pages" className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, assets.data.total)} of {assets.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                disabled={offset + PAGE_SIZE >= assets.data.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
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
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className="min-h-[44px] rounded-md border border-input bg-background px-2 text-sm"
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
    </div>
  );
}
