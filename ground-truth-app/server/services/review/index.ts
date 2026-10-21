// server/services/review/index.ts — barrel
// Session 06 · Wave 2 · No enum, no namespace, no default export

export {
  wilsonLowerBound,
  computeConfidence,
  deriveStatus,
} from './wilsonScore';
export type {
  ComputeConfidenceInput,
  ComputeConfidenceSettings,
  ComputeConfidenceResult,
  DeriveStatusSettings,
} from './wilsonScore';

export { surfacingWeight, pickWeighted, reasonFor } from './surfacing';
export type { Candidate } from './surfacing';

export { nextStreak, BADGES, earnedBadges } from './gamification';
export type { StreakResult } from './gamification';

export { buildValidationQuery } from './validationQuery';

export { ReviewEngine } from './reviewEngine';
