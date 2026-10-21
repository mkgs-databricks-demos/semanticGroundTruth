// server/services/notification/index.ts — barrel exports
// Session 08 · Wave 2

export { NotificationService } from './notificationService';
export { PRIORITY, resolveChannels } from './routing';
export { SlackDestination } from './destinations/slack';
export { TeamsDestination } from './destinations/teams';
export { WebhookDestination } from './destinations/webhook';
