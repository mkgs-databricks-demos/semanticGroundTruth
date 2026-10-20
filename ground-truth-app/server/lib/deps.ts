import type { Db } from './db';
import type { ConfigStore } from './config';
import type { EventBus } from './events';

export interface ServiceDeps {
  db: Db;
  config: ConfigStore;
  events: EventBus;
}
