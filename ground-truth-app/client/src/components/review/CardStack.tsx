// client/src/components/review/CardStack.tsx — framer-motion drag + keyboard swipe
// Session 17 · Wave 1 · vote-token overlay tint, ArrowUp=edit, S=skip, aria-live

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { ReviewCard as ReviewCardType, VoteBody, VoteType } from '../../../../shared/contracts';
import { ReviewCard } from './ReviewCard';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 600;

/** True if the user prefers reduced motion. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Map vote type to semantic CSS variable for overlay tint. */
function overlayVar(type: VoteType): string {
  switch (type) {
    case 'approve': return 'var(--vote-approve)';
    case 'reject': return 'var(--vote-reject)';
    case 'edit': return 'var(--vote-edit)';
    case 'skip': return 'var(--vote-skip)';
    default: return 'transparent';
  }
}

interface CardStackProps {
  card: ReviewCardType;
  onVote: (body: VoteBody) => void;
  disabled?: boolean;
}

export function CardStack({ card, onVote, disabled }: CardStackProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);
  const overlayOpacity = useTransform(x, [-300, -60, 0, 60, 300], [0.12, 0, 0, 0, 0.12]);
  const overlayColor = useTransform(x, (v) =>
    v > 20 ? overlayVar('approve') : v < -20 ? overlayVar('reject') : 'transparent',
  );

  const [announcement, setAnnouncement] = useState('');
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const announce = useCallback((text: string) => {
    setAnnouncement(text);
    clearTimeout(announcementTimeoutRef.current);
    announcementTimeoutRef.current = setTimeout(() => setAnnouncement(''), 3000);
  }, []);

  const submit = useCallback(
    (body: VoteBody) => {
      const label = card.asset.displayName || card.asset.name;
      const action =
        body.voteType === 'approve' ? 'Approved' :
        body.voteType === 'reject' ? 'Rejected' :
        body.voteType === 'edit' ? 'Editing' :
        'Skipped';
      announce(`${action} ${label}`);
      onVote(body);
    },
    [onVote, card.asset.displayName, card.asset.name, announce],
  );

  const swipeVote = useCallback(
    (type: VoteType) => {
      submit({ assetId: card.asset.id, voteType: type });
    },
    [submit, card.asset.id],
  );

  // Keyboard shortcuts: ← reject, → approve, ↑ edit, S skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight') { e.preventDefault(); swipeVote('approve'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); swipeVote('reject'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); swipeVote('edit'); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); swipeVote('skip'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [swipeVote, disabled]);

  useEffect(() => {
    return () => clearTimeout(announcementTimeoutRef.current);
  }, []);

  const reducedMotion = prefersReducedMotion();

  return (
    <>
      {/* sr-only keyboard hint */}
      <p className="sr-only">
        Keyboard shortcuts: left arrow reject, right arrow approve, up arrow edit, S skip.
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.asset.id}
          style={reducedMotion ? {} : { x, rotate, opacity }}
          drag={reducedMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragEnd={(_e, info) => {
            if (disabled) return;
            const offset = info.offset.x;
            const velocity = info.velocity.x;
            if (offset > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
              swipeVote('approve');
            } else if (offset < -SWIPE_THRESHOLD || velocity < -VELOCITY_THRESHOLD) {
              swipeVote('reject');
            }
          }}
          initial={reducedMotion ? {} : { scale: 0.95, opacity: 0 }}
          animate={reducedMotion ? {} : { scale: 1, opacity: 1 }}
          exit={reducedMotion ? {} : { opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="touch-none relative"
        >
          {/* Swipe overlay tint */}
          {!reducedMotion && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{ backgroundColor: overlayColor, opacity: overlayOpacity }}
            />
          )}
          <ReviewCard card={card} onVote={submit} disabled={disabled} />
        </motion.div>
      </AnimatePresence>

      {/* Live region announcing the last vote */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
