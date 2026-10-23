// shared/contracts/config.ts — runtime config contract
// Session 20 · Wave 0 · No enum, no namespace, no default export

import { z } from 'zod';

export const AppRuntimeConfigSchema = z.object({
  executive_dashboard_url: z.string().url().nullable(),
});

export type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;
