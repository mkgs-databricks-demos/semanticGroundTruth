// server/services/notification/index.ts — barrel exports
// Session 08 · Wave 2

export { NotificationService } from './notificationService';
export { PRIORITY, resolveChannels } from './routing';
export { SlackDestination } from './destinations/slack';
export { TeamsDestination } from './destinations/teams';
export { WebhookDestination } from './destinations/webhook';
// Build 5 session 50: Share to Slack (system.ai.slack, OBO)
export { SLACK_SHARE_EVENT_TYPE } from './notificationService';
export { SlackMcpClient, SlackLoginRequiredError } from './destinations/slackMcp';
export type { SlackMcpApi, SlackPostResult } from './destinations/slackMcp';
export { SlackShareService, appOrigin, buildShareMessage, slackShareEnabled } from './slackShare';
export type { SlackClientFactory, SlackShareDeps } from './slackShare';
