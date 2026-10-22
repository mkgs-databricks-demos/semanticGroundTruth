// server/migrations/migrations.test.ts — migration invariant tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './index';

describe('MIGRATIONS', () => {
  it('has at least one migration', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
  });

  it('has unique ids', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ids are in lexicographic order (application order)', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('no migration SQL contains DROP', () => {
    for (const m of MIGRATIONS) {
      expect(
        /\bDROP\s/i.test(m.sql),
        `Migration ${m.id} contains a DROP statement`,
      ).toBe(false);
    }
  });

  it('every CREATE TABLE uses IF NOT EXISTS', () => {
    for (const m of MIGRATIONS) {
      const createTables = m.sql.match(/CREATE\s+TABLE\b/gi) ?? [];
      const createTablesIfNotExists =
        m.sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
      expect(
        createTables.length,
        `Migration ${m.id}: CREATE TABLE count should equal CREATE TABLE IF NOT EXISTS count`,
      ).toBe(createTablesIfNotExists.length);
    }
  });

  it('every CREATE INDEX uses IF NOT EXISTS', () => {
    for (const m of MIGRATIONS) {
      const createIndexes = m.sql.match(/CREATE\s+INDEX\b/gi) ?? [];
      const createIndexesIfNotExists =
        m.sql.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
      expect(
        createIndexes.length,
        `Migration ${m.id}: CREATE INDEX count should equal CREATE INDEX IF NOT EXISTS count`,
      ).toBe(createIndexesIfNotExists.length);
    }
  });

  it('every migration has a non-empty description', () => {
    for (const m of MIGRATIONS) {
      expect(m.description.length).toBeGreaterThan(0);
    }
  });
});
