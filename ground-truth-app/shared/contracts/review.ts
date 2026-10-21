// shared/contracts/review.ts — ReviewCard shape for the card-swipe UX
// Session 01 · Wave 0 · No enum, no namespace, no default export

import type { Asset, AssetSynonym, ConfidenceScore, ExampleQuestion } from './entities';

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
}
