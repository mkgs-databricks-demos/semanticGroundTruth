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

describe('009_skips_settings_triage', () => {
  const ids = MIGRATIONS.map((m) => m.id);
  const m009 = MIGRATIONS.find((m) => m.id === '009_skips_settings_triage');
  const sql = m009?.sql ?? '';

  it('is registered directly after 008 and is the last migration', () => {
    expect(m009).toBeDefined();
    expect(ids.indexOf('009_skips_settings_triage')).toBe(ids.indexOf('008_votes_version_hash') + 1);
    expect(ids[ids.length - 1]).toBe('009_skips_settings_triage');
  });

  it('creates app.review_skips and app.user_settings', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app\.review_skips\b/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app\.user_settings\b/);
  });

  it('review_skips has the planned columns, CHECKs and indexes', () => {
    expect(sql).toContain("reason        TEXT CHECK (reason IN ('not_sure', 'not_my_area', 'need_context', 'other'))");
    expect(sql).toContain("CHECK (source IN ('web', 'mcp', 'agent'))");
    expect(sql).toMatch(/asset_id\s+UUID NOT NULL REFERENCES app\.assets\(id\)/);
    expect(sql).toMatch(/campaign_id\s+UUID REFERENCES app\.campaigns\(id\)/);
    expect(sql).toMatch(/ON app\.review_skips \(user_id, created_at DESC\)/);
    expect(sql).toMatch(/ON app\.review_skips \(asset_id\)/);
    expect(sql).toMatch(/ON app\.review_skips \(campaign_id\)/);
  });

  it('user_settings enforces themes, densities, motion and cards_per_session 5-100', () => {
    expect(sql).toContain("CHECK (theme IN ('system', 'light', 'dark'))");
    expect(sql).toContain("CHECK (density IN ('comfortable', 'compact'))");
    expect(sql).toContain("CHECK (motion IN ('system', 'reduce', 'full'))");
    expect(sql).toContain('CHECK (cards_per_session BETWEEN 5 AND 100)');
    expect(sql).toContain('REFERENCES app.campaigns(id) ON DELETE SET NULL');
  });

  it('adds user_activity, feedback_batches and votes columns with IF NOT EXISTS', () => {
    for (const col of [
      'total_skips', 'last_skip_at',
      'files', 'summary', 'reviewed_by', 'reviewed_at',
      'resolution', 'resolved_by', 'resolved_at',
    ]) {
      expect(sql, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    }
    const addColumns = sql.match(/ADD\s+COLUMN\b/gi) ?? [];
    const addColumnsIfNotExists = sql.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];
    expect(addColumns.length).toBe(addColumnsIfNotExists.length);
  });

  it('every ADD CONSTRAINT is guarded by a pg_constraint lookup', () => {
    const adds = sql.match(/ADD\s+CONSTRAINT\b/gi) ?? [];
    const guards = sql.match(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint/gi) ?? [];
    expect(adds.length).toBeGreaterThan(0);
    expect(guards.length).toBe(adds.length);
    expect(sql).toContain(
      "CHECK (status IN ('pending', 'proposed', 'in_review', 'merged', 'rejected', 'failed'))",
    );
  });

  it('every INSERT uses ON CONFLICT DO NOTHING and seeds skip_cooldown_hours = 24', () => {
    const inserts = sql.match(/INSERT\s+INTO\b/gi) ?? [];
    const onConflict = sql.match(/ON\s+CONFLICT\s+DO\s+NOTHING/gi) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    expect(onConflict.length).toBe(inserts.length);
    expect(sql).toContain("('skip_cooldown_hours', '24')");
  });

  it('moves legacy skip votes to review_skips before removing them from votes', () => {
    const move = sql.indexOf('INSERT INTO app.review_skips');
    const remove = sql.indexOf("DELETE FROM app.votes WHERE vote_type = 'skip'");
    expect(move).toBeGreaterThan(0);
    expect(remove).toBeGreaterThan(move);
  });

  it('keeps the votes.vote_type CHECK (approve|reject|edit) untouched', () => {
    expect(sql).not.toMatch(/vote_type\s+TEXT/i);
    expect(sql).not.toMatch(/votes_vote_type_check/i);
  });

  it('sets REPLICA IDENTITY FULL on both new tables', () => {
    expect(sql).toContain('ALTER TABLE app.review_skips REPLICA IDENTITY FULL');
    expect(sql).toContain('ALTER TABLE app.user_settings REPLICA IDENTITY FULL');
  });
});
