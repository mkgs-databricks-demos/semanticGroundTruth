// client/src/test/fixtures/steward.ts — steward page S4: campaigns, assets, metric views, sources
// Session 43 · Build 5 · wave 5-0
//
// The three new steward screens have their own modules: feedbackQueue.ts,
// conflicts.ts, feedbackBranches.ts.

import type {
  AssetSource,
  MetricViewSummary,
  Paged,
  Asset,
  ValidateResult,
} from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS, TARGET_CATALOG, TARGET_SCHEMA } from './ids';
import { assets, campaign } from './review';

/** GET /api/assets (first page). */
export const pagedAssets: Paged<Asset> = {
  items: assets,
  total: 120,
  limit: 50,
  offset: 0,
};

export const metricViews: MetricViewSummary[] = [
  {
    fullName: `${TARGET_CATALOG}.${TARGET_SCHEMA}.mv_clinical_quality`,
    comment: 'Clinical quality outcomes: readmissions, mortality, complications.',
    measureCount: 12,
    dimensionCount: 8,
  },
  {
    fullName: `${TARGET_CATALOG}.${TARGET_SCHEMA}.mv_operations_throughput`,
    comment: null,
    measureCount: 6,
    dimensionCount: 5,
  },
];

export const validateOk: ValidateResult = { valid: true };
export const validateFailed: ValidateResult = { valid: false, error: 'UNRESOLVED_COLUMN: discharge_dt' };

export const sources: AssetSource[] = [
  {
    id: IDS.sources.gitFolder,
    sourceType: 'git_folder',
    workspacePath: '/Workspace/Users/priya.raman@example.com/semantic-layer',
    displayName: 'Semantic layer repo',
    metricViewGlob: '**/*.metric_view.yml',
    glossaryGlob: '**/semantics/**/*.md',
    createdBy: IDS.users.priya,
    createdAt: hoursAgo(24 * 14),
    lastScannedAt: hoursAgo(6),
  },
];

export const stewardRoutes = {
  'GET /api/campaigns': [campaign],
  'GET /api/assets': pagedAssets,
  'GET /api/metric-views': metricViews,
  'POST /api/metric-views/:fullName/validate': validateOk,
  'GET /api/sources': sources,
} satisfies MockHandlers;
