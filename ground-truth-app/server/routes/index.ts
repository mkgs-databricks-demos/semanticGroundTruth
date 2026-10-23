// server/routes/index.ts — route registration
// Session 09 · Wave 3 · No default export

import type { Application } from 'express';
import type { Services } from '../services';
import { registerHealthRoutes } from './health';
import { registerMeRoutes } from './me';
import { registerReviewRoutes } from './review';
import { registerLeaderboardRoutes } from './leaderboard';
import { registerAssetRoutes } from './assets';
import { registerCampaignRoutes } from './campaigns';
import { registerNotificationRoutes } from './notifications';
import { registerAdminRoutes } from './admin';
import { registerMetricViewRoutes } from './metricViews';
import { registerConfigRoutes } from './config';

export function registerRoutes(app: Application, services: Services): void {
  registerHealthRoutes(app, services);
  registerMeRoutes(app, services);
  registerReviewRoutes(app, services);
  registerLeaderboardRoutes(app, services);
  registerAssetRoutes(app, services);
  registerCampaignRoutes(app, services);
  registerNotificationRoutes(app, services);
  registerAdminRoutes(app, services);
  registerMetricViewRoutes(app, services);
  registerConfigRoutes(app, services);
}
