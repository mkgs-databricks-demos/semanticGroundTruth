// shared/contracts/config.ts — runtime config contract
// Session 20 · Wave 0 · No enum, no namespace, no default export

import { z } from 'zod';
import { SKIP_COOLDOWN_HOURS_MAX, SKIP_COOLDOWN_HOURS_MIN } from './values';

export const AppRuntimeConfigSchema = z.object({
  executive_dashboard_url: z.string().url().nullable(),
  /**
   * Share to Slack is available (G5 Option A). Session 50 maps it to the
   * GT_SLACK_SHARE_ENABLED flag; the UI shows the action only for
   * steward/admin when true (build 5 session 44).
   */
  slackShareEnabled: z.boolean(),
});

export type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

// ── Admin scoring config: GET|PUT /api/admin/config (plan 25) ─────────────
// Mirrors server/lib/config.ts AppSettings (keys of app.app_config, camelCase).
// skipCooldownHours (app_config skip_cooldown_hours, default 24): a skipped
// asset is hidden from that user's queue for this many hours.

export const ScoringConfigSchema = z.object({
  wilsonZ: z.number(),
  industryPrior: z.number(),
  priorWeight: z.number(),
  priorDecayThreshold: z.number(),
  certificationThreshold: z.number(),
  minVotesForCertification: z.number(),
  stalenessDays: z.number(),
  freshnessIntervalDays: z.number(),
  skipCooldownHours: z.number().int().min(SKIP_COOLDOWN_HOURS_MIN).max(SKIP_COOLDOWN_HOURS_MAX),
  adminEmails: z.array(z.string()),
  stewardEmails: z.array(z.string()),
  seedSampleAssets: z.boolean(),
  bootstrapAdminIds: z.array(z.string()),
});

export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
