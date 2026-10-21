// server/services/review/surfacing.test.ts
// Session 06 · Wave 2 · Vitest unit tests (pure, no DB)

import { describe, it, expect } from 'vitest';
import {
  surfacingWeight,
  pickWeighted,
  reasonFor,
} from './surfacing';
import type { Candidate } from './surfacing';

const NOW = new Date('2026-10-21T12:00:00Z');
const STALENESS_DAYS = 90;

describe('surfacingWeight', () => {
  it('never-reviewed low-confidence outranks certified fresh', () => {
    const neverReviewed: Candidate = {
      assetId: 'a',
      confidence: 0.1,
      totalVotes: 0,
      lastReviewedAt: null,
      inCampaign: false,
      isNewVersion: false,
    };
    const certifiedFresh: Candidate = {
      assetId: 'b',
      confidence: 0.95,
      totalVotes: 20,
      lastReviewedAt: '2026-10-20T12:00:00Z', // yesterday
      inCampaign: false,
      isNewVersion: false,
    };

    const wNever = surfacingWeight(neverReviewed, NOW, STALENESS_DAYS);
    const wCertified = surfacingWeight(certifiedFresh, NOW, STALENESS_DAYS);

    // Never-reviewed: 0.5*(1-0.1) + 0.25*1 + 0.15*(1/1) + 0.1*0
    //               = 0.45 + 0.25 + 0.15 + 0 = 0.85
    // Certified fresh: 0.5*(1-0.95) + 0.25*(1/90) + 0.15*(1/21) + 0.1*0
    //                = 0.025 + ~0.0028 + ~0.0071 + 0 ≈ 0.035
    expect(wNever).toBeGreaterThan(wCertified);
  });

  it('campaign membership adds 0.1 to weight', () => {
    const base: Candidate = {
      assetId: 'a',
      confidence: 0.5,
      totalVotes: 5,
      lastReviewedAt: '2026-10-01T00:00:00Z',
      inCampaign: false,
      isNewVersion: false,
    };
    const withCampaign = { ...base, inCampaign: true };

    const wBase = surfacingWeight(base, NOW, STALENESS_DAYS);
    const wCampaign = surfacingWeight(withCampaign, NOW, STALENESS_DAYS);

    expect(wCampaign - wBase).toBeCloseTo(0.1, 5);
  });
});

describe('pickWeighted', () => {
  it('returns null for empty list', () => {
    expect(pickWeighted([], () => 1)).toBeNull();
  });

  it('picks deterministically with a fixed rng', () => {
    const items = ['a', 'b', 'c'];
    // Weights: a=1, b=2, c=3. Total=6.
    // rng=0.0 -> r=0.0, cumulative 1 at i=0 -> 'a'
    expect(
      pickWeighted(items, (x) => (x === 'a' ? 1 : x === 'b' ? 2 : 3), () => 0),
    ).toBe('a');

    // rng=0.5 -> r=3.0, cumulative: 1,3,6. At i=1, cum=3 > 3? No. At i=2, cum=6 > 3? Yes -> 'c'
    // Actually r < cumulative: r=3.0, cum at i=1=3, 3 < 3 is false. cum at i=2=6, 3 < 6 is true -> 'c'
    expect(
      pickWeighted(items, (x) => (x === 'a' ? 1 : x === 'b' ? 2 : 3), () => 0.5),
    ).toBe('c');

    // rng just below 1/6 -> r just below 1, cumulative 1 at i=0 -> 'a'
    expect(
      pickWeighted(items, (x) => (x === 'a' ? 1 : x === 'b' ? 2 : 3), () => 0.1),
    ).toBe('a');

    // rng = 0.2 -> r = 1.2, cum: 1 (no), 3 (yes) -> 'b'
    expect(
      pickWeighted(items, (x) => (x === 'a' ? 1 : x === 'b' ? 2 : 3), () => 0.2),
    ).toBe('b');
  });

  it('returns first item when all weights are zero', () => {
    expect(pickWeighted(['x', 'y'], () => 0)).toBe('x');
  });
});

describe('reasonFor', () => {
  it('returns new_version for new-version candidates', () => {
    const c: Candidate = {
      assetId: 'a',
      confidence: 0.9,
      totalVotes: 10,
      lastReviewedAt: '2026-10-20',
      inCampaign: false,
      isNewVersion: true,
    };
    expect(reasonFor(c)).toBe('new_version');
  });

  it('returns campaign for campaign candidates', () => {
    const c: Candidate = {
      assetId: 'a',
      confidence: 0.9,
      totalVotes: 10,
      lastReviewedAt: '2026-10-20',
      inCampaign: true,
      isNewVersion: false,
    };
    expect(reasonFor(c)).toBe('campaign');
  });

  it('returns low_confidence for low scores', () => {
    const c: Candidate = {
      assetId: 'a',
      confidence: 0.1,
      totalVotes: 2,
      lastReviewedAt: '2026-10-20',
      inCampaign: false,
      isNewVersion: false,
    };
    expect(reasonFor(c)).toBe('low_confidence');
  });

  it('returns low_confidence when never reviewed', () => {
    const c: Candidate = {
      assetId: 'a',
      confidence: 0.5,
      totalVotes: 0,
      lastReviewedAt: null,
      inCampaign: false,
      isNewVersion: false,
    };
    expect(reasonFor(c)).toBe('low_confidence');
  });

  it('returns stale for reviewed non-low-confidence assets', () => {
    const c: Candidate = {
      assetId: 'a',
      confidence: 0.6,
      totalVotes: 5,
      lastReviewedAt: '2026-01-01',
      inCampaign: false,
      isNewVersion: false,
    };
    expect(reasonFor(c)).toBe('stale');
  });
});
