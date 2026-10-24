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
import { mountMcp, closeMcpSessions } from './mcp';
import {
  installShutdownHandlers,
  registerShutdownStep,
  setHttpServer,
  shutdownMiddleware,
} from './lib/shutdown';
import { Server as HttpServer } from 'node:http';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * Use AppKit's http.Server directly when the server plugin exposes it.
 * Otherwise `shutdownMiddleware` captures it from the first request socket.
 */
function adoptAppKitHttpServer(serverPlugin: unknown): void {
  const plugin = serverPlugin as { getServer?: () => unknown; server?: unknown } | null;
  try {
    const candidate = plugin?.getServer?.() ?? plugin?.server;
    if (candidate instanceof HttpServer) setHttpServer(candidate);
  } catch {
    // getServer() can throw before listen(); the middleware fallback covers it.
  }
}

/** End the Lakebase pg pool if the AppKit lakebase plugin exposes one. */
async function endLakebasePool(lakebasePlugin: unknown): Promise<void> {
  const plugin = lakebasePlugin as {
    pool?: { end?: () => Promise<void> };
    close?: () => Promise<void>;
  } | null;
  if (plugin?.pool?.end) {
    await plugin.pool.end();
  } else if (plugin?.close) {
    await plugin.close();
  } else {
    logger.warn('Lakebase plugin exposes no pool.end()/close(); skipping');
  }
}

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

    // 4. Bootstrap admin group (no-op when admins already has members)
    const settings = await config.get();
    await services.membership.bootstrap([
      ...settings.adminEmails,
      ...settings.bootstrapAdminIds,
    ]);

    // 5. Dev seed
    await seedSampleAssets(services.assets, db, settings);

    // 6. HTTP surface (shutdown middleware first: captures the http.Server,
    //    tracks sockets, and returns 503 once draining has started)
    appkit.server.extend((app) => {
      app.use(shutdownMiddleware());
      registerMiddleware(app, { config, membership: services.membership });
      registerRoutes(app, services);
      mountMcp(app, services);
    });

    // 7. Startup marker
    const port = process.env.PORT || 8000;
    logger.info(`listening on port ${port}`);

    // 8. Background timers
    const freshnessTimer = setInterval(() => {
      services.campaigns.runFreshnessCheck().catch((err) => {
        logger.error('Freshness check failed', { error: (err as Error).message });
      });
    }, ONE_DAY_MS);
    freshnessTimer.unref();

    const digestTimer = setInterval(() => {
      services.notifications.flushDigests().catch((err) => {
        logger.error('Digest flush failed', { error: (err as Error).message });
      });
    }, ONE_HOUR_MS);
    digestTimer.unref();

    // 9. Graceful shutdown (SIGTERM/SIGINT): timers -> MCP -> HTTP -> Lakebase,
    //    inside the 15 s Databricks Apps budget. See lib/shutdown.ts.
    adoptAppKitHttpServer(appkit.server);
    registerShutdownStep({
      name: 'background-timers',
      phase: 'beforeHttp',
      run: () => {
        clearInterval(freshnessTimer);
        clearInterval(digestTimer);
      },
    });
    registerShutdownStep({
      name: 'mcp-sessions',
      phase: 'beforeHttp',
      run: async () => {
        const closed = await closeMcpSessions();
        logger.info('MCP sessions drained', { closed });
      },
    });
    registerShutdownStep({
      name: 'lakebase-pool',
      phase: 'afterHttp',
      run: () => endLakebasePool(appkit.lakebase),
    });
    installShutdownHandlers();
  },
}).catch(console.error);
