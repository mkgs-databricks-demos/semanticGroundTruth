// server/services/index.ts — composition root
// Session 09 · Wave 3 · No default export

import type { Db } from '../lib/db';
import type { ConfigStore } from '../lib/config';
import type { EventBus } from '../lib/events';
import type { ServiceDeps } from '../lib/deps';
import { AssetRegistry } from './asset';
import { MetricViewService } from './metricView';
import { ReviewEngine } from './review';
import { CampaignManager } from './campaign';
import { NotificationService } from './notification';
import { MembershipService } from './membership';
import { StewardService } from './steward';
import { UserSettingsService } from './settings';

export interface Services {
  assets: AssetRegistry;
  metricViews: MetricViewService;
  review: ReviewEngine;
  campaigns: CampaignManager;
  notifications: NotificationService;
  membership: MembershipService;
  steward: StewardService;
  settings: UserSettingsService;
  config: ConfigStore;
  db: Db;
  events: EventBus;
}

let instance: Services | null = null;

export function createServices(deps: ServiceDeps): Services {
  const assets = new AssetRegistry(deps);
  const metricViews = new MetricViewService();
  const membership = new MembershipService(deps);
  const review = new ReviewEngine(deps, assets, metricViews);
  const campaigns = new CampaignManager(deps, membership);
  const notifications = new NotificationService(deps);
  const steward = new StewardService(deps, notifications);
  const settings = new UserSettingsService(deps);

  campaigns.subscribe();
  notifications.subscribe();

  instance = {
    assets,
    metricViews,
    review,
    campaigns,
    notifications,
    membership,
    steward,
    settings,
    config: deps.config,
    db: deps.db,
    events: deps.events,
  };

  return instance;
}

export function getServices(): Services {
  if (!instance) {
    throw new Error('Services not initialised');
  }
  return instance;
}
