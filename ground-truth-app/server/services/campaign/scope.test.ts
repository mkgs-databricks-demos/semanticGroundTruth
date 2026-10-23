// server/services/campaign/scope.test.ts — vitest tests for scope filter + RBAC visibility
// Session 08 · Wave 1 · Written (not run — no Node toolchain in Genie Code)

import { describe, it, expect, vi } from 'vitest';
import { buildScopeFilter, checkCampaignVisibility } from './scope';
import type { UserContext, Role } from '../../lib/context';
import type { MembershipService } from '../membership';

describe('buildScopeFilter', () => {
  it('returns TRUE and empty params for an empty scope', () => {
    const result = buildScopeFilter({}, 1);
    expect(result.where).toBe('TRUE');
    expect(result.params).toEqual([]);
  });

  it('returns TRUE for all-null scope', () => {
    const result = buildScopeFilter(
      { scopeDomain: null, scopeSubdomain: null, scopeAssetType: null, scopeAssetIds: null },
      1,
    );
    expect(result.where).toBe('TRUE');
    expect(result.params).toEqual([]);
  });

  it('filters by domain only', () => {
    const result = buildScopeFilter({ scopeDomain: 'finance' }, 1);
    expect(result.where).toBe('domain = $1');
    expect(result.params).toEqual(['finance']);
  });

  it('filters by multiple fields with correct parameter numbering', () => {
    const result = buildScopeFilter(
      { scopeDomain: 'finance', scopeSubdomain: 'revenue', scopeAssetType: 'measure' },
      1,
    );
    expect(result.where).toBe('domain = $1 AND subdomain = $2 AND asset_type = $3');
    expect(result.params).toEqual(['finance', 'revenue', 'measure']);
  });

  it('uses startIndex for parameter numbering offset', () => {
    const result = buildScopeFilter({ scopeDomain: 'hr' }, 5);
    expect(result.where).toBe('domain = $5');
    expect(result.params).toEqual(['hr']);
  });

  it('filters by specific asset IDs with ANY()', () => {
    const ids = ['aaa-bbb', 'ccc-ddd'];
    const result = buildScopeFilter({ scopeAssetIds: ids }, 3);
    expect(result.where).toBe('id = ANY($3)');
    expect(result.params).toEqual([ids]);
  });

  it('ignores empty scopeAssetIds array', () => {
    const result = buildScopeFilter({ scopeAssetIds: [] }, 1);
    expect(result.where).toBe('TRUE');
    expect(result.params).toEqual([]);
  });

  it('combines all four scope fields', () => {
    const result = buildScopeFilter(
      {
        scopeDomain: 'finance',
        scopeSubdomain: 'revenue',
        scopeAssetType: 'measure',
        scopeAssetIds: ['id-1'],
      },
      2,
    );
    expect(result.where).toBe(
      'domain = $2 AND subdomain = $3 AND asset_type = $4 AND id = ANY($5)',
    );
    expect(result.params).toEqual(['finance', 'revenue', 'measure', ['id-1']]);
  });
});

// ── checkCampaignVisibility ──────────────────────────────────────────

function user(roles: Role[], email = 'user@co.com'): UserContext {
  return { userId: email, email, displayName: 'Test', source: 'web', roles };
}

function mockMembership(isMember: boolean): MembershipService {
  return {
    isMemberOfAny: vi.fn().mockResolvedValue(isMember),
    rolesFor: vi.fn(),
    listGroups: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    bootstrap: vi.fn(),
  } as unknown as MembershipService;
}

describe('checkCampaignVisibility', () => {
  it('admins see all campaigns', async () => {
    const m = mockMembership(false);
    expect(await checkCampaignVisibility(user(['admin', 'steward', 'reviewer']), ['group-a'], m)).toBe(true);
    expect(m.isMemberOfAny).not.toHaveBeenCalled();
  });

  it('stewards see all campaigns', async () => {
    const m = mockMembership(false);
    expect(await checkCampaignVisibility(user(['steward', 'reviewer']), ['group-a'], m)).toBe(true);
  });

  it('empty rbacGroups means visible to everyone', async () => {
    const m = mockMembership(false);
    expect(await checkCampaignVisibility(user(['reviewer']), [], m)).toBe(true);
  });

  it('reviewer in the named group sees the campaign', async () => {
    const m = mockMembership(true);
    expect(await checkCampaignVisibility(user(['reviewer']), ['semantic-ground-truth-users'], m)).toBe(true);
    expect(m.isMemberOfAny).toHaveBeenCalledWith('user@co.com', ['semantic-ground-truth-users']);
  });

  it('reviewer NOT in the named group is denied (fail closed)', async () => {
    const m = mockMembership(false);
    expect(await checkCampaignVisibility(user(['reviewer']), ['semantic-ground-truth-stewards'], m)).toBe(false);
  });
});
