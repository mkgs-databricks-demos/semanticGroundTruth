// @a11y-strict
// client/src/components/review/SessionComplete.tsx — S1 session-complete panel
// Session 51 · Build 5 · wave 5-2. Shown after UserSettings.cardsPerSession votes + skips
// (useReviewSessionStats, session 49). "Keep going" starts a new session; focus moves to
// it when the panel appears, because the vote bar that had focus is gone.

import { useEffect, useId, useRef } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { Link } from 'react-router';
import { Icon } from '../ui';

interface SessionCompleteProps {
  reviewed: number;
  skipped: number;
  onKeepGoing: () => void;
}

export function SessionComplete({ reviewed, skipped, onKeepGoing }: SessionCompleteProps) {
  const titleId = useId();
  const keepGoingRef = useRef<HTMLButtonElement>(null);
  const total = reviewed + skipped;

  useEffect(() => {
    keepGoingRef.current?.focus();
  }, []);

  return (
    <section
      data-testid="review-session-complete-root"
      aria-labelledby={titleId}
      className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center text-card-foreground"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
        <Icon name="ranking" size={28} />
      </span>
      <h2 id={titleId} className="text-lg font-bold">
        Nice work, {total} {total === 1 ? 'card' : 'cards'} reviewed
      </h2>
      <p className="text-sm text-muted-foreground">Your feedback makes these definitions more useful.</p>
      <dl className="flex gap-8">
        <div className="flex flex-col-reverse items-center">
          <dt className="text-xs text-muted-foreground">reviewed</dt>
          <dd className="text-2xl font-bold tabular-nums">{reviewed}</dd>
        </div>
        <div className="flex flex-col-reverse items-center">
          <dt className="text-xs text-muted-foreground">skipped</dt>
          <dd className="text-2xl font-bold tabular-nums">{skipped}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          to="/leaderboard"
          className="inline-flex min-h-[44px] items-center rounded-md border border-input px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-ring"
        >
          Done for now
        </Link>
        <Button ref={keepGoingRef} className="min-h-[44px]" onClick={onKeepGoing}>
          Keep going
        </Button>
      </div>
    </section>
  );
}
