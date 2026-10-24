import type { Db } from '../lib/db';
import type { Migration } from './types';
import { migration as m001 } from './001_core_schema';
import { migration as m002 } from './002_scoring_feedback';
import { migration as m003 } from './003_campaigns';
import { migration as m004 } from './004_notifications';
import { migration as m005 } from './005_app_state';
import { migration as m006 } from './006_indexes';
import { migration as m007 } from './007_rbac_sources_cdf';
import { migration as m008 } from './008_votes_version_hash';
import { migration as m009 } from './009_skips_settings_triage';
import { runMigrationsWithList } from './runner';

export type { Migration } from './types';

export const MIGRATIONS: Migration[] = [
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009,
];

export { ensureReplicaIdentityFull } from './runner';

export async function runMigrations(
  db: Db,
): Promise<{ applied: string[]; total: number }> {
  return runMigrationsWithList(db, MIGRATIONS);
}
