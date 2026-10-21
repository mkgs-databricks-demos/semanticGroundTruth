// server/services/review/validationQuery.ts — build a validation SQL for an asset
// Session 06 · Wave 2 · No enum, no namespace, no default export

import type { Asset } from '../../../shared/contracts/entities';

const SAFE_IDENTIFIER = /^[A-Za-z0-9_]+$/;

/**
 * Build a validation SQL query for an asset.
 *
 * Priority:
 * 1. Explicit `validation_query:` key in yamlContent.
 * 2. For a measure with a `metric_view:` key →
 *    SELECT MEASURE(`<name>`) AS value FROM `<catalog>`.`<schema>`.`<view>`
 * 3. null (no query possible).
 *
 * Identifier parts must match /^[A-Za-z0-9_]+$/.
 */
export function buildValidationQuery(asset: Asset): string | null {
  if (!asset.yamlContent) return null;

  // 1. Check for explicit validation_query
  const vqMatch = asset.yamlContent.match(
    /^validation_query:\s*(.+)$/m,
  );
  if (vqMatch) {
    return vqMatch[1].trim();
  }

  // 2. For measures with a metric_view key
  if (asset.assetType === 'measure') {
    const mvMatch = asset.yamlContent.match(
      /^metric_view:\s*(.+)$/m,
    );
    if (mvMatch) {
      const metricView = mvMatch[1].trim();
      const parts = metricView.split('.');
      if (
        parts.length !== 3 ||
        !parts.every((p) => SAFE_IDENTIFIER.test(p))
      ) {
        return null;
      }
      const [catalog, schema, view] = parts;
      const measureName = asset.name;
      if (!SAFE_IDENTIFIER.test(measureName)) return null;
      return (
        'SELECT MEASURE(`' +
        measureName +
        '`) AS value FROM `' +
        catalog +
        '`.`' +
        schema +
        '`.`' +
        view +
        '`'
      );
    }
  }

  return null;
}
