// tests/contract/fixtures.ts — fixed seed data for the in-process contract suite
// Session 35 · Wave 4-3 · test-only · No enum, no namespace, no default export
//
// 2 campaigns, 5 assets (A1 has synonyms), 3 users (reviewer / steward / admin),
// votes incl. two conflicting edits on A2, 1 feedback batch. Every value here is
// what the contract tests expect back from the API, so keep them literal.

import type {
  AppGroup,
  Asset,
  AssetSource,
  AssetSynonym,
  AssetVersion,
  Campaign,
  ExampleQuestion,
  FeedbackBatch,
  MetricViewDetail,
  Notification,
  NotificationPreference,
} from '../../shared/contracts/entities';
import type { CatalogEntry, ScanSourceResponse, SchemaEntry } from '../../shared/contracts/api';
import type { UserContext } from '../../server/lib/context';

/** Fixed clock for the suite. Every timestamp the fake writes derives from it. */
export const NOW = '2026-10-25T12:00:00.000Z';
export const CREATED = '2026-10-01T09:00:00.000Z';
export const UPDATED = '2026-10-20T09:00:00.000Z';

// RFC 9562 v4-shaped ids (zod 4 uuid() checks version and variant bits).
const uid = (prefix: string, n: number) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const IDS = {
  A1: uid('a', 1),
  A2: uid('a', 2),
  A3: uid('a', 3),
  A4: uid('a', 4),
  A5: uid('a', 5),
  C1: uid('c', 1),
  C2: uid('c', 2),
  B1: uid('b', 1),
  V1: uid('d', 1),
  V2: uid('d', 2),
  V3: uid('d', 3),
  V4: uid('d', 4),
  V5: uid('d', 5),
  E1: uid('e', 1),
  N1: uid('9', 1),
  N2: uid('9', 2),
  SRC1: uid('5', 1),
  /** Well-formed ids that are not in the store (404 cases). */
  UNKNOWN: uid('0', 999),
} as const;

export const REVIEWER: UserContext = {
  userId: 'reviewer@example.com',
  email: 'reviewer@example.com',
  displayName: 'Riley Reviewer',
  source: 'web',
  roles: ['reviewer'],
};
export const STEWARD: UserContext = {
  userId: 'steward@example.com',
  email: 'steward@example.com',
  displayName: 'Sam Steward',
  source: 'web',
  roles: ['reviewer', 'steward'],
  accessToken: 'obo-token-steward',
};
export const ADMIN: UserContext = {
  userId: 'admin@example.com',
  email: 'admin@example.com',
  displayName: 'Ada Admin',
  source: 'web',
  roles: ['reviewer', 'steward', 'admin'],
  accessToken: 'obo-token-admin',
};
export const USERS = [REVIEWER, STEWARD, ADMIN] as const;

export const SYNONYMS: AssetSynonym[] = [
  { id: 'syn-1', assetId: IDS.A1, synonym: 'gross revenue', proposedBy: STEWARD.userId, approvals: 2, rejections: 0, createdAt: CREATED },
  { id: 'syn-2', assetId: IDS.A1, synonym: 'sales', proposedBy: REVIEWER.userId, approvals: 1, rejections: 1, createdAt: UPDATED },
];

const base = {
  repoUrl: null,
  branch: null,
  environment: 'dev',
  targetCatalog: 'hls_fde_dev',
  targetSchema: 'ground_truth',
  sourceId: null,
  sourceMetadata: null,
  createdAt: CREATED,
  updatedAt: UPDATED,
} as const;

export const ASSETS: Asset[] = [
  {
    ...base,
    id: IDS.A1,
    assetType: 'measure',
    name: 'total_revenue',
    displayName: 'Total Revenue',
    description: 'Sum of all recognised revenue line items.',
    plainEnglishLogic: 'SUM(revenue) for the period',
    yamlContent: 'name: total_revenue\nexpr: SUM(revenue)\n',
    fixturePath: 'fixtures/metric_views/finance.yml',
    status: 'REVIEWED',
    domain: 'Finance',
    subdomain: 'Revenue',
    synonyms: SYNONYMS,
  },
  {
    ...base,
    id: IDS.A2,
    assetType: 'measure',
    name: 'net_margin',
    displayName: 'Net Margin',
    description: 'Net income as a share of revenue.',
    plainEnglishLogic: 'net_income / revenue',
    yamlContent: 'name: net_margin\nexpr: SUM(net_income) / SUM(revenue)\n',
    fixturePath: 'fixtures/metric_views/finance.yml',
    status: 'REVIEWED',
    domain: 'Finance',
    subdomain: 'Profitability',
    synonyms: [],
  },
  {
    ...base,
    id: IDS.A3,
    assetType: 'dimension',
    name: 'region',
    displayName: 'Region',
    description: 'Sales region of the booking.',
    plainEnglishLogic: null,
    yamlContent: 'name: region\nexpr: region\n',
    fixturePath: 'fixtures/metric_views/finance.yml',
    status: 'PENDING',
    domain: 'Finance',
    subdomain: 'Revenue',
    synonyms: [],
  },
  {
    ...base,
    id: IDS.A4,
    assetType: 'page',
    name: 'customer_glossary',
    displayName: 'Customer',
    description: 'A person or organisation with at least one paid order.',
    plainEnglishLogic: null,
    yamlContent: null,
    fixturePath: null,
    status: 'PENDING',
    domain: 'Customer',
    subdomain: null,
    synonyms: [],
  },
  {
    ...base,
    id: IDS.A5,
    assetType: 'domain',
    name: 'customer',
    displayName: 'Customer Domain',
    description: null,
    plainEnglishLogic: null,
    yamlContent: null,
    fixturePath: null,
    status: 'PENDING',
    domain: 'Customer',
    subdomain: null,
    synonyms: [],
  },
];

export const VERSIONS: AssetVersion[] = [
  { id: 'ver-1', assetId: IDS.A1, version: 1, yamlContent: 'name: total_revenue\nexpr: SUM(amount)\n', description: 'Sum of revenue.', plainEnglishLogic: null, createdAt: CREATED, createdBy: STEWARD.userId },
  { id: 'ver-2', assetId: IDS.A1, version: 2, yamlContent: ASSETS[0].yamlContent, description: ASSETS[0].description, plainEnglishLogic: ASSETS[0].plainEnglishLogic, createdAt: UPDATED, createdBy: STEWARD.userId },
];

export const EXAMPLES: ExampleQuestion[] = [
  { id: IDS.E1, assetId: IDS.A1, questionText: 'What was total revenue last quarter?', proposedBy: REVIEWER.userId, approved: true, createdAt: UPDATED },
];

export interface SeedVote {
  id: string;
  assetId: string;
  userId: string;
  voteType: 'approve' | 'reject' | 'edit';
  feedback: string | null;
  editDescription: string | null;
  createdAt: string;
  campaignId: string | null;
}

export const VOTES: SeedVote[] = [
  { id: IDS.V1, assetId: IDS.A1, userId: REVIEWER.userId, voteType: 'approve', feedback: null, editDescription: null, createdAt: '2026-10-24T10:00:00.000Z', campaignId: IDS.C1 },
  { id: IDS.V2, assetId: IDS.A1, userId: STEWARD.userId, voteType: 'approve', feedback: null, editDescription: null, createdAt: '2026-10-24T11:00:00.000Z', campaignId: IDS.C1 },
  // Conflicting edits on A2 (two different descriptions) plus a reject.
  { id: IDS.V3, assetId: IDS.A2, userId: REVIEWER.userId, voteType: 'edit', feedback: null, editDescription: 'Net income divided by revenue.', createdAt: '2026-10-23T10:00:00.000Z', campaignId: IDS.C1 },
  { id: IDS.V4, assetId: IDS.A2, userId: STEWARD.userId, voteType: 'edit', feedback: null, editDescription: 'Gross profit minus operating costs, over revenue.', createdAt: '2026-10-23T11:00:00.000Z', campaignId: IDS.C1 },
  { id: IDS.V5, assetId: IDS.A2, userId: ADMIN.userId, voteType: 'reject', feedback: 'Definition is ambiguous.', editDescription: null, createdAt: '2026-10-23T12:00:00.000Z', campaignId: IDS.C1 },
];

export const CAMPAIGNS: Campaign[] = [
  {
    id: IDS.C1,
    name: 'Q4 Finance review',
    campaignType: 'manual',
    status: 'active',
    completionRule: 'reviewed_once',
    scopeDomain: 'Finance',
    scopeSubdomain: null,
    scopeAssetType: null,
    scopeAssetIds: [IDS.A1, IDS.A2, IDS.A3],
    rbacGroups: [],
    freshnessIntervalDays: null,
    totalAssets: 3,
    reviewedAssets: 2,
    createdBy: STEWARD.userId,
    createdAt: CREATED,
    updatedAt: UPDATED,
    completedAt: null,
  },
  {
    id: IDS.C2,
    name: 'Customer domain refresh',
    campaignType: 'automatic',
    status: 'paused',
    completionRule: 'certified',
    scopeDomain: 'Customer',
    scopeSubdomain: null,
    scopeAssetType: null,
    scopeAssetIds: [IDS.A4, IDS.A5],
    rbacGroups: [],
    freshnessIntervalDays: 180,
    totalAssets: 2,
    reviewedAssets: 0,
    createdBy: ADMIN.userId,
    createdAt: CREATED,
    updatedAt: UPDATED,
    completedAt: null,
  },
];

export const FEEDBACK_BATCHES: FeedbackBatch[] = [
  {
    id: IDS.B1,
    triggeredBy: ADMIN.userId,
    branchName: 'mg-genie-feedback-20261020',
    status: 'proposed',
    assetCount: 2,
    processingTimeSeconds: 42.5,
    files: ['ground-truth-infra/fixtures/metric_views/finance.yml'],
    summary: '2 edits from 2 reviewers on Net Margin.',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-10-20T08:00:00.000Z',
    completedAt: '2026-10-20T08:01:00.000Z',
  },
];

export const NOTIFICATIONS: Notification[] = [
  { id: IDS.N1, userId: REVIEWER.userId, eventType: 'campaign.created', channel: 'in_app', status: 'sent', title: 'New campaign: Q4 Finance review', body: '3 assets need your review.', metadata: { campaignId: IDS.C1 }, createdAt: '2026-10-24T09:00:00.000Z', readAt: null },
  { id: IDS.N2, userId: REVIEWER.userId, eventType: 'asset.certified', channel: 'in_app', status: 'read', title: 'Total Revenue certified', body: 'Thanks for reviewing.', metadata: { assetId: IDS.A1 }, createdAt: '2026-10-22T09:00:00.000Z', readAt: '2026-10-22T10:00:00.000Z' },
];

export const PREFERENCES: NotificationPreference[] = [
  { userId: REVIEWER.userId, eventType: 'campaign.created', channels: ['in_app'], digest: false },
];

export const GROUPS: AppGroup[] = [
  {
    name: 'semantic-ground-truth-admins',
    role: 'admin',
    description: 'App administrators',
    members: [{ groupName: 'semantic-ground-truth-admins', memberId: ADMIN.userId, addedBy: 'bootstrap', addedAt: CREATED }],
    createdAt: CREATED,
  },
  {
    name: 'semantic-ground-truth-stewards',
    role: 'steward',
    description: 'Data stewards',
    members: [{ groupName: 'semantic-ground-truth-stewards', memberId: STEWARD.userId, addedBy: ADMIN.userId, addedAt: CREATED }],
    createdAt: CREATED,
  },
  { name: 'semantic-ground-truth-users', role: 'reviewer', description: 'Reviewers', members: [], createdAt: CREATED },
];

export const CATALOGS: CatalogEntry[] = [{ name: 'hls_fde_dev', comment: 'Dev catalog' }];
export const SCHEMAS: SchemaEntry[] = [{ name: 'ground_truth', fullName: 'hls_fde_dev.ground_truth', comment: null }];

export const METRIC_VIEW_FQN = 'hls_fde_dev.ground_truth.mv_finance';
export const METRIC_VIEW: MetricViewDetail = {
  fullName: METRIC_VIEW_FQN,
  comment: 'Finance KPIs',
  measureCount: 2,
  dimensionCount: 1,
  measures: [
    { name: 'total_revenue', expr: 'SUM(revenue)', displayName: 'Total Revenue' },
    { name: 'net_margin', expr: 'SUM(net_income) / SUM(revenue)' },
  ],
  dimensions: [{ name: 'region', expr: 'region' }],
  yaml: 'version: 1.1\nsource: hls_fde_dev.ground_truth.bookings\n',
};
/** A metric view that exists in UC but fails validation. */
export const BROKEN_METRIC_VIEW_FQN = 'hls_fde_dev.ground_truth.mv_broken';

export const SOURCES: AssetSource[] = [
  {
    id: IDS.SRC1,
    sourceType: 'git_folder',
    workspacePath: '/Workspace/Users/owner@example.com/semantic-fixtures',
    displayName: 'Semantic fixtures',
    metricViewGlob: '**/*.metric_view.yml',
    glossaryGlob: '**/glossary/*.md',
    createdBy: STEWARD.userId,
    createdAt: CREATED,
    lastScannedAt: null,
  },
];

export const SCAN_RESULT: ScanSourceResponse = {
  metricViewFiles: [{ filePath: 'finance/revenue.metric_view.yml', viewName: 'revenue' }],
  glossaryTerms: [
    { filePath: 'glossary/customer.md', term: 'Active Customer', domain: 'Customer', definition: 'A customer with an order in the last 90 days.' },
  ],
};

export const QUERY_RESULT = { columns: ['period', 'total_revenue'], rows: [['2026-Q3', 1250000]], truncated: false };
