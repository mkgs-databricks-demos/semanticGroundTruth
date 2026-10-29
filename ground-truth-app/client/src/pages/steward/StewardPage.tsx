// @a11y-strict
// client/src/pages/steward/StewardPage.tsx — steward-gated campaign + asset management (S4)
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2: RoleGate (F4: error vs forbidden), one
// level-1 heading, "Steward views" tablist, per-tab loading / error / empty states with
// CTAs, writes disabled offline. The sub-nav (Overview · Feedback queue ·
// Conflicts · Feedback branches) is rendered by the shell on every /steward*
// route (components/layout/StewardSubNav.tsx, session 49).

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@databricks/appkit-ui/react';
import type { Asset } from '../../../../shared/contracts';
import { RoleGate } from '../../components/access/RoleGate';
import { AssetBrowser } from '../../components/steward/AssetBrowser';
import { AssetDetailSheet } from '../../components/steward/AssetDetailSheet';
import { CampaignList } from '../../components/steward/CampaignList';
import { CreateCampaignSheet } from '../../components/steward/CreateCampaignSheet';
import { ImportWizard } from '../../components/steward/ImportWizard';
import { MetricViewPanel } from '../../components/steward/MetricViewPanel';
import { Icon, InlineAlert } from '../../components/ui';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export const STEWARD_TITLE = 'Steward';
export const STEWARD_FORBIDDEN_TITLE = 'Steward access required';
export const STEWARD_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-stewards.';

export interface StewardPageProps {
  /** Extra actions for the asset detail sheet (session 56: Share to Slack). */
  assetActions?: (asset: Asset) => ReactNode;
}

export function StewardPage({ assetActions }: StewardPageProps = {}) {
  return (
    <RoleGate
      page="steward"
      role="steward"
      title={STEWARD_TITLE}
      forbiddenTitle={STEWARD_FORBIDDEN_TITLE}
      forbiddenDescription={STEWARD_FORBIDDEN_TEXT}
    >
      <StewardConsole assetActions={assetActions} />
    </RoleGate>
  );
}

type StewardTab = 'campaigns' | 'assets' | 'metric-views';

function StewardConsole({ assetActions }: StewardPageProps) {
  const online = useOnlineStatus();
  const [tab, setTab] = useState<StewardTab>('campaigns');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{STEWARD_TITLE}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] gap-1.5"
            disabled={!online}
            onClick={() => setImportOpen(true)}
            data-testid="steward-actions-import"
          >
            <Icon name="folderBranch" />
            Import assets
          </Button>
          <Button
            className="min-h-[44px] gap-1.5"
            disabled={!online}
            onClick={() => setCreateOpen(true)}
            data-testid="steward-actions-new-campaign"
          >
            <Icon name="plus" />
            New campaign
          </Button>
        </div>
      </div>

      {!online ? (
        <InlineAlert variant="offline" title="You're offline">
          Imports, campaigns and status changes are disabled until the connection is back.
        </InlineAlert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as StewardTab)}>
        <TabsList aria-label="Steward views">
          <TabsTrigger value="campaigns" data-testid="steward-tabs-campaigns">
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="assets" data-testid="steward-tabs-assets">
            Assets
          </TabsTrigger>
          <TabsTrigger value="metric-views" data-testid="steward-tabs-metric-views">
            Metric views
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="pt-4">
          <CampaignList onCreate={() => setCreateOpen(true)} writesDisabled={!online} />
        </TabsContent>

        <TabsContent value="assets" className="pt-4">
          <AssetBrowser onSelect={setDetailId} onImport={() => setImportOpen(true)} writesDisabled={!online} />
        </TabsContent>

        <TabsContent value="metric-views" className="pt-4">
          <MetricViewPanel onImport={online ? () => setImportOpen(true) : undefined} />
        </TabsContent>
      </Tabs>

      <CreateCampaignSheet open={createOpen} onOpenChange={setCreateOpen} />
      {/* Mounted only while open: its catalog / source queries must not run on
          every console load, and closing resets the wizard. */}
      {importOpen ? <ImportWizard open onOpenChange={setImportOpen} /> : null}
      <AssetDetailSheet
        assetId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        actions={assetActions}
      />
    </div>
  );
}
