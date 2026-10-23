// server/middleware/roles.test.ts — resolveRoles unit tests
// Session 08 · Wave 1 · Written, not run (no Node toolchain in serverless)

import { describe, expect, it, vi } from 'vitest';
import { resolveRoles } from './roles';
import type { AppSettings } from '../lib/config';
import { DEFAULT_SETTINGS } from '../lib/config';
import type { MembershipService } from '../services/membership';
import type { Role } from '../lib/context';
import type { AppGroup } from '../../shared/contracts/entities';

// ── helpers ───────────────────────────────────────────────────────────

function settings(patch: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

function mockMembership(roles: Role[]): MembershipService {
  return {
    rolesFor: vi.fn().mockResolvedValue(roles),
    listGroups: vi.fn().mockResolvedValue([]),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    bootstrap: vi.fn(),
    isMemberOfAny: vi.fn(),
  } as unknown as MembershipService;
}

// ── tests ────────────────────────────────────────────────────────────

describe('resolveRoles', () => {
  it('returns [reviewer] for an unknown email with no group membership', async () => {
    const m = mockMembership(['reviewer']);
    const roles = await resolveRoles('nobody@example.com', settings(), m);
    expect(roles).toContain('reviewer');
    expect(roles).not.toContain('steward');
    expect(roles).not.toContain('admin');
  });

  it('unions app-group roles with legacy email list roles', async () => {
    // User is a steward via app groups, admin via legacy email list
    const m = mockMembership(['reviewer', 'steward']);
    const s = settings({ adminEmails: ['boss@co.com'] });
    const roles = await resolveRoles('boss@co.com', s, m);
    expect(roles).toContain('admin');
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('is case-insensitive for steward emails', async () => {
    const m = mockMembership(['reviewer']);
    const s = settings({ stewardEmails: ['Alice@Example.COM'] });
    const roles = await resolveRoles('alice@example.com', s, m);
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('is case-insensitive for admin emails', async () => {
    const m = mockMembership(['reviewer']);
    const s = settings({ adminEmails: ['ADMIN@TEST.COM'] });
    const roles = await resolveRoles('admin@test.com', s, m);
    expect(roles).toContain('admin');
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('admin from app group implies steward', async () => {
    const m = mockMembership(['reviewer', 'admin']);
    const roles = await resolveRoles('boss@co.com', settings(), m);
    expect(roles).toContain('admin');
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });

  it('steward from app group does not inherit admin', async () => {
    const m = mockMembership(['reviewer', 'steward']);
    const roles = await resolveRoles('steward@co.com', settings(), m);
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
    expect(roles).not.toContain('admin');
  });

  it('handles empty email lists and no group membership', async () => {
    const m = mockMembership(['reviewer']);
    const s = settings({ adminEmails: [], stewardEmails: [] });
    const roles = await resolveRoles('anyone@co.com', s, m);
    expect(roles).toContain('reviewer');
    expect(roles).toHaveLength(1);
  });

  it('admin from legacy emails implies steward even without group membership', async () => {
    const m = mockMembership(['reviewer']);
    const s = settings({ adminEmails: ['boss@co.com'] });
    const roles = await resolveRoles('boss@co.com', s, m);
    expect(roles).toContain('admin');
    expect(roles).toContain('steward');
    expect(roles).toContain('reviewer');
  });
});
