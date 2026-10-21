import type { Db } from '../lib/db';
import { logger } from '../lib/logger';
import type { Migration } from './types';

export async function runMigrationsWithList(
  db: Db,
  migrations: Migration[],
): Promise<{ applied: string[]; total: number }> {
  // Ensure schema and tracking table exist
  await db.tx(`
    CREATE SCHEMA IF NOT EXISTS app;
    CREATE TABLE IF NOT EXISTS app._migrations (
      id          TEXT PRIMARY KEY,
      description TEXT,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Fetch already-applied migration ids
  const rows = await db.query<{ id: string }>('SELECT id FROM app._migrations ORDER BY id');
  const appliedSet = new Set(rows.map((r) => r.id));

  const applied: string[] = [];

  for (const migration of migrations) {
    if (appliedSet.has(migration.id)) {
      continue;
    }

    logger.info('Applying migration', { id: migration.id, description: migration.description });

    try {
      // Run migration SQL + record it in the same transaction
      const escapedDesc = migration.description.replace(/'/g, "''");
      await db.tx(
        migration.sql +
        `\nINSERT INTO app._migrations (id, description) VALUES ('${migration.id}', '${escapedDesc}') ON CONFLICT (id) DO NOTHING;`,
      );
      applied.push(migration.id);
      logger.info('Migration applied', { id: migration.id });
    } catch (err) {
      logger.error('Migration failed', {
        id: migration.id,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  return { applied, total: migrations.length };
}
