// @a11y-strict
// client/src/components/review/CardStack.tsx — framer-motion swipe wrapper around the review card
// Session 17 · Wave 1 · vote-token overlay tint, ArrowUp=edit, S=skip, aria-live
// Session 33 · Wave 4-1 · S / Skip button call POST /api/review/skip (skip is not a vote)
// Session 51 · Build 5 · wave 5-2 · swipe only: keyboard shortcuts, votes, skips and the live region
// moved to ReviewPage. Right = approve (12% --vote-approve tint + check), left = reject (opens the
// Reject sheet). Reduced motion (OS or UserSettings.motion 'reduce'): a plain container with no
// drag handlers and no enter/exit animation (ui_test_strategy §7.4).

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Icon } from '../ui';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 600;

export type SwipeDirection = 'approve' | 'reject';

interface CardStackProps {
  /** Changes when the card changes (asset id): drives the enter / exit animation. */
  cardKey: string;
  reducedMotion: boolean;
  /** No swipe while offline, submitting or a sheet is open. */
  disabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  children: ReactNode;
}

export function CardStack({ cardKey, reducedMotion, disabled, onSwipe, children }: CardStackProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const approveOpacity = useTransform(x, [0, 60, 300], [0, 0, 1]);
  const rejectOpacity = useTransform(x, [-300, -60, 0], [1, 0, 0]);

  if (reducedMotion) {
    return (
      <div key={cardKey} data-motion="reduced" className="relative">
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={cardKey}
        data-motion="full"
        className="relative"
        style={{ x, rotate }}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={(_e, info) => {
          if (disabled) return;
          const { offset, velocity } = info;
          if (offset.x > SWIPE_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) onSwipe('approve');
          else if (offset.x < -SWIPE_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) onSwipe('reject');
        }}
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={{ duration: 0.18 }}
      >
        {children}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-vote-approve/10 text-vote-approve"
          style={{ opacity: approveOpacity }}
        >
          <Icon name="check" size={72} />
        </motion.div>
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-vote-reject/10 text-vote-reject"
          style={{ opacity: rejectOpacity }}
        >
          <Icon name="close" size={72} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
