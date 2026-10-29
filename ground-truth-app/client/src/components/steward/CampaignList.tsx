// @a11y-strict
// client/src/components/steward/CampaignList.tsx — campaign list with progress + status actions
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S4): skeleton / error (Retry) / empty
// ("No campaigns yet" + New campaign) states, labelled progress, status
// actions grouped per row (`steward-campaign-status-menu`), writes disabled offline.

import { useId } from 'react';
import { Button, Progress } from '@databricks/appkit-ui/react';
import type { Campaign, CampaignStatus } from '../../../../shared/contracts';
import { useCampaigns, useUpdateCampaignStatus } from '../../lib/api';
import { Badge, EmptyPanel, Icon, InlineAlert, SkeletonGroup } from '../ui';
import type { BadgeTone } from '../ui';

export const CAMPAIGNS_EMPTY_TITLE = 'No campaigns yet';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

const ACTION_LABEL: Record<CampaignStatus, string> = {
  active: 'Resume',
  paused: 'Pause',
  completed: 'Complete',
  archived: 'Archive',
};

const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'archived'],
  completed: ['archived'],
  archived: [],
};

const STATUS_TONE: Record<CampaignStatus, BadgeTone> = {
  active: 'success',
  paused: 'warning',
  completed: 'info',
  archived: 'outline',
};

export interface CampaignListProps {
  onCreate: () => void;
  writesDisabled?: boolean;
}

export function CampaignList({ onCreate, writesDisabled = false }: CampaignListProps) {
  const campaigns = useCampaigns();
  const updateStatus = useUpdateCampaignStatus();

  if (campaigns.isPending) {
    return <SkeletonGroup label="Loading campaigns" lines={6} />;
  }

  if (campaigns.isError) {
    return (
      <InlineAlert
        title="Couldn't load campaigns"
        onRetry={() => void campaigns.refetch()}
        retrying={campaigns.isFetching}
      >
        {campaigns.error.message}
      </InlineAlert>
    );
  }

  if (campaigns.data.length === 0) {
    return (
      <EmptyPanel
        illustration="data-quality-3"
        title={CAMPAIGNS_EMPTY_TITLE}
        description="A campaign groups assets for reviewers to work through."
        action={
          <Button onClick={onCreate} disabled={writesDisabled} className="min-h-[44px] gap-1.5">
            <Icon name="plus" />
            New campaign
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {updateStatus.isError ? (
        <InlineAlert title="Couldn't change the campaign status">{updateStatus.error.message}</InlineAlert>
      ) : null}
      <ul className="flex flex-col gap-3">
        {campaigns.data.map((c) => (
          <CampaignRow key={c.id} campaign={c} onTransition={updateStatus} writesDisabled={writesDisabled} />
        ))}
      </ul>
    </div>
  );
}

function CampaignRow({
  campaign,
  onTransition,
  writesDisabled,
}: {
  campaign: Campaign;
  onTransition: ReturnType<typeof useUpdateCampaignStatus>;
  writesDisabled: boolean;
}) {
  const nameId = useId();
  const pct = campaign.totalAssets > 0 ? Math.round((campaign.reviewedAssets / campaign.totalAssets) * 100) : 0;
  const transitions = ALLOWED_TRANSITIONS[campaign.status];

  return (
    <li
      aria-labelledby={nameId}
      data-testid="steward-campaign-row"
      data-campaign-id={campaign.id}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={nameId} className="text-base font-bold">
          {campaign.name}
        </h3>
        <Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {campaign.reviewedAssets} of {campaign.totalAssets} reviewed · {pct}%
        </span>
      </div>
      <Progress value={pct} aria-label={`${campaign.name} progress`} aria-valuetext={`${pct}% reviewed`} />

      {transitions.length > 0 ? (
        <div
          role="group"
          aria-label={`Change status of ${campaign.name}`}
          data-testid="steward-campaign-status-menu"
          className="flex flex-wrap gap-2"
        >
          {transitions.map((target) => (
            <Button
              key={target}
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={writesDisabled || onTransition.isPending}
              onClick={() => onTransition.mutate({ campaignId: campaign.id, body: { status: target } })}
            >
              {ACTION_LABEL[target]}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
