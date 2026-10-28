// @a11y-strict
// client/src/pages/review/ReviewPage.tsx — S1 Review, the signature screen at /
// Session 17 · Wave 1 · updated keyboard hint, skip handling
// Session 51 · Build 5 · wave 5-2 · Figma export layout and every S1 state (screen_inventory S1):
//   loading · populated · empty · error (F3: GET /api/review/next failure is NOT the empty state)
//   · vote-error (card stays, toast) · offline (actions disabled with a reason, no request)
//   · session-complete (after UserSettings.cardsPerSession votes + skips) · resurfaced badge.
// Skip (F5) is POST /api/review/skip, never a vote; Shift+S or the chevron picks a reason.
// Keyboard (KB K1): A/→ approve, R/← reject, E/↑ edit, S skip, Shift+S reason, 1-4 choose,
// L logic, ? help; ignored while typing or while a sheet / dialog is open.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import {
  ASSET_TYPES,
  CARDS_PER_SESSION_DEFAULT,
  SKIP_COOLDOWN_HOURS_DEFAULT,
  SKIP_REASONS,
} from '../../../../shared/contracts';
import type { AssetType, GetNextQuery, SkipReason, UserSettings, VoteBody } from '../../../../shared/contracts';
import {
  useMySettings,
  useNextCard,
  useReviewSessionStats,
  useSkipCard,
  useSubmitVote,
  useUserStats,
} from '../../lib/api/hooks';
import { ApiError } from '../../lib/api/http';
import { queryKeys } from '../../lib/api/keys';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { AssetTypeFilter } from '../../components/review/AssetTypeFilter';
import { CampaignSelector } from '../../components/review/CampaignSelector';
import { CardStack } from '../../components/review/CardStack';
import { EditSheet } from '../../components/review/EditSheet';
import type { ProposedEdits } from '../../components/review/EditSheet';
import { EmptyState } from '../../components/review/EmptyState';
import { prefersReducedMotion } from '../../components/review/media';
import { RejectSheet } from '../../components/review/RejectSheet';
import { ReviewCard } from '../../components/review/ReviewCard';
import { SessionComplete } from '../../components/review/SessionComplete';
import { ShortcutHelpDialog } from '../../components/review/ShortcutHelpDialog';
import { SkipReasonPicker } from '../../components/review/SkipReasonPicker';
import { StreakBadge } from '../../components/review/StreakBadge';
import { VoteBar } from '../../components/review/VoteBar';
import type { ReviewAction } from '../../components/review/VoteBar';
import { Icon, InlineAlert, Skeleton, ToastRegion, useToasts } from '../../components/ui';

export const OFFLINE_REASON = "You're offline. Votes and edits are paused until the connection is back.";
export const VOTE_ERROR_TOAST = "Your vote wasn't saved. Try again.";
export const SKIP_ERROR_TOAST = "Your skip wasn't saved. Try again.";

/** Live-region verbs (brief S1: "Approved Readmission Rate (30-day)"). */
const ANNOUNCE_VERB: Record<ReviewAction, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  edit: 'Edit sent for',
  skip: 'Skipped',
};

type Overlay = 'reject' | 'edit' | 'help' | null;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value);
}

export function ReviewPage() {
  const settings = useMySettings();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="sr-only md:not-sr-only md:text-[32px] md:font-bold md:leading-tight">Review</h1>
      {settings.isPending ? <ReviewSkeleton /> : <ReviewQueue settings={settings.data} />}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the next card</span>
      <Skeleton className="h-96 w-full rounded-xl" />
      <div className="flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}

function NextCardError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const detail =
    error instanceof ApiError ? `${error.code}: ${error.message}` : 'Check your connection, then try again.';
  return (
    <InlineAlert title="We couldn't load the next card.">
      <p className="font-mono">{detail}</p>
      <Button
        variant="outline"
        size="sm"
        data-testid="review-error-retry"
        className="mt-2 min-h-[44px] gap-1.5"
        disabled={retrying}
        onClick={onRetry}
      >
        <Icon name="refresh" size={16} />
        Retry
      </Button>
    </InlineAlert>
  );
}

/** Everything below the page heading; mounted once GET /api/me/settings settled (filter defaults). */
function ReviewQueue({ settings }: { settings: UserSettings | undefined }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL wins; a missing param falls back to the saved default; '' means "All" explicitly.
  const campaignParam = searchParams.get('campaignId');
  const typeParam = searchParams.get('assetType');
  const campaignId = campaignParam === null ? settings?.defaultCampaignId ?? undefined : campaignParam || undefined;
  const rawType = typeParam === null ? settings?.defaultAssetType ?? undefined : typeParam || undefined;
  const assetType = rawType && isAssetType(rawType) ? rawType : undefined;
  const params = useMemo<GetNextQuery>(
    () => ({ ...(campaignId ? { campaignId } : {}), ...(assetType ? { assetType } : {}) }),
    [campaignId, assetType],
  );
  const setFilter = (key: 'campaignId' | 'assetType', value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value ?? '');
        return next;
      },
      { replace: true },
    );
  };

  const next = useNextCard(params);
  const stats = useUserStats();
  const session = useReviewSessionStats();
  const vote = useSubmitVote();
  const skipMutation = useSkipCard();
  const online = useOnlineStatus();
  const { toasts, push, dismiss } = useToasts();

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [logicOpen, setLogicOpen] = useState(false);
  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [skippedToday, setSkippedToday] = useState<number | null>(null);

  const rejectRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const reasonTriggerRef = useRef<HTMLButtonElement>(null);
  const campaignRef = useRef<HTMLSelectElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prevOverlayRef = useRef<Overlay>(null);

  const card = next.data ?? null;
  const assetId = card?.asset.id;
  const cardLabel = card ? card.asset.displayName || card.asset.name : '';
  const cardsPerSession = settings?.cardsPerSession ?? CARDS_PER_SESSION_DEFAULT;
  const sessionComplete = session.total >= cardsPerSession;
  const reducedMotion = settings?.motion === 'reduce' || prefersReducedMotion();
  const showHints = settings?.showKeyboardHints ?? true;
  // GET /api/config does not expose skip_cooldown_hours yet (request in the session-51 status file).
  const cooldownHours = SKIP_COOLDOWN_HOURS_DEFAULT;
  const refetchingCard = next.isFetching && !next.isPending;
  const canAct = card !== null && !sessionComplete && online && pending === null && !refetchingCard;

  // A new card starts with Logic closed and no open popover.
  useEffect(() => {
    setLogicOpen(false);
    setReasonsOpen(false);
  }, [assetId]);

  const announce = useCallback((text: string) => setAnnouncement(text), []);

  const sendVote = useCallback(
    (body: VoteBody, action: ReviewAction) => {
      const label = cardLabel;
      setPending(action);
      vote.mutate(body, {
        onSuccess: (result) => {
          if (result.next !== undefined) queryClient.setQueryData(queryKeys.nextCard(params), result.next);
          else void queryClient.invalidateQueries({ queryKey: ['review', 'next'] });
          setOverlay(null);
          announce(`${ANNOUNCE_VERB[action]} ${label}`);
        },
        onError: () => push({ title: VOTE_ERROR_TOAST, tone: 'error' }),
        onSettled: () => setPending(null),
      });
    },
    [vote, queryClient, params, cardLabel, announce, push],
  );

  const approve = useCallback(() => {
    if (!canAct || !assetId) return;
    setReasonsOpen(false);
    sendVote({ assetId, voteType: 'approve' }, 'approve');
  }, [canAct, assetId, sendVote]);

  const openSheet = useCallback(
    (kind: 'reject' | 'edit') => {
      if (!canAct) return;
      setReasonsOpen(false);
      returnFocusRef.current = (kind === 'reject' ? rejectRef : editRef).current;
      setOverlay(kind);
    },
    [canAct],
  );

  // The AppKit sheet / dialog only restores focus to a Radix <Trigger>; these open from
  // shortcuts and controlled state, so return focus ourselves on close (KB K1: Esc -> Reject).
  useEffect(() => {
    if (prevOverlayRef.current !== null && overlay === null) {
      const target = returnFocusRef.current;
      if (target?.isConnected && !target.hasAttribute('disabled')) target.focus();
    }
    prevOverlayRef.current = overlay;
  }, [overlay]);

  const submitReject = (feedback: string | undefined) => {
    if (!assetId || !online) return;
    sendVote({ assetId, voteType: 'reject', ...(feedback ? { feedback } : {}) }, 'reject');
  };
  const submitEdit = (edits: ProposedEdits) => {
    if (!assetId || !online) return;
    sendVote({ assetId, voteType: 'edit', edits }, 'edit');
  };

  const skip = useCallback(
    (reason?: SkipReason) => {
      if (!canAct || !card) return;
      const label = cardLabel;
      setReasonsOpen(false);
      setPending('skip');
      skipMutation.mutate(
        {
          assetId: card.asset.id,
          ...(card.campaign ? { campaignId: card.campaign.campaignId } : {}),
          ...(reason ? { reason } : {}),
        },
        {
          onSuccess: (res) => {
            setSkippedToday(res.stats.skippedToday);
            announce(`${ANNOUNCE_VERB.skip} ${label}`);
            push({ title: `Skipped. You'll see it again in ${cooldownHours} h` });
          },
          onError: () => push({ title: SKIP_ERROR_TOAST, tone: 'error' }),
          onSettled: () => setPending(null),
        },
      );
    },
    [canAct, card, cardLabel, skipMutation, announce, push, cooldownHours],
  );

  const chooseReason = useCallback(
    (reason: SkipReason) => {
      reasonTriggerRef.current?.focus();
      skip(reason);
    },
    [skip],
  );

  const toggleReasons = useCallback(() => {
    if (!canAct) return;
    setReasonsOpen((open) => !open);
  }, [canAct]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || overlay !== null) return;
      if (reasonsOpen) {
        const index = ['1', '2', '3', '4'].indexOf(e.key);
        if (index >= 0) {
          e.preventDefault();
          chooseReason(SKIP_REASONS[index]);
        }
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOverlay('help');
        return;
      }
      if (!card || sessionComplete) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      switch (key) {
        case 'a':
        case 'ArrowRight':
          e.preventDefault();
          approve();
          break;
        case 'r':
        case 'ArrowLeft':
          e.preventDefault();
          openSheet('reject');
          break;
        case 'e':
        case 'ArrowUp':
          e.preventDefault();
          openSheet('edit');
          break;
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            if (canAct) setReasonsOpen(true);
          } else {
            skip();
          }
          break;
        case 'l':
          e.preventDefault();
          setLogicOpen((open) => !open);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, reasonsOpen, card, sessionComplete, canAct, approve, openSheet, skip, chooseReason]);

  const skipCount = skippedToday ?? stats.data?.skippedToday;

  let body;
  if (next.isPending) {
    body = <ReviewSkeleton />;
  } else if (next.isError) {
    body = <NextCardError error={next.error} onRetry={() => void next.refetch()} retrying={next.isFetching} />;
  } else if (sessionComplete) {
    body = <SessionComplete reviewed={session.reviewed} skipped={session.skipped} onKeepGoing={session.reset} />;
  } else if (!card) {
    body = <EmptyState campaignFiltered={campaignId !== undefined} onSwitchCampaign={() => campaignRef.current?.focus()} />;
  } else {
    body = (
      <>
        <CardStack
          cardKey={card.asset.id}
          reducedMotion={reducedMotion}
          disabled={!canAct}
          onSwipe={(direction) => (direction === 'approve' ? approve() : openSheet('reject'))}
        >
          <ReviewCard
            card={card}
            logicOpen={logicOpen}
            onLogicToggle={() => setLogicOpen((open) => !open)}
            readOnly={!online}
          />
        </CardStack>
        <VoteBar
          onApprove={approve}
          onReject={() => openSheet('reject')}
          onEdit={() => openSheet('edit')}
          onSkip={() => skip()}
          onToggleReasons={toggleReasons}
          pending={pending}
          disabledReason={online ? null : OFFLINE_REASON}
          busy={refetchingCard}
          showHints={showHints}
          reasonsOpen={reasonsOpen}
          rejectRef={rejectRef}
          editRef={editRef}
          reasonTriggerRef={reasonTriggerRef}
          picker={
            <SkipReasonPicker
              open={reasonsOpen}
              onClose={() => setReasonsOpen(false)}
              triggerRef={reasonTriggerRef}
              onChoose={chooseReason}
              cooldownHours={cooldownHours}
            />
          }
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <CampaignSelector value={campaignId} onChange={(v) => setFilter('campaignId', v)} selectRef={campaignRef} />
        <AssetTypeFilter value={assetType} onChange={(v) => setFilter('assetType', v)} />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <StreakBadge />
          {skipCount !== undefined ? (
            <span data-testid="review-skip-counter" className="text-muted-foreground tabular-nums">
              Skipped today: {skipCount}
            </span>
          ) : null}
        </div>
      </div>

      {body}

      {card ? (
        <>
          <RejectSheet
            open={overlay === 'reject'}
            onOpenChange={(open) => setOverlay(open ? 'reject' : null)}
            assetName={cardLabel}
            onSubmit={submitReject}
            submitting={pending === 'reject'}
          />
          <EditSheet
            open={overlay === 'edit'}
            onOpenChange={(open) => setOverlay(open ? 'edit' : null)}
            asset={card.asset}
            onSubmit={submitEdit}
            submitting={pending === 'edit'}
          />
        </>
      ) : null}
      <ShortcutHelpDialog open={overlay === 'help'} onOpenChange={(open) => setOverlay(open ? 'help' : null)} />

      <p className="sr-only" aria-live="polite" data-testid="review-live-region">
        {announcement}
      </p>
      <ToastRegion toasts={toasts} onDismiss={dismiss} label="Review messages" />
    </>
  );
}
