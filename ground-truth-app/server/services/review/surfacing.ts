// server/services/review/surfacing.ts — weighted-random card surfacing
// Session 06 · Wave 2 · No enum, no namespace, no default export

import type { SurfacingReason } from '../../../shared/contracts/review';

export interface Candidate {
  assetId: string;
  confidence: number;
  totalVotes: number;
  lastReviewedAt: string | null;
  inCampaign: boolean;
  isNewVersion: boolean;
}

const MS_PER_DAY = 86_400_000;

function daysSince(dateStr: string | null, now: Date): number {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr);
  return Math.max(0, (now.getTime() - then.getTime()) / MS_PER_DAY);
}

/**
 * Compute a surfacing weight for a candidate.
 * Higher weight = more likely to be shown.
 *
 * Formula: 0.5*(1 - confidence) + 0.25*staleness
 *        + 0.15*(1/(1+totalVotes)) + 0.1*(inCampaign || isNewVersion ? 1 : 0)
 *
 * where staleness = min(1, daysSince(lastReviewedAt) / stalenessDays).
 * Never reviewed → staleness = 1.
 */
export function surfacingWeight(
  c: Candidate,
  now: Date,
  stalenessDays: number,
): number {
  const days = daysSince(c.lastReviewedAt, now);
  const staleness = Math.min(1, days / stalenessDays);
  return (
    0.5 * (1 - c.confidence) +
    0.25 * staleness +
    0.15 * (1 / (1 + c.totalVotes)) +
    0.1 * (c.inCampaign || c.isNewVersion ? 1 : 0)
  );
}

/**
 * Pick one item from a weighted list using a provided RNG.
 * Returns null if the list is empty or all weights are zero.
 */
export function pickWeighted<T>(
  items: T[],
  weight: (t: T) => number,
  rng: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0] ?? null;
  const r = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Determine the reason a candidate was surfaced.
 */
export function reasonFor(c: Candidate): SurfacingReason {
  if (c.isNewVersion) return 'new_version';
  if (c.inCampaign) return 'campaign';
  if (c.confidence < 0.3) return 'low_confidence';
  if (c.lastReviewedAt === null) return 'low_confidence';
  return 'stale';
}
