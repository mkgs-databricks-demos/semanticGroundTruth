// @a11y-strict
// client/src/components/review/ReviewCard.tsx — the S1 review card (content only; votes live in VoteBar)
// Session 17 · Wave 1 · brand tokens, LogicView replaces old YAML section
// Session 51 · Build 5 · wave 5-2 · Figma export layout: type + status badges, resurfaced badge,
// domain path, <h2> name (the page <h1> is "Review"), campaign chip, meter, progress, synonyms,
// examples, Logic disclosure, query preview. Test ids per figma_make_brief S1 "Keep:".

import { useId } from 'react';
import type { AssetStatus, ReviewCard as ReviewCardType } from '../../../../shared/contracts';
import { Badge, Icon, StatusBadge } from '../ui';
import type { Status } from '../ui';
import { AssetTypeBadge } from './AssetTypeBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ExampleQuestions } from './ExampleQuestions';
import { LogicView } from './LogicView';
import { ProgressBar } from './ProgressBar';
import { QueryPreview } from './QueryPreview';
import { SynonymChips } from './SynonymChips';

const STATUS_BADGE: Record<AssetStatus, { status: Status; label: string }> = {
  PENDING: { status: 'pending', label: 'Pending' },
  REVIEWED: { status: 'approved', label: 'Reviewed' },
  CERTIFIED: { status: 'approved', label: 'Certified' },
};

interface ReviewCardProps {
  card: ReviewCardType;
  logicOpen: boolean;
  onLogicToggle: () => void;
  /** Offline: the card stays readable but synonym / example / query actions are disabled. */
  readOnly: boolean;
}

export function ReviewCard({ card, logicOpen, onLogicToggle, readOnly }: ReviewCardProps) {
  const titleId = useId();
  const { asset } = card;
  const title = asset.displayName || asset.name;
  const domainPath = [asset.domain, asset.subdomain].filter(Boolean).join(' / ');
  const status = STATUS_BADGE[asset.status];

  return (
    <article
      data-testid="review-card-root"
      data-asset-id={asset.id}
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <AssetTypeBadge type={asset.assetType} />
          <span data-testid="review-card-status-badge">
            <StatusBadge status={status.status} label={status.label} />
          </span>
          {card.resurfacedFromSkip ? (
            <Badge tone="info" className="gap-1">
              <Icon name="info" size={14} />
              You skipped this earlier
            </Badge>
          ) : null}
        </div>
        {domainPath ? <span className="text-xs text-muted-foreground">{domainPath}</span> : null}
      </div>

      <h2 id={titleId} data-testid="review-card-title" className="text-xl font-bold leading-tight">
        {title}
      </h2>
      {card.campaign ? (
        <span className="self-start rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{card.campaign.name}</span>
      ) : null}
      {asset.description ? <p className="text-base">{asset.description}</p> : null}

      <ConfidenceMeter confidence={card.confidence} status={asset.status} />
      <ProgressBar
        reviewed={card.progress.reviewed}
        total={card.progress.total}
        label={card.campaign ? 'Campaign progress' : 'Review progress'}
      />

      <SynonymChips assetId={asset.id} synonyms={card.synonyms} readOnly={readOnly} />
      <ExampleQuestions assetId={asset.id} examples={card.examples} readOnly={readOnly} />
      <LogicView asset={asset} open={logicOpen} onToggle={onLogicToggle} />
      <QueryPreview assetId={asset.id} readOnly={readOnly} />
    </article>
  );
}
