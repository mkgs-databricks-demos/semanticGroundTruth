import type { Db } from './db';
import { logger } from './logger';

export interface AppSettings {
  wilsonZ: number;
  industryPrior: number;
  priorWeight: number;
  priorDecayThreshold: number;
  certificationThreshold: number;
  minVotesForCertification: number;
  stalenessDays: number;
  freshnessIntervalDays: number;
  /** app_config skip_cooldown_hours (migration 009): a skipped asset is hidden from that user's queue this long. */
  skipCooldownHours: number;
  adminEmails: string[];
  stewardEmails: string[];
  seedSampleAssets: boolean;
  bootstrapAdminIds: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  wilsonZ: 1.96,
  industryPrior: 0.5,
  priorWeight: 4,
  priorDecayThreshold: 30,
  certificationThreshold: 0.8,
  minVotesForCertification: 5,
  stalenessDays: 90,
  freshnessIntervalDays: 180,
  skipCooldownHours: 24,
  adminEmails: [],
  stewardEmails: [],
  seedSampleAssets: false,
  bootstrapAdminIds: [],
};

const CACHE_TTL_MS = 60_000;

const SNAKE_TO_CAMEL: Record<string, keyof AppSettings> = {
  wilson_z: 'wilsonZ',
  industry_prior: 'industryPrior',
  prior_weight: 'priorWeight',
  prior_decay_threshold: 'priorDecayThreshold',
  certification_threshold: 'certificationThreshold',
  min_votes_for_certification: 'minVotesForCertification',
  staleness_days: 'stalenessDays',
  freshness_interval_days: 'freshnessIntervalDays',
  skip_cooldown_hours: 'skipCooldownHours',
  admin_emails: 'adminEmails',
  steward_emails: 'stewardEmails',
  seed_sample_assets: 'seedSampleAssets',
  bootstrap_admin_ids: 'bootstrapAdminIds',
};

const CAMEL_TO_SNAKE: Record<string, string> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL).map(([snake, camel]) => [camel, snake]),
);

function parseValue(key: keyof AppSettings, raw: unknown): unknown {
  const def = DEFAULT_SETTINGS[key];
  if (typeof def === 'number') return Number(raw);
  if (typeof def === 'boolean') return raw === true || raw === 'true';
  if (Array.isArray(def)) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean);
    return def;
  }
  return raw;
}

function parseEnvList(envVar: string | undefined): string[] {
  if (!envVar) return [];
  return envVar.split(',').map((s) => s.trim()).filter(Boolean);
}

function dedup(arr: string[]): string[] {
  return [...new Set(arr)];
}

export class ConfigStore {
  private db: Db;
  private cached: AppSettings | null = null;
  private cachedAt = 0;

  constructor(db: Db) {
    this.db = db;
  }

  async get(): Promise<AppSettings> {
    if (this.cached && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }

    let settings = { ...DEFAULT_SETTINGS };

    try {
      const rows = await this.db.query<{ key: string; value: unknown }>(
        'SELECT key, value FROM app.app_config',
      );
      for (const row of rows) {
        const camel = SNAKE_TO_CAMEL[row.key];
        if (camel) {
          (settings as Record<string, unknown>)[camel] = parseValue(camel, row.value);
        }
      }
    } catch (err) {
      const pgCode = (err as { code?: string }).code;
      if (pgCode === '42P01') {
        // Table does not exist yet — return defaults
        logger.info('app_config table not found, using defaults');
      } else {
        logger.warn('Failed to read app_config, using defaults', {
          error: (err as Error).message,
        });
      }
    }

    // Env overrides applied last
    const envAdmins = parseEnvList(process.env.GT_ADMIN_EMAILS);
    if (envAdmins.length > 0) {
      settings = { ...settings, adminEmails: dedup([...settings.adminEmails, ...envAdmins]) };
    }
    const envStewards = parseEnvList(process.env.GT_STEWARD_EMAILS);
    if (envStewards.length > 0) {
      settings = { ...settings, stewardEmails: dedup([...settings.stewardEmails, ...envStewards]) };
    }
    const envBootstrapIds = parseEnvList(process.env.GT_BOOTSTRAP_ADMIN_IDS);
    if (envBootstrapIds.length > 0) {
      settings = {
        ...settings,
        bootstrapAdminIds: dedup([...settings.bootstrapAdminIds, ...envBootstrapIds]),
      };
    }
    if (process.env.SEED_SAMPLE_ASSETS === 'true') {
      settings = { ...settings, seedSampleAssets: true };
    }

    this.cached = settings;
    this.cachedAt = Date.now();
    return settings;
  }

  async update(patch: Partial<AppSettings>, updatedBy: string): Promise<AppSettings> {
    const entries = Object.entries(patch).filter(
      ([key]) => key in CAMEL_TO_SNAKE,
    );

    for (const [camelKey, value] of entries) {
      const snakeKey = CAMEL_TO_SNAKE[camelKey];
      const jsonValue = JSON.stringify(value);
      await this.db.query(
        `INSERT INTO app.app_config (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = $2::jsonb, updated_by = $3, updated_at = NOW()`,
        [snakeKey, jsonValue, updatedBy],
      );
    }

    this.cached = null;
    this.cachedAt = 0;
    return this.get();
  }
}
