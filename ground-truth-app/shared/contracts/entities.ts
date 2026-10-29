// shared/contracts/entities.ts — domain entity interfaces (camelCase, ISO-string timestamps)
// Session 01 · Wave 0 · No enum, no namespace, no default export

import type {
  AppGroupName,
  AssetStatus,
  AssetType,
  CampaignAssetStatus,
  CampaignStatus,
  CampaignType,
  CompletionRule,
  ConflictResolution,
  Density,
  EditField,
  Environment,
  FeedbackBatchStatus,
  MotionPref,
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  Role,
  SkipReason,
  SourceType,
  Theme,
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
  // Always present (possibly empty), filled from app.asset_synonyms (plan 25).
  synonyms: AssetSynonym[];
  sourceId: string | null;
  sourceMetadata: Record<string, unknown> | null;
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
  status: FeedbackBatchStatus;
  assetCount: number;
  processingTimeSeconds: number | null;
  files: string[];
  summary: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

// ── Skips (plan 25: skip is tracked, never a vote) ────────────────────────

export interface ReviewSkip {
  id: string;
  assetId: string;
  campaignId: string | null;
  reason: SkipReason | null;
  versionHash: string | null;
  source: VoteSource;
  createdAt: string;
}

// ── User settings (plan 25) ────────────────────────────────────────────

export interface UserSettings {
  theme: Theme;
  density: Density;
  motion: MotionPref;
  defaultCampaignId: string | null;
  defaultAssetType: AssetType | null;
  showKeyboardHints: boolean;
  /** 5-100 */
  cardsPerSession: number;
  /** null when the user has no app.user_settings row yet (defaults). */
  updatedAt: string | null;
}

// ── Steward triage (plan 25, routes in session 33) ───────────────────────

export interface FeedbackQueueItem {
  assetId: string;
  displayName: string;
  assetType: AssetType;
  campaignId: string | null;
  votes: { approve: number; reject: number; edit: number };
  skips: number;
  pendingEdits: number;
  lastActivityAt: string | null;
}

export interface EditProposal {
  voteId: string;
  userId: string;
  field: EditField;
  value: string;
  createdAt: string;
}

export interface ConflictGroup {
  assetId: string;
  displayName: string;
  edits: EditProposal[];
  rejectCount: number;
  approveCount: number;
}

export interface ConflictResolutionResult {
  assetId: string;
  resolution: ConflictResolution;
  /** Votes whose resolution/resolved_by/resolved_at were written. */
  resolvedVotes: number;
  resolvedBy: string;
  resolvedAt: string;
}

export interface FeedbackBranch {
  batchId: string;
  branchName: string;
  status: FeedbackBatchStatus;
  assetCount: number;
  files: string[];
  summary: string | null;
  createdAt: string;
  completedAt: string | null;
  reviewedBy: string | null;
  /**
   * Web link to the branch on the Git host (`<repo>/tree/<branch>`), built by the
   * server from GT_FEEDBACK_REPO_URL or the feedback Git folder's remote; never
   * stored. Null when the repo URL is unknown or the row has no branch (build 5).
   */
  htmlUrl: string | null;
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
  totalSkips: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastVoteDate: string | null;
  lastSkipAt: string | null;
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
  /** Shown on the leaderboard, never ranked on. */
  skippedCount: number;
  currentStreakDays: number;
  rank: number;
}

export interface UserStats {
  totalVotes: number;
  approvals: number;
  rejections: number;
  edits: number;
  skippedCount: number;
  skippedToday: number;
  currentStreakDays: number;
  rank: number;
  coveragePct: number;
}

/** Review stats (GET /api/review/stats/me, MCP review_get_stats). */
export type ReviewStats = UserStats;

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

// ── App Groups (RBAC, conventions §3) ──────────────────────────────────

export interface AppGroup {
  name: AppGroupName;
  role: Role;
  description: string | null;
  members: AppGroupMember[];
  createdAt: string;
}

export interface AppGroupMember {
  groupName: AppGroupName;
  memberId: string;
  addedBy: string;
  addedAt: string;
}

// ── Asset Sources (conventions §4) ─────────────────────────────────────

export interface AssetSource {
  id: string;
  sourceType: SourceType;
  workspacePath: string;
  displayName: string | null;
  metricViewGlob: string;
  glossaryGlob: string;
  createdBy: string;
  createdAt: string;
  lastScannedAt: string | null;
}

// ── Query results ──────────────────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}
