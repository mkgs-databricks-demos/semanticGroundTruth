// server/services/metricView/parseMetricViewYaml.test.ts — YAML parser tests
// Session 15 · Wave 5 · Written, not run (no Node toolchain)

import { describe, expect, it } from 'vitest';
import { parseMetricViewYaml } from './parseMetricViewYaml';

const SAMPLE_YAML = `
measures:
  - name: total_revenue
    expr: SUM(amount)
    display_name: Total Revenue
    comment: Aggregate revenue across all orders
  - name: order_count
    expr: COUNT(*)
    display_name: Order Count
    synonyms: ["num orders", "total orders"]
dimensions:
  - name: region
    expr: region
    display_name: Region
  - name: order_date
    expr: order_date
    display_name: Order Date
    comment: Date the order was placed
`.trim();

describe('parseMetricViewYaml', () => {
  it('extracts 2 measures from the sample', () => {
    const result = parseMetricViewYaml(SAMPLE_YAML);
    expect(result.measures).toHaveLength(2);
  });

  it('extracts 2 dimensions from the sample', () => {
    const result = parseMetricViewYaml(SAMPLE_YAML);
    expect(result.dimensions).toHaveLength(2);
  });

  it('parses measure names and expressions', () => {
    const { measures } = parseMetricViewYaml(SAMPLE_YAML);
    expect(measures[0].name).toBe('total_revenue');
    expect(measures[0].expr).toBe('SUM(amount)');
    expect(measures[1].name).toBe('order_count');
    expect(measures[1].expr).toBe('COUNT(*)');
  });

  it('parses display_name and comment', () => {
    const { measures, dimensions } = parseMetricViewYaml(SAMPLE_YAML);
    expect(measures[0].displayName).toBe('Total Revenue');
    expect(measures[0].comment).toBe('Aggregate revenue across all orders');
    expect(dimensions[1].comment).toBe('Date the order was placed');
  });

  it('parses inline synonyms list', () => {
    const { measures } = parseMetricViewYaml(SAMPLE_YAML);
    expect(measures[1].synonyms).toEqual(['num orders', 'total orders']);
  });

  it('omits optional fields when absent', () => {
    const { dimensions } = parseMetricViewYaml(SAMPLE_YAML);
    expect(dimensions[0].comment).toBeUndefined();
    expect(dimensions[0].synonyms).toBeUndefined();
  });

  it('returns empty arrays for empty YAML', () => {
    const result = parseMetricViewYaml('');
    expect(result.measures).toEqual([]);
    expect(result.dimensions).toEqual([]);
  });
});
