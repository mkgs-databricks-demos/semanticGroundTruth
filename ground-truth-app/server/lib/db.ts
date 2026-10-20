import { logger } from './logger';

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
  tx(script: string): Promise<void>;
}

interface LakebaseClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export function createDb(lakebase: LakebaseClient): Db {
  return {
    async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
      const start = Date.now();
      const { rows } = await lakebase.query(text, params);
      const elapsed = Date.now() - start;
      if (elapsed > 500) {
        logger.warn('Slow query', { durationMs: elapsed, sql: text.slice(0, 120) });
      }
      return rows as T[];
    },

    async one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
      const rows = await this.query<T>(text, params);
      return rows[0] ?? null;
    },

    async tx(script: string): Promise<void> {
      const wrapped = 'BEGIN;\n' + script + '\nCOMMIT;';
      try {
        await lakebase.query(wrapped);
      } catch (err) {
        try {
          await lakebase.query('ROLLBACK;');
        } catch (_rollbackErr) {
          logger.error('Rollback failed after transaction error', {
            originalError: (err as Error).message,
          });
        }
        throw err;
      }
    },
  };
}
