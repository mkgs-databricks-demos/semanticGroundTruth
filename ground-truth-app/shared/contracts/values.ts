// shared/contracts/values.ts — as-const value lists and derived unions
// Session 01 · Wave 0 · No enum, no namespace, no default export

export const ASSET_TYPES = ['measure', 'dimension', 'page', 'domain', 'subdomain'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ['PENDING', 'REVIEWED', 'CERTIFIED'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ENVIRONMENTS = ['dev', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

// Skip is NOT a vote (build 4, plan 25): it never changes confidence scores,
// Wilson inputs or certification. Skips are stored in app.review_skips.
export const VOTE_TYPES = ['approve', 'reject', 'edit'] as const;
export type VoteType = (typeof VOTE_TYPES)[number];

// Every action a reviewer can take on a card (UI buttons, MCP input).
export const REVIEW_ACTIONS = [...VOTE_TYPES, 'skip'] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const SKIP_REASONS = ['not_sure', 'not_my_area', 'need_context', 'other'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

// Hours a skipped asset stays out of that user's queue (app_config skip_cooldown_hours).
export const SKIP_COOLDOWN_HOURS_DEFAULT = 24;
export const SKIP_COOLDOWN_HOURS_MIN = 0;
export const SKIP_COOLDOWN_HOURS_MAX = 720;

export const VOTE_SOURCES = ['web', 'mcp', 'agent'] as const;
export type VoteSource = (typeof VOTE_SOURCES)[number];

export const CAMPAIGN_TYPES = ['automatic', 'manual', 'freshness'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const COMPLETION_RULES = ['reviewed_once', 'certified'] as const;
export type CompletionRule = (typeof COMPLETION_RULES)[number];

export const CAMPAIGN_ASSET_STATUSES = ['pending', 'reviewed', 'skipped'] as const;
export type CampaignAssetStatus = (typeof CAMPAIGN_ASSET_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'slack', 'teams', 'webhook'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'read'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const RECIPIENT_TYPES = ['user', 'group', 'role'] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export const NOTIFICATION_EVENT_TYPES = [
  'asset.certified',
  'campaign.created',
  'campaign.completed',
  'vote.milestone',
  'feedback.branch_ready',
  'feedback.failed',
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const ROLES = ['reviewer', 'steward', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// ── User settings (plan 25) ────────────────────────────────────────────

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const MOTION_PREFS = ['system', 'reduce', 'full'] as const;
export type MotionPref = (typeof MOTION_PREFS)[number];

export const CARDS_PER_SESSION_MIN = 5;
export const CARDS_PER_SESSION_MAX = 100;
export const CARDS_PER_SESSION_DEFAULT = 20;

// ── Steward triage (plan 25) ───────────────────────────────────────────

export const FEEDBACK_BATCH_STATUSES = [
  'pending',
  'proposed',
  'in_review',
  'merged',
  'rejected',
  'failed',
] as const;
export type FeedbackBatchStatus = (typeof FEEDBACK_BATCH_STATUSES)[number];

// Statuses a steward may set on a feedback branch (POST .../:batchId/status).
export const FEEDBACK_BRANCH_REVIEW_STATUSES = ['in_review', 'merged', 'rejected'] as const;
export type FeedbackBranchReviewStatus = (typeof FEEDBACK_BRANCH_REVIEW_STATUSES)[number];

export const CONFLICT_RESOLUTIONS = ['accept_edit', 'keep_current', 'reject_all'] as const;
export type ConflictResolution = (typeof CONFLICT_RESOLUTIONS)[number];

// Asset fields an edit vote can propose (votes.edit_* columns).
export const EDIT_FIELDS = ['description', 'plain_english_logic', 'display_name'] as const;
export type EditField = (typeof EDIT_FIELDS)[number];

// ── App groups (conventions §3) ────────────────────────────────────────

export const APP_GROUP_NAMES = [
  'semantic-ground-truth-admins',
  'semantic-ground-truth-stewards',
  'semantic-ground-truth-users',
] as const;
export type AppGroupName = (typeof APP_GROUP_NAMES)[number];

export const APP_GROUP_ROLE: Record<AppGroupName, Role> = {
  'semantic-ground-truth-admins': 'admin',
  'semantic-ground-truth-stewards': 'steward',
  'semantic-ground-truth-users': 'reviewer',
};

// ── Asset sources (conventions §4) ─────────────────────────────────────

export const SOURCE_TYPES = ['git_folder'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const DEFAULT_METRIC_VIEW_GLOB = '**/*.metric_view.yml';
export const DEFAULT_GLOSSARY_GLOB = '**/semantics/**/*.md';
