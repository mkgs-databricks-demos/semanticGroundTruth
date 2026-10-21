// client/src/components/steward/AssetDetailSheet.tsx — asset detail + versions in a sheet
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Badge,
  Card,
  CardContent,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { useAsset, useAssetVersions } from '../../lib/api';

export function AssetDetailSheet({
  assetId,
  open,
  onOpenChange,
}: {
  assetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {assetId ? (
          <AssetDetailContent assetId={assetId} />
        ) : (
          <SheetHeader>
            <SheetTitle>Asset Detail</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AssetDetailContent({ assetId }: { assetId: string }) {
  const { data: asset, isLoading, error } = useAsset(assetId);
  const versions = useAssetVersions(assetId);

  if (isLoading) {
    return (
      <div className="space-y-3 pt-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="pt-6">
        <p className="text-sm text-destructive">
          {error?.message ?? 'Asset not found.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{asset.displayName || asset.name}</SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{asset.assetType}</Badge>
          <Badge>{asset.status}</Badge>
          {asset.domain && (
            <Badge variant="secondary">{asset.domain}</Badge>
          )}
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
          <h4 className="mb-2 text-sm font-medium">Versions</h4>
          {versions.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : versions.error ? (
            <p className="text-sm text-destructive">{versions.error.message}</p>
          ) : !versions.data || versions.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions recorded.</p>
          ) : (
            <div className="space-y-2">
              {versions.data.map((v) => (
                <Card key={v.id}>
                  <CardContent className="py-2 text-sm">
                    <span className="font-mono">v{v.version}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                    {v.description && (
                      <p className="mt-1 text-muted-foreground">
                        {v.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
