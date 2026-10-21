// shared/contracts/values.ts — as-const value lists and derived unions
// Session 01 · Wave 0 · No enum, no namespace, no default export

export const ASSET_TYPES = ['measure', 'dimension', 'page', 'domain', 'subdomain'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ['PENDING', 'REVIEWED', 'CERTIFIED'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ENVIRONMENTS = ['dev', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const VOTE_TYPES = ['approve', 'reject', 'edit'] as const;
export type VoteType = (typeof VOTE_TYPES)[number];

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
