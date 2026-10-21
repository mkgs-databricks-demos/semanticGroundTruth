// server/middleware/roles.test.ts — resolveRoles unit tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import { resolveRoles } from './roles';
import type { AppSettings } from '../lib/config';
import { DEFAULT_SETTINGS } from '../lib/config';

function settings(patch: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('resolveRoles', () => {
  it('returns [reviewer] for an unknown email', () => {
    const roles = resolveRoles('nobody@example.com', settings());
    expect(roles).toEqual(['reviewer']);
  });

  it('is case-insensitive for steward emails', () => {
    const s = settings({ stewardEmails: ['Alice@Example.COM'] });
    const roles = resolveRoles('alice@example.com', s);
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('is case-insensitive for admin emails', () => {
    const s = settings({ adminEmails: ['ADMIN@TEST.COM'] });
    const roles = resolveRoles('admin@test.com', s);
    expect(roles).toContain('admin');
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('admin inherits steward (hierarchy)', () => {
    const s = settings({ adminEmails: ['boss@co.com'] });
    const roles = resolveRoles('boss@co.com', s);
    expect(roles).toEqual(['reviewer', 'steward', 'admin']);
  });

  it('steward does not inherit admin', () => {
    const s = settings({ stewardEmails: ['steward@co.com'] });
    const roles = resolveRoles('steward@co.com', s);
    expect(roles).toEqual(['reviewer', 'steward']);
    expect(roles).not.toContain('admin');
  });

  it('handles empty email lists', () => {
    const s = settings({ adminEmails: [], stewardEmails: [] });
    const roles = resolveRoles('anyone@co.com', s);
    expect(roles).toEqual(['reviewer']);
  });
});
