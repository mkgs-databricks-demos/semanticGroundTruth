// server/server.ts — application entry point
// Session 09 · Wave 3 · No default export

import { createApp, analytics, jobs, lakebase, server } from '@databricks/appkit';
import { agents } from '@databricks/appkit/beta';
import { createDb } from './lib/db';
import { ConfigStore } from './lib/config';
import { EventBus } from './lib/events';
import { logger } from './lib/logger';
import { runMigrations } from './migrations';
import { createServices } from './services';
import { seedSampleAssets } from './seed';
import { registerMiddleware } from './middleware';
import { registerRoutes } from './routes';
import { mountMcp } from './mcp';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

createApp({
  plugins: [
    agents(),
    analytics(),
    jobs(),
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    // 1. Database
    const db = createDb(appkit.lakebase);
    await runMigrations(db);

    // 2. Config + Events
    const config = new ConfigStore(db);
    const events = new EventBus();

    // 3. Services (calls subscribe on campaigns + notifications)
    const services = createServices({ db, config, events });

    // 4. Dev seed
    const settings = await config.get();
    await seedSampleAssets(services.assets, db, settings);

    // 5. HTTP surface
    appkit.server.extend((app) => {
      registerMiddleware(app, { config });
      registerRoutes(app, services);
      mountMcp(app, services);
    });

    // 6. Startup marker
    const port = process.env.PORT || 8000;
    logger.info(`listening on port ${port}`);

    // 7. Background timers
    setInterval(() => {
      services.campaigns.runFreshnessCheck().catch((err) => {
        logger.error('Freshness check failed', { error: (err as Error).message });
      });
    }, ONE_DAY_MS).unref();

    setInterval(() => {
      services.notifications.flushDigests().catch((err) => {
        logger.error('Digest flush failed', { error: (err as Error).message });
      });
    }, ONE_HOUR_MS).unref();
  },
}).catch(console.error);
