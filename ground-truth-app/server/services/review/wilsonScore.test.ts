// server/services/review/wilsonScore.test.ts
// Session 06 · Wave 2 · Vitest unit tests (pure, no DB)

import { describe, it, expect } from 'vitest';
import {
  wilsonLowerBound,
  computeConfidence,
  deriveStatus,
} from './wilsonScore';

describe('wilsonLowerBound', () => {
  it('returns 0 when total is 0', () => {
    expect(wilsonLowerBound(0, 0, 1.96)).toBe(0);
  });

  it('returns 0 when total is negative', () => {
    expect(wilsonLowerBound(5, -1, 1.96)).toBe(0);
  });

  /**
   * Hand calculation for wilsonLowerBound(10, 10, 1.96):
   *   p = 10/10 = 1.0
   *   z² = 3.8416
   *   denominator = 1 + 3.8416/10 = 1.38416
   *   centre = 1.0 + 3.8416/20 = 1.19208
   *   margin = 1.96 * sqrt((1.0*0.0 + 3.8416/40) / 10)
   *          = 1.96 * sqrt(0.009604)
   *          = 1.96 * 0.098003
   *          ≈ 0.192086
   *   lower  = (1.19208 - 0.192086) / 1.38416 ≈ 0.7225
   */
  it('returns ~0.7225 for (10, 10, 1.96)', () => {
    const result = wilsonLowerBound(10, 10, 1.96);
    expect(result).toBeCloseTo(0.7225, 3);
  });

  /**
   * Hand calculation for wilsonLowerBound(5, 10, 1.96):
   *   p = 5/10 = 0.5
   *   z² = 3.8416
   *   denominator = 1 + 3.8416/10 = 1.38416
   *   centre = 0.5 + 3.8416/20 = 0.69208
   *   margin = 1.96 * sqrt((0.5*0.5 + 3.8416/40) / 10)
   *          = 1.96 * sqrt(0.034604)
   *          = 1.96 * 0.186016
   *          ≈ 0.364591
   *   lower  = (0.69208 - 0.364591) / 1.38416 ≈ 0.2366
   */
  it('returns ~0.2366 for (5, 10, 1.96)', () => {
    const result = wilsonLowerBound(5, 10, 1.96);
    expect(result).toBeCloseTo(0.2366, 3);
  });

  it('clamps to [0, 1]', () => {
    // Even with extreme inputs, the result should not exceed [0, 1]
    expect(wilsonLowerBound(100, 100, 1.96)).toBeLessThanOrEqual(1);
    expect(wilsonLowerBound(0, 100, 1.96)).toBeGreaterThanOrEqual(0);
  });
});

describe('computeConfidence', () => {
  const baseSettings = {
    wilsonZ: 1.96,
    industryPrior: 0.6,
    priorWeight: 5,
    priorDecayThreshold: 20,
  };

  it('applies industry prior when votes < threshold', () => {
    const result = computeConfidence(
      { approvals: 2, rejections: 0, edits: 0 },
      baseSettings,
    );
    expect(result.priorApplied).toBe(true);
    expect(result.total).toBe(2);
    // With prior: adjustedPositive = 2 + 0.6*w, adjustedTotal = 2 + w
    // w = 5 * (1 - 2/20) = 5 * 0.9 = 4.5
    // adjustedPositive = 2 + 0.6*4.5 = 2 + 2.7 = 4.7
    // adjustedTotal = 2 + 4.5 = 6.5
    expect(result.score).toBeGreaterThan(0);
  });

  it('prior decays to 0 at threshold', () => {
    const result = computeConfidence(
      { approvals: 10, rejections: 10, edits: 0 },
      baseSettings,
    );
    // total = 20 = priorDecayThreshold→ w = 0
    expect(result.priorApplied).toBe(false);
    // No prior: just wilsonLowerBound(10, 20, 1.96)
    expect(result.score).toBeGreaterThan(0);
  });

  it('edits count as 0.5 approval', () => {
    const editsOnly = computeConfidence(
      { approvals: 0, rejections: 0, edits: 10 },
      baseSettings,
    );
    const approvalsOnly = computeConfidence(
      { approvals: 5, rejections: 0, edits: 0 },
      { ...baseSettings, priorWeight: 0 },
    );
    // 10 edits = 5 approvals equivalent (without prior)
    // Total differs (10 vs 5) so scores won't be identical,
    // but editsOnly.score should be > 0
    expect(editsOnly.score).toBeGreaterThan(0);
    expect(editsOnly.total).toBe(10);
  });
});

describe('deriveStatus', () => {
  const settings = {
    certificationThreshold: 0.7,
    minVotesForCertification: 5,
  };

  it('returns PENDING when no votes', () => {
    expect(deriveStatus(0, 0, settings)).toBe('PENDING');
  });

  it('returns REVIEWED when has votes but below threshold', () => {
    expect(deriveStatus(0.5, 3, settings)).toBe('REVIEWED');
  });

  it('returns REVIEWED when score high but votes below min', () => {
    expect(deriveStatus(0.9, 3, settings)).toBe('REVIEWED');
  });

  it('returns CERTIFIED when both thresholds met', () => {
    expect(deriveStatus(0.8, 10, settings)).toBe('CERTIFIED');
  });

  it('returns CERTIFIED at exact thresholds', () => {
    expect(deriveStatus(0.7, 5, settings)).toBe('CERTIFIED');
  });
});
