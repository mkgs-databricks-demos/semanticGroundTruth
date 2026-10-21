// client/src/components/steward/CampaignList.tsx — campaign list with progress + status actions
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
  Skeleton,
} from '@databricks/appkit-ui/react';
import type { Campaign, CampaignStatus } from '../../../../shared/contracts';
import { useCampaigns, useUpdateCampaignStatus } from '../../lib/api';

const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  completed: 'outline',
  archived: 'destructive',
};

export function CampaignList() {
  const { data: campaigns, isLoading, error } = useCampaigns();
  const updateStatus = useUpdateCampaignStatus();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-sm text-destructive">{error.message}</p>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No campaigns yet. Create one to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignRow key={c.id} campaign={c} onTransition={updateStatus} />
      ))}
    </div>
  );
}

function CampaignRow({
  campaign,
  onTransition,
}: {
  campaign: Campaign;
  onTransition: ReturnType<typeof useUpdateCampaignStatus>;
}) {
  const pct =
    campaign.totalAssets > 0
      ? Math.round((campaign.reviewedAssets / campaign.totalAssets) * 100)
      : 0;
  const transitions = ALLOWED_TRANSITIONS[campaign.status];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[campaign.status]}>
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {campaign.campaignType} · {campaign.reviewedAssets}/{campaign.totalAssets} assets
          </span>
          <span className="ml-auto tabular-nums font-medium">{pct}%</span>
        </div>
        <Progress value={pct} />

        {transitions.length > 0 && (
          <div className="flex gap-2">
            {transitions.map((target) => (
              <Button
                key={target}
                size="sm"
                variant="outline"
                disabled={onTransition.isPending}
                onClick={() =>
                  onTransition.mutate({
                    campaignId: campaign.id,
                    body: { status: target },
                  })
                }
              >
                {target}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
