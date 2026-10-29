// client/src/test/fixtures/executive.ts — executive page S5 (brief §1.1 "Executive summary")
// Session 43 · Build 5 · wave 5-0

import type { AppRuntimeConfig, ExecutiveSummary } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';

/** GET /api/admin/summary. */
export const executiveSummary: ExecutiveSummary = {
  totalAssets: 120,
  reviewedAssets: 42,
  certifiedAssets: 18,
  coveragePct: 35,
  certificationPct: 15,
  activeReviewers7d: 23,
  votes7d: 611,
  activeCampaigns: 3,
};

/** GET /api/admin/summary with no assets registered (S5 empty state). */
export const executiveSummaryEmpty: ExecutiveSummary = {
  totalAssets: 0,
  reviewedAssets: 0,
  certifiedAssets: 0,
  coveragePct: 0,
  certificationPct: 0,
  activeReviewers7d: 0,
  votes7d: 0,
  activeCampaigns: 0,
};

// Session 44 (same wave) adds the required field `slackShareEnabled: boolean`
// to GET /api/config (plan 44 step 4; the server returns true). Spread in so
// the fixtures compile and validate before and after that contract lands.
const SLACK_SHARE = { slackShareEnabled: true };

/** GET /api/config with the executive dashboard configured. */
export const runtimeConfig: AppRuntimeConfig = {
  ...SLACK_SHARE,
  executive_dashboard_url: 'https://example.cloud.databricks.com/dashboardsv3/01f0000000000000000000000000000a/published',
};

/** GET /api/config with no dashboard (S5 dashboard-unconfigured state). */
export const runtimeConfigNoDashboard: AppRuntimeConfig = { ...SLACK_SHARE, executive_dashboard_url: null };

export const executiveRoutes = {
  'GET /api/admin/summary': executiveSummary,
  'GET /api/config': runtimeConfig,
} satisfies MockHandlers;
