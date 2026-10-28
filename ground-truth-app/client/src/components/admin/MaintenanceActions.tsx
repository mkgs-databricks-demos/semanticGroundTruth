// @a11y-strict
// client/src/components/admin/MaintenanceActions.tsx — freshness check + recompute
// Session 17 · Wave 1 · brand: destructive confirm dialog, semantic tokens
// Session 54 · Build 5 · wave 5-2 (S6 "System"): destructive-styled outline
// buttons, each behind a confirm alertdialog that focuses Cancel first;
// results announced through role="status"; disabled offline.

import { useId, useState } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import { useRecomputeAsset, useRunFreshnessCheck } from '../../lib/api';
import { InlineAlert } from '../ui';
import { ConfirmDialog } from './ConfirmDialog';

// bg-card in both modes: destructive is contrast-checked as text on card. AppKit's outline
// variant tints dark mode with bg-input/30 (3.08:1 in ui_visual_checks run 493269714873880, session 62).
const DESTRUCTIVE_OUTLINE = 'min-h-[44px] bg-card dark:bg-card border-destructive/40 text-destructive';

export function MaintenanceActions({ disabled = false }: { disabled?: boolean }) {
  const freshness = useRunFreshnessCheck();
  const recompute = useRecomputeAsset();
  const assetInputId = useId();
  const [assetId, setAssetId] = useState('');
  const [confirm, setConfirm] = useState<'recompute' | 'freshness' | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Recompute confidence for an asset</h3>
        <p className="text-sm text-muted-foreground">Recalculates the Wilson confidence interval for one asset.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={assetInputId} className="text-sm font-medium">
              Asset id
            </label>
            <Input
              id={assetInputId}
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="font-mono"
              disabled={disabled}
            />
          </div>
          <Button
            variant="outline"
            className={DESTRUCTIVE_OUTLINE}
            disabled={disabled || !assetId.trim() || recompute.isPending}
            onClick={() => setConfirm('recompute')}
            data-testid="admin-maintenance-recompute"
          >
            {recompute.isPending ? 'Recomputing…' : 'Recompute'}
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {recompute.data
            ? `Confidence ${recompute.data.confidence.toFixed(4)} (Wilson ${recompute.data.wilsonLower.toFixed(4)} to ${recompute.data.wilsonUpper.toFixed(4)})`
            : ''}
        </p>
        {recompute.isError ? <InlineAlert title="Couldn't recompute the asset">{recompute.error.message}</InlineAlert> : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Run freshness check now</h3>
        <p className="text-sm text-muted-foreground">
          Creates or updates the automatic freshness campaign for stale assets.
        </p>
        <div>
          <Button
            variant="outline"
            className={DESTRUCTIVE_OUTLINE}
            disabled={disabled || freshness.isPending}
            onClick={() => setConfirm('freshness')}
            data-testid="admin-maintenance-freshness"
          >
            {freshness.isPending ? 'Running…' : 'Run freshness check'}
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {freshness.data
            ? `Added ${freshness.data.added} assets${freshness.data.campaignId ? ' to the freshness campaign' : ''}.`
            : ''}
        </p>
        {freshness.isError ? <InlineAlert title="Couldn't run the freshness check">{freshness.error.message}</InlineAlert> : null}
      </div>

      <ConfirmDialog
        open={confirm === 'recompute'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Recompute confidence?"
        description="The asset's confidence score is recalculated from its votes now."
        confirmLabel="Recompute"
        onConfirm={() => recompute.mutate(assetId.trim())}
      />
      <ConfirmDialog
        open={confirm === 'freshness'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Run the freshness check?"
        description="Stale assets are added to the automatic freshness campaign."
        confirmLabel="Run check"
        onConfirm={() => freshness.mutate()}
      />
    </div>
  );
}
