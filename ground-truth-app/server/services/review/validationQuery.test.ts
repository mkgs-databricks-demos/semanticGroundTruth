// server/services/review/validationQuery.test.ts
// Session 06 · Wave 2 · Vitest unit tests (pure, no DB)

import { describe, it, expect } from 'vitest';
import { buildValidationQuery } from './validationQuery';
import type { Asset } from '../../../shared/contracts/entities';

function makeAsset(
  overrides: Partial<Asset> = {},
): Asset {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    assetType: 'measure',
    name: 'total_revenue',
    displayName: 'Total Revenue',
    description: null,
    plainEnglishLogic: null,
    yamlContent: null,
    repoUrl: null,
    fixturePath: null,
    branch: null,
    environment: 'dev',
    targetCatalog: 'hls_fde_dev',
    targetSchema: 'metrics',
    status: 'PENDING',
    domain: null,
    subdomain: null,
    sourceId: null,
    sourceMetadata: null,
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
    ...overrides,
  };
}

describe('buildValidationQuery', () => {
  it('returns null when yamlContent is null', () => {
    expect(buildValidationQuery(makeAsset())).toBeNull();
  });

  it('returns explicit validation_query when present', () => {
    const asset = makeAsset({
      yamlContent:
        'name: total_revenue\nvalidation_query: SELECT 1 AS ok\ntype: measure',
    });
    expect(buildValidationQuery(asset)).toBe('SELECT 1 AS ok');
  });

  it('builds SELECT MEASURE for a measure with metric_view', () => {
    const asset = makeAsset({
      name: 'total_revenue',
      assetType: 'measure',
      yamlContent:
        'name: total_revenue\nmetric_view: hls_fde_dev.metrics.sales_mv\ntype: measure',
    });
    expect(buildValidationQuery(asset)).toBe(
      'SELECT MEASURE(`total_revenue`) AS value FROM `hls_fde_dev`.`metrics`.`sales_mv`',
    );
  });

  it('returns null for non-measure with metric_view', () => {
    const asset = makeAsset({
      name: 'region',
      assetType: 'dimension',
      yamlContent:
        'name: region\nmetric_view: hls_fde_dev.metrics.sales_mv',
    });
    expect(buildValidationQuery(asset)).toBeNull();
  });

  it('returns null when metric_view has unsafe identifiers', () => {
    const asset = makeAsset({
      name: 'total_revenue',
      assetType: 'measure',
      yamlContent:
        'name: total_revenue\nmetric_view: hls; DROP TABLE--x.y.z',
    });
    expect(buildValidationQuery(asset)).toBeNull();
  });

  it('returns null when measure name has unsafe chars', () => {
    const asset = makeAsset({
      name: 'total; DROP',
      assetType: 'measure',
      yamlContent:
        'name: bad\nmetric_view: a.b.c',
    });
    expect(buildValidationQuery(asset)).toBeNull();
  });

  it('returns null for yaml with no query or metric_view', () => {
    const asset = makeAsset({
      yamlContent: 'name: just_a_name\ntype: measure',
    });
    expect(buildValidationQuery(asset)).toBeNull();
  });
});
