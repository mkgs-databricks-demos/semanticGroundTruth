// client/src/components/admin/MaintenanceActions.tsx — freshness check + recompute
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@databricks/appkit-ui/react';
import { useRecomputeAsset, useRunFreshnessCheck } from '../../lib/api';

export function MaintenanceActions() {
  const freshness = useRunFreshnessCheck();
  const recompute = useRecomputeAsset();
  const [assetId, setAssetId] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Run Freshness Check</p>
          <p className="text-xs text-muted-foreground">
            Creates or updates the automatic freshness campaign for stale assets.
          </p>
          <Button
            variant="outline"
            disabled={freshness.isPending}
            onClick={() => freshness.mutate(undefined as never)}
          >
            {freshness.isPending ? 'Running…' : 'Check Freshness'}
          </Button>
          {freshness.data && (
            <p className="text-sm text-muted-foreground">
              Added {freshness.data.added} assets
              {freshness.data.campaignId ? ` to campaign ${freshness.data.campaignId}` : ''}.
            </p>
          )}
          {freshness.error && (
            <p className="text-sm text-destructive">{freshness.error.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recompute Asset Score</p>
          <p className="text-xs text-muted-foreground">
            Recalculates the Wilson confidence interval for a specific asset.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Asset UUID"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              disabled={!assetId.trim() || recompute.isPending}
              onClick={() => recompute.mutate(assetId.trim())}
            >
              {recompute.isPending ? 'Computing…' : 'Recompute'}
            </Button>
          </div>
          {recompute.data && (
            <p className="text-sm text-muted-foreground">
              Confidence: {recompute.data.confidence.toFixed(4)} (Wilson [{recompute.data.wilsonLower.toFixed(4)}, {recompute.data.wilsonUpper.toFixed(4)}])
            </p>
          )}
          {recompute.error && (
            <p className="text-sm text-destructive">{recompute.error.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
