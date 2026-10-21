import type { AssetRegistry } from '../services/asset/assetRegistry';
import type { Db } from '../lib/db';
import type { AppSettings } from '../lib/config';
import { logger } from '../lib/logger';
import { SAMPLE_ASSETS } from './sampleAssets';

export async function seedSampleAssets(
  registry: AssetRegistry,
  db: Db,
  settings: AppSettings,
): Promise<number> {
  const shouldSeed =
    settings.seedSampleAssets || process.env.NODE_ENV === 'development';

  if (!shouldSeed) {
    return 0;
  }

  // Only seed if no assets exist
  const countRow = await db.one<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM app.assets',
  );
  const existing = Number(countRow?.count ?? 0);
  if (existing > 0) {
    logger.info('Skipping seed: assets table already has rows', { existing });
    return 0;
  }

  logger.info('Seeding sample assets', { count: SAMPLE_ASSETS.length });

  let registered = 0;
  for (const asset of SAMPLE_ASSETS) {
    try {
      const result = await registry.register(asset, 'seed');
      if (result.created) {
        registered++;
      }
    } catch (err) {
      logger.warn('Seed asset failed', {
        name: asset.name,
        error: (err as Error).message,
      });
    }
  }

  logger.info('Seed complete', { registered, total: SAMPLE_ASSETS.length });
  return registered;
}
