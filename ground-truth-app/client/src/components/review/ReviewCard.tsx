// client/src/components/review/ReviewCard.tsx
// Session 12 · Wave 4

import { useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReviewCard as ReviewCardType, VoteBody } from '../../../../shared/contracts';
import { AssetTypeBadge } from './AssetTypeBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ExampleQuestions } from './ExampleQuestions';
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
  const [yamlOpen, setYamlOpen] = useState(false);
  const { asset } = card;

  const submit = (body: VoteBody) => {
    onVote(body);
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
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
        <h3 className="text-lg font-semibold leading-tight">
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
        {asset.plainEnglishLogic && (
          <div className="text-sm">
            <p className="font-medium text-xs text-muted-foreground mb-1">Plain-English logic</p>
            <p>{asset.plainEnglishLogic}</p>
          </div>
        )}

        <ConfidenceMeter confidence={card.confidence} status={asset.status} />
        <ProgressBar reviewed={card.progress.reviewed} total={card.progress.total} />

        <SynonymChips assetId={asset.id} synonyms={card.synonyms} />
        <ExampleQuestions assetId={asset.id} examples={card.examples} />

        {/* Collapsible YAML */}
        {asset.yamlContent && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setYamlOpen(!yamlOpen)}
              aria-expanded={yamlOpen}
              aria-label="Toggle YAML preview"
            >
              {yamlOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              YAML
            </Button>
            {yamlOpen && (
              <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-48">
                {asset.yamlContent}
              </pre>
            )}
          </div>
        )}

        <QueryPreview assetId={asset.id} />

        <SwipeActions
          onVote={(type) => submit({ assetId: asset.id, voteType: type })}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
