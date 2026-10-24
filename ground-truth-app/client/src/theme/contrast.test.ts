// client/src/theme/contrast.test.ts — WCAG 2.1 AA contrast verification
// Session 16 · Wave 0 · Reads values from tokens.ts; fails CI if a token change
// drops any pairing below its threshold.
// Reference: ui_brand_plan.md §7.1

import { describe, it, expect } from 'vitest';
import { contrastPairings } from './tokens';

/**
 * Convert a hex colour string (e.g. '#FF3621') to sRGB linear components,
 * then compute the WCAG 2.1 relative luminance.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio between two hex colours. */
function contrastRatio(c1: string, c2: string): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG 2.1 AA contrast', () => {
  // Known-answer sanity check: black on white = 21:1
  it('black on white = 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  // Assert every pairing from the token table
  for (const p of contrastPairings) {
    it(`${p.name} ≥ ${p.min}:1`, () => {
      const ratio = contrastRatio(p.fg, p.bg);
      expect(ratio).toBeGreaterThanOrEqual(p.min);
    });
  }
});
