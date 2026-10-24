// client/src/components/review/ReviewCard.tsx
// Session 17 · Wave 1 · brand tokens, LogicView replaces old YAML section

import { Badge, Card, CardContent, CardHeader } from '@databricks/appkit-ui/react';
import type { ReviewCard as ReviewCardType, VoteBody } from '../../../../shared/contracts';
import { AssetTypeBadge } from './AssetTypeBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ExampleQuestions } from './ExampleQuestions';
import { LogicView } from './LogicView';
import { ProgressBar } from './ProgressBar';
import { QueryPreview } from './QueryPreview';
import { SynonymChips } from './SynonymChips';
import { SwipeActions } from './SwipeActions';

interface ReviewCardProps {
  card: ReviewCardType;
  onVote: (body: VoteBody) => void;
  disabled?: boolean;
}

export function ReviewCard({ card, onVote, disabled }: ReviewCardProps) {
  const { asset } = card;

  const submit = (body: VoteBody) => {
    onVote(body);
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-sm rounded-xl border">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <AssetTypeBadge type={asset.assetType} />
          <Badge variant="outline" className="capitalize">{asset.status.toLowerCase()}</Badge>
          {asset.domain && (
            <span className="text-xs text-muted-foreground">
              {asset.domain}{asset.subdomain ? ` / ${asset.subdomain}` : ''}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold leading-tight">
          {asset.displayName || asset.name}
        </h3>
        {card.campaign && (
          <Badge variant="secondary" className="text-xs">
            {card.campaign.name}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {asset.description && (
          <p className="text-sm text-muted-foreground">{asset.description}</p>
        )}

        <ConfidenceMeter confidence={card.confidence} status={asset.status} />
        <ProgressBar reviewed={card.progress.reviewed} total={card.progress.total} />

        <SynonymChips assetId={asset.id} synonyms={card.synonyms} />
        <ExampleQuestions assetId={asset.id} examples={card.examples} />

        {/* Logic view: plain English + SQL/YAML definition behind disclosure */}
        <LogicView asset={asset} />

        <QueryPreview assetId={asset.id} />

        <SwipeActions
          onVote={(type) => submit({ assetId: asset.id, voteType: type })}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
