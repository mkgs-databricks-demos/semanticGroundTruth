// client/src/test/fixtures/notifications.ts — shell bell + popover S0 (brief §1.1 "Notifications")
// Session 43 · Build 5 · wave 5-0

import type { Notification, NotificationPreference, UnreadCountResponse } from '../../../../shared/contracts';
import type { MockHandlers } from '../mockApi';
import { hoursAgo, IDS } from './ids';

export const notificationCertified: Notification = {
  id: IDS.notifications.certified,
  userId: IDS.users.priya,
  eventType: 'asset.certified',
  channel: 'in_app',
  status: 'sent',
  title: 'Readmission Rate (30-day) was certified',
  body: 'Confidence passed the certification threshold after 12 votes.',
  metadata: { assetId: IDS.assets.readmissionRate },
  createdAt: hoursAgo(1),
  readAt: null,
};

export const notificationBranchReady: Notification = {
  id: IDS.notifications.branchReady,
  userId: IDS.users.priya,
  eventType: 'feedback.branch_ready',
  channel: 'in_app',
  status: 'sent',
  title: 'Feedback branch mg-genie-feedback-20261024 is ready for review',
  body: '4 assets changed in 2 files.',
  metadata: { batchId: IDS.batches.proposed, branchName: 'mg-genie-feedback-20261024' },
  createdAt: hoursAgo(2),
  readAt: null,
};

/** GET /api/notifications: 2 unread. */
export const notifications: Notification[] = [notificationCertified, notificationBranchReady];

/** GET /api/notifications/unread-count (bell name "Notifications (2 unread)"). */
export const unreadCount: UnreadCountResponse = { count: 2 };

export const notificationPreferences: NotificationPreference[] = [
  { userId: IDS.users.priya, eventType: 'asset.certified', channels: ['in_app'], digest: false },
  { userId: IDS.users.priya, eventType: 'feedback.branch_ready', channels: ['in_app', 'slack'], digest: false },
];

export const notificationsRoutes = {
  'GET /api/notifications': notifications,
  'GET /api/notifications/unread-count': unreadCount,
  'POST /api/notifications/read': { updated: 2 },
  'GET /api/notifications/preferences': notificationPreferences,
} satisfies MockHandlers;
