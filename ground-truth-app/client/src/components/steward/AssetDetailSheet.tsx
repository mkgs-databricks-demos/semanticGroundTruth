// @a11y-strict
// client/src/components/steward/AssetDetailSheet.tsx — asset detail + versions in a sheet
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): ui/Sheet (required accessible name),
// loading / error states, versions timeline as a list, and an `actions` slot
// rendered in the sheet footer (session 56 mounts "Share to Slack" there).

import type { ReactNode } from 'react';
import type { Asset } from '../../../../shared/contracts';
import { useAsset, useAssetVersions } from '../../lib/api';
import { Badge, InlineAlert, SkeletonGroup } from '../ui';
import { Sheet } from '../ui/Sheet';

export interface AssetDetailSheetProps {
  assetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra actions for the loaded asset (footer). Rendered only once the asset has loaded. */
  actions?: (asset: Asset) => ReactNode;
}

export function AssetDetailSheet({ assetId, open, onOpenChange, actions }: AssetDetailSheetProps) {
  if (!assetId) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Asset detail">
        <div data-testid="steward-asset-detail-root" />
      </Sheet>
    );
  }
  return <LoadedAssetSheet assetId={assetId} open={open} onOpenChange={onOpenChange} actions={actions} />;
}

function LoadedAssetSheet({ assetId, open, onOpenChange, actions }: AssetDetailSheetProps & { assetId: string }) {
  const asset = useAsset(assetId);
  const loaded = asset.isSuccess ? asset.data : null;
  const extra = loaded && actions ? actions(loaded) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={loaded ? loaded.displayName || loaded.name : 'Asset detail'}
      footer={extra ? <div className="flex flex-wrap gap-2">{extra}</div> : undefined}
    >
      <div data-testid="steward-asset-detail-root">
        {asset.isPending ? (
          <SkeletonGroup label="Loading asset" lines={4} />
        ) : asset.isError ? (
          <InlineAlert title="Couldn't load the asset" onRetry={() => void asset.refetch()} retrying={asset.isFetching}>
            {asset.error.message}
          </InlineAlert>
        ) : (
          <AssetDetailContent asset={asset.data} />
        )}
      </div>
    </Sheet>
  );
}

function AssetDetailContent({ asset }: { asset: Asset }) {
  const versions = useAssetVersions(asset.id);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="outline">{asset.assetType}</Badge>
          <Badge tone="info">{asset.status}</Badge>
          {asset.domain ? <Badge>{asset.domain}</Badge> : null}
        </div>

        {asset.description && (
          <p className="text-sm text-muted-foreground">{asset.description}</p>
        )}

        {asset.plainEnglishLogic && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Plain English Logic</p>
            <p className="mt-1 text-sm">{asset.plainEnglishLogic}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Detail label="Catalog" value={asset.targetCatalog} />
          <Detail label="Schema" value={asset.targetSchema} />
          <Detail label="Environment" value={asset.environment} />
          <Detail label="Updated" value={new Date(asset.updatedAt).toLocaleDateString()} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold">Versions</h3>
          {versions.isPending ? (
            <SkeletonGroup label="Loading versions" lines={2} />
          ) : versions.isError ? (
            <InlineAlert title="Couldn't load versions">{versions.error.message}</InlineAlert>
          ) : versions.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions recorded.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {versions.data.map((v) => (
                <li key={v.id} className="rounded-md border border-border p-2 text-sm">
                  <span className="font-mono">v{v.version}</span>
                  <span className="ml-2 text-muted-foreground">{new Date(v.createdAt).toLocaleDateString('en-US')}</span>
                  {v.description ? <p className="mt-1 text-muted-foreground">{v.description}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
