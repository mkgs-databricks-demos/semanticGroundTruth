// client/src/pages/steward/StewardPage.tsx — steward-gated campaign + asset management
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import { Import, ShieldAlert } from 'lucide-react';
import { useMe } from '../../lib/api';
import { hasRole } from '../../lib/api/roles';
import { CampaignList } from '../../components/steward/CampaignList';
import { CreateCampaignSheet } from '../../components/steward/CreateCampaignSheet';
import { ImportWizard } from '../../components/steward/ImportWizard';
import { AssetBrowser } from '../../components/steward/AssetBrowser';
import { AssetDetailSheet } from '../../components/steward/AssetDetailSheet';
import { MetricViewPanel } from '../../components/steward/MetricViewPanel';

export function StewardPage() {
  const me = useMe();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasRole(me.data, 'steward')) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Steward Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page is available to users with the steward or admin role.
              Contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Steward Console</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Import className="h-4 w-4 mr-1" /> Import Assets
          </Button>
          <Button onClick={() => setCreateOpen(true)}>New Campaign</Button>
        </div>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="metric-views">Metric Views</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList />
        </TabsContent>

        <TabsContent value="assets">
          <AssetBrowser onSelect={(id) => setDetailId(id)} />
        </TabsContent>

        <TabsContent value="metric-views">
          <MetricViewPanel />
        </TabsContent>
      </Tabs>

      <CreateCampaignSheet open={createOpen} onOpenChange={setCreateOpen} />
      <ImportWizard open={importOpen} onOpenChange={setImportOpen} />
      <AssetDetailSheet
        assetId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
      />
    </div>
  );
}
