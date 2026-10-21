// server/services/review/wilsonScore.ts — pure Wilson score with industry prior
// Session 06 · Wave 2 · No enum, no namespace, no default export

import type { AssetStatus } from '../../../shared/contracts/values';

export interface ComputeConfidenceInput {
  approvals: number;
  rejections: number;
  edits: number;
}

export interface ComputeConfidenceSettings {
  wilsonZ: number;
  industryPrior: number;
  priorWeight: number;
  priorDecayThreshold: number;
}

export interface ComputeConfidenceResult {
  score: number;
  total: number;
  priorApplied: boolean;
}

export interface DeriveStatusSettings {
  certificationThreshold: number;
  minVotesForCertification: number;
}

/**
 * Wilson lower-bound confidence interval for a binomial proportion.
 * Returns 0 when total <= 0; clamps result to [0, 1].
 */
export function wilsonLowerBound(
  positive: number,
  total: number,
  z: number,
): number {
  if (total <= 0) return 0;
  const p = positive / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const lower = (centre - margin) / denominator;
  return Math.max(0, Math.min(1, lower));
}

/**
 * Compute confidence score with an industry prior that decays as votes grow.
 * Edits count as 0.5 approval.
 */
export function computeConfidence(
  input: ComputeConfidenceInput,
  s: ComputeConfidenceSettings,
): ComputeConfidenceResult {
  const total = input.approvals + input.rejections + input.edits;
  const w =
    total >= s.priorDecayThreshold
      ? 0
      : s.priorWeight * (1 - total / s.priorDecayThreshold);
  const priorApplied = w > 0;
  const adjustedPositive =
    input.approvals + 0.5 * input.edits + s.industryPrior * w;
  const adjustedTotal = total + w;
  const score = wilsonLowerBound(adjustedPositive, adjustedTotal, s.wilsonZ);
  return { score, total, priorApplied };
}

/**
 * Derive asset status from confidence score and vote count.
 */
export function deriveStatus(
  score: number,
  total: number,
  s: DeriveStatusSettings,
): AssetStatus {
  if (
    score >= s.certificationThreshold &&
    total >= s.minVotesForCertification
  ) {
    return 'CERTIFIED';
  }
  if (total >= 1) {
    return 'REVIEWED';
  }
  return 'PENDING';
}
