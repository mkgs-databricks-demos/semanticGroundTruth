// shared/contracts/review.ts — ReviewCard shape for the card-swipe UX
// Session 01 · Wave 0 · No enum, no namespace, no default export

import type { Asset, AssetSynonym, ConfidenceScore, ExampleQuestion, ReviewSkip } from './entities';

export const SURFACING_REASONS = [
  'low_confidence',
  'stale',
  'new_version',
  'campaign',
  'random',
] as const;
export type SurfacingReason = (typeof SURFACING_REASONS)[number];

export interface ReviewCard {
  asset: Asset;
  synonyms: AssetSynonym[];
  examples: ExampleQuestion[];
  confidence: ConfidenceScore | null;
  campaign?: { campaignId: string; name: string };
  reason: SurfacingReason;
  progress: { reviewed: number; total: number };
  /**
   * True when this user skipped the card's asset before and it came back after
   * the skip cooldown (UI badge "You skipped this earlier"). The server always
   * sets it on cards from GET /api/review/next, vote/skip `next` and MCP
   * review_get_next (build 5 session 44); optional so older fixtures still type-check.
   */
  resurfacedFromSkip?: boolean;
}

// ── Skip: POST /api/review/skip, MCP review_skip_card (plan 25) ──────────
// A skip is not a vote: it never changes confidence or certification.

export interface SkipStats {
  skippedCount: number;
  skippedToday: number;
}

export interface SkipResponse {
  skip: ReviewSkip;
  stats: SkipStats;
}
