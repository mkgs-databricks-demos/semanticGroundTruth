// client/src/components/review/CardStack.tsx — framer-motion drag + keyboard swipe
// Session 12 · Wave 4 · respects prefers-reduced-motion

import { useCallback, useEffect } from 'react';
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

interface CardStackProps {
  card: ReviewCardType;
  onVote: (body: VoteBody) => void;
  disabled?: boolean;
}

export function CardStack({ card, onVote, disabled }: CardStackProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);

  const submit = useCallback(
    (body: VoteBody) => {
      onVote(body);
    },
    [onVote],
  );

  const swipeVote = useCallback(
    (type: VoteType) => {
      submit({ assetId: card.asset.id, voteType: type });
    },
    [submit, card.asset.id],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      // Don't capture if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight') { e.preventDefault(); swipeVote('approve'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); swipeVote('reject'); }
      else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); swipeVote('edit'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [swipeVote, disabled]);

  const reducedMotion = prefersReducedMotion();

  return (
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
        className="touch-none"
      >
        <ReviewCard card={card} onVote={submit} disabled={disabled} />
      </motion.div>
    </AnimatePresence>
  );
}
