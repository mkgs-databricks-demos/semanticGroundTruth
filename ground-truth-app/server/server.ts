import { createApp, analytics, jobs, lakebase, server } from '@databricks/appkit';
import { agents } from '@databricks/appkit/beta';
import { setupSampleLakebaseRoutes } from './routes/lakebase/todo-routes';

createApp({
  plugins: [
    agents(),
    analytics(),
    jobs(),
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await setupSampleLakebaseRoutes(appkit);
  },
}).catch(console.error);
