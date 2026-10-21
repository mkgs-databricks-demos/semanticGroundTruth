// server/services/campaign/scope.test.ts — vitest tests for scope filter builder
// Session 07 · Wave 2 · Written (not run — no Node toolchain in Genie Code)

import { describe, it, expect } from 'vitest';
import { buildScopeFilter } from './scope';

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
