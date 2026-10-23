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

  it('007 is registered after 006', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    const idx006 = ids.indexOf('006_indexes');
    const idx007 = ids.indexOf('007_rbac_sources_cdf');
    expect(idx006).toBeGreaterThanOrEqual(0);
    expect(idx007).toBeGreaterThanOrEqual(0);
    expect(idx007).toBe(idx006 + 1);
  });

  it('007 contains REPLICA IDENTITY FULL block', () => {
    const m007 = MIGRATIONS.find((m) => m.id === '007_rbac_sources_cdf');
    expect(m007).toBeDefined();
    expect(m007!.sql).toContain('REPLICA IDENTITY FULL');
  });

  it('007 contains no DROP', () => {
    const m007 = MIGRATIONS.find((m) => m.id === '007_rbac_sources_cdf');
    expect(m007).toBeDefined();
    expect(/\bDROP\s/i.test(m007!.sql)).toBe(false);
  });

  it('007 uses IF NOT EXISTS for every CREATE TABLE', () => {
    const m007 = MIGRATIONS.find((m) => m.id === '007_rbac_sources_cdf');
    expect(m007).toBeDefined();
    const creates = m007!.sql.match(/CREATE\s+TABLE\b/gi) ?? [];
    const createsIfNot =
      m007!.sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    expect(creates.length).toBe(createsIfNot.length);
  });
});
