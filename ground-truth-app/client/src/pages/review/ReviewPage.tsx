// client/src/pages/review/ReviewPage.tsx — primary review experience at /
// Session 12 · Wave 4 · No enum, no namespace, no default export

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Skeleton } from '@databricks/appkit-ui/react';
import type { AssetType, VoteBody } from '../../../../shared/contracts';
import { useNextCard, useSubmitVote, useUserStats } from '../../lib/api/hooks';
import { AssetTypeFilter } from '../../components/review/AssetTypeFilter';
import { CampaignSelector } from '../../components/review/CampaignSelector';
import { CardStack } from '../../components/review/CardStack';
import { EditSheet } from '../../components/review/EditSheet';
import { EmptyState } from '../../components/review/EmptyState';
import { RejectSheet } from '../../components/review/RejectSheet';
import { StreakBadge } from '../../components/review/StreakBadge';

export function ReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId') ?? undefined;
  const assetType = (searchParams.get('assetType') as AssetType | null) ?? undefined;

  const setCampaignId = (id: string | undefined) => {
    setSearchParams((prev) => {
      if (id) prev.set('campaignId', id); else prev.delete('campaignId');
      return prev;
    });
  };
  const setAssetType = (type: AssetType | undefined) => {
    setSearchParams((prev) => {
      if (type) prev.set('assetType', type); else prev.delete('assetType');
      return prev;
    });
  };

  const params = { campaignId, assetType };
  const { data: card, isLoading } = useNextCard(params);
  const vote = useSubmitVote();
  const { data: statsBefore } = useUserStats();
  const prevBadgeCount = useRef(statsBefore?.currentStreakDays ?? 0);

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Unified submit function for all vote paths (swipe, button, keyboard, sheets)
  const submit = useCallback(
    (body: VoteBody) => {
      // If the vote type needs a sheet, open it instead
      if (body.voteType === 'edit' && !body.edits) {
        setEditOpen(true);
        return;
      }
      if (body.voteType === 'reject' && body.feedback === undefined && !rejectOpen) {
        setRejectOpen(true);
        return;
      }

      vote.mutate(body, {
        onSuccess: () => {
          setEditOpen(false);
          setRejectOpen(false);
          // Toast on milestone badge change
          // (stats will refetch via invalidation; compare on next render)
        },
      });
    },
    [vote, rejectOpen],
  );

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Filters + streak */}
      <div className="flex items-center gap-2 flex-wrap">
        <CampaignSelector value={campaignId} onChange={setCampaignId} />
        <AssetTypeFilter value={assetType} onChange={setAssetType} />
        <div className="ml-auto">
          <StreakBadge />
        </div>
      </div>

      {/* Card or loading/empty */}
      {isLoading && (
        <Skeleton className="h-96 w-full rounded-xl" />
      )}
      {!isLoading && !card && <EmptyState />}
      {!isLoading && card && (
        <CardStack card={card} onVote={submit} disabled={vote.isPending} />
      )}

      {/* Edit sheet */}
      {card && (
        <EditSheet
          card={card}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={submit}
          disabled={vote.isPending}
        />
      )}

      {/* Reject sheet */}
      {card && (
        <RejectSheet
          assetId={card.asset.id}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onSubmit={submit}
          disabled={vote.isPending}
        />
      )}

      {/* Keyboard shortcut hint */}
      <p className="text-center text-xs text-muted-foreground hidden md:block">
        Keyboard: ← reject · → approve · E edit
      </p>
    </div>
  );
}
