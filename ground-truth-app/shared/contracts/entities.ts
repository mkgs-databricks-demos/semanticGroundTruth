// shared/contracts/entities.ts — domain entity interfaces (camelCase, ISO-string timestamps)
// Session 01 · Wave 0 · No enum, no namespace, no default export

import type {
  AssetStatus,
  AssetType,
  CampaignAssetStatus,
  CampaignStatus,
  CampaignType,
  CompletionRule,
  Environment,
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  VoteSource,
  VoteType,
} from './values';

// ── Asset Registry (L200-C1 + conventions §5) ──────────────────────────

export interface Asset {
  id: string;
  assetType: AssetType;
  name: string;
  displayName: string;
  description: string | null;
  plainEnglishLogic: string | null;
  yamlContent: string | null;
  repoUrl: string | null;
  fixturePath: string | null;
  branch: string | null;
  environment: Environment;
  targetCatalog: string;
  targetSchema: string;
  status: AssetStatus;
  domain: string | null;
  subdomain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetVersion {
  id: string;
  assetId: string;
  version: number;
  yamlContent: string | null;
  description: string | null;
  plainEnglishLogic: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface AssetSynonym {
  id: string;
  assetId: string;
  synonym: string;
  proposedBy: string;
  approvals: number;
  rejections: number;
  createdAt: string;
}

export interface Vote {
  id: string;
  assetId: string;
  userId: string;
  voteType: VoteType;
  source: VoteSource;
  feedback: string | null;
  editDescription: string | null;
  editPlainEnglishLogic: string | null;
  editDisplayName: string | null;
  createdAt: string;
}

export interface ExampleQuestion {
  id: string;
  assetId: string;
  questionText: string;
  proposedBy: string;
  approved: boolean;
  createdAt: string;
}

export interface ConfidenceScore {
  assetId: string;
  totalVotes: number;
  approvals: number;
  rejections: number;
  edits: number;
  wilsonLower: number;
  wilsonUpper: number;
  confidence: number;
  lastVoteAt: string | null;
  computedAt: string;
}

export interface FeedbackBatch {
  id: string;
  triggeredBy: string;
  branchName: string | null;
  status: string;
  assetCount: number;
  processingTimeSeconds: number | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Campaigns (L200-C5 + conventions §5) ───────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  completionRule: CompletionRule;
  scopeDomain: string | null;
  scopeSubdomain: string | null;
  scopeAssetType: AssetType | null;
  scopeAssetIds: string[] | null;
  rbacGroups: string[];
  freshnessIntervalDays: number | null;
  totalAssets: number;
  reviewedAssets: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CampaignAsset {
  campaignId: string;
  assetId: string;
  status: CampaignAssetStatus;
}

// ── Notifications (L200-C7) ────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreference {
  userId: string;
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  digest: boolean;
}

// ── User activity and gamification ─────────────────────────────────────

export interface UserActivity {
  userId: string;
  email: string;
  totalVotes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastVoteDate: string | null;
  badges: string[];
}

export interface LeaderboardEntry {
  userId: string;
  email: string;
  displayName: string;
  totalVotes: number;
  approvals: number;
  rejections: number;
  edits: number;
  currentStreakDays: number;
  rank: number;
}

export interface UserStats {
  totalVotes: number;
  approvals: number;
  rejections: number;
  edits: number;
  currentStreakDays: number;
  rank: number;
  coveragePct: number;
}

// ── Executive summary ──────────────────────────────────────────────────

export interface ExecutiveSummary {
  totalAssets: number;
  reviewedAssets: number;
  certifiedAssets: number;
  coveragePct: number;
  certificationPct: number;
  activeReviewers7d: number;
  votes7d: number;
  activeCampaigns: number;
}

// ── Metric views ───────────────────────────────────────────────────────

export interface MetricViewSummary {
  fullName: string;
  comment: string | null;
  measureCount: number;
  dimensionCount: number;
}

export interface MetricViewDetail {
  fullName: string;
  comment: string | null;
  measureCount: number;
  dimensionCount: number;
  measures: MetricViewColumn[];
  dimensions: MetricViewColumn[];
  yaml?: string;
}

export interface MetricViewColumn {
  name: string;
  expr: string;
  displayName?: string;
  comment?: string;
  synonyms?: string[];
}

// ── Query results ──────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}
