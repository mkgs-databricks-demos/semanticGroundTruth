// client/src/theme/tokens-parity.test.ts — Figma variables ↔ tokens.ts ↔ index.css
// Session 42 · Build 5 · wave 5-0 · D-B5-1 (brand values win)
//
// figma-variables.json is a verbatim copy of
// docs/design/ui/figma/design-system/variables.json (the Apps build and the
// /tmp test copies only contain ground-truth-app/, so the docs file is not
// always reachable). Checks:
//   1. every key in both modes of figma-variables.json equals tokens.ts
//   2. every key in both modes of figma-variables.json equals index.css
//   3. index.css --dbx-* primitives equal tokens.ts `brand`
//   4. index.css semantic tokens equal tokens.ts `light` / `dark`
//   5. the copy is byte-identical to the docs file (skipped when unreachable)

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brand, dark, light } from './tokens';

const FIGMA_COPY = join(__dirname, 'figma-variables.json');
const FIGMA_DOCS = join(
  __dirname, '..', '..', '..', '..', 'docs', 'design', 'ui', 'figma', 'design-system', 'variables.json',
);
const INDEX_CSS = join(__dirname, '..', 'index.css');

type Mode = 'light' | 'dark';
type TokenMap = Record<string, string>;

const figma = JSON.parse(readFileSync(FIGMA_COPY, 'utf-8')) as Record<Mode, TokenMap>;
const tokens: Record<Mode, TokenMap> = { light, dark };

const norm = (hex: string) => hex.trim().toUpperCase();

/** Flatten `brand` to the --dbx-* naming: lava[500] -> 'lava-500', oat.light -> 'oat-light'. */
function flattenBrand(): TokenMap {
  const out: TokenMap = {};
  for (const [family, value] of Object.entries(brand)) {
    if (typeof value === 'string') {
      out[family] = value;
      continue;
    }
    for (const [shade, hex] of Object.entries(value)) {
      out[`${family}-${shade}`] = hex;
    }
  }
  return out;
}

/** Parse `:root { ... }` and `.dark { ... }` blocks of index.css into declarations. */
function parseCss(css: string) {
  const primitives: TokenMap = {};
  const raw: Record<Mode, TokenMap> = { light: {}, dark: {} };
  const blockRe = /(^|\n)(:root|\.dark)\s*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css)) !== null) {
    const mode: Mode = block[2] === '.dark' ? 'dark' : 'light';
    const declRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let decl: RegExpExecArray | null;
    while ((decl = declRe.exec(block[3])) !== null) {
      const [, name, value] = decl;
      if (name.startsWith('dbx-')) primitives[name.slice(4)] = value.trim();
      else raw[mode][name] = value.trim();
    }
  }
  const resolve = (value: string): string => {
    const ref = /^var\(--dbx-([a-z0-9-]+)\)$/i.exec(value);
    if (!ref) return value;
    const hex = primitives[ref[1]];
    if (hex === undefined) throw new Error(`index.css references undefined primitive --dbx-${ref[1]}`);
    return hex;
  };
  const semantic: Record<Mode, TokenMap> = { light: {}, dark: {} };
  for (const mode of ['light', 'dark'] as const) {
    for (const [name, value] of Object.entries(raw[mode])) semantic[mode][name] = resolve(value);
  }
  return { primitives, semantic };
}

const css = parseCss(readFileSync(INDEX_CSS, 'utf-8'));

/** Pairs of [key, expected, actual] that differ. */
function mismatches(expected: TokenMap, actual: TokenMap): string[] {
  return Object.entries(expected)
    .filter(([key, hex]) => actual[key] === undefined || norm(actual[key]) !== norm(hex))
    .map(([key, hex]) => `${key}: expected ${hex}, got ${actual[key] ?? '(missing)'}`);
}

describe('Figma variables parity (D-B5-1)', () => {
  it('figma-variables.json has both modes with tokens', () => {
    expect(Object.keys(figma.light).length).toBeGreaterThan(0);
    expect(Object.keys(figma.dark).length).toBeGreaterThan(0);
  });

  for (const mode of ['light', 'dark'] as const) {
    it(`${mode}: every Figma variable equals tokens.ts (0 mismatches)`, () => {
      expect(mismatches(figma[mode], tokens[mode])).toEqual([]);
    });

    it(`${mode}: every Figma variable equals index.css (0 mismatches)`, () => {
      expect(mismatches(figma[mode], css.semantic[mode])).toEqual([]);
    });

    it(`${mode}: every tokens.ts semantic token equals index.css`, () => {
      expect(mismatches(tokens[mode], css.semantic[mode])).toEqual([]);
    });
  }

  it('the corrected brand primitives are in tokens.ts', () => {
    expect(brand.green[600]).toBe('#00A972');
    expect(brand.yellow[500]).toBe('#FCBA33');
    expect(brand.maroon[500]).toBe('#AB4057');
    expect(brand.maroon[300]).toBe('#D69EA8');
    expect(light['warning-text']).toBe('#7D5319');
    expect(dark['warning-text']).toBe('#FFAB00');
  });
});

describe('index.css primitives parity', () => {
  const flat = flattenBrand();

  it('every tokens.ts primitive has an equal --dbx-* in index.css', () => {
    // `white` is written as a literal #FFFFFF in index.css, not as a primitive.
    const { white: _white, ...expected } = flat;
    expect(mismatches(expected, css.primitives)).toEqual([]);
  });

  it('every --dbx-* primitive in index.css exists in tokens.ts', () => {
    expect(mismatches(css.primitives, flat)).toEqual([]);
  });
});

describe('figma-variables.json copy', () => {
  it.skipIf(!existsSync(FIGMA_DOCS))('is byte-identical to docs/design/ui/figma/design-system/variables.json', () => {
    expect(readFileSync(FIGMA_COPY).equals(readFileSync(FIGMA_DOCS))).toBe(true);
  });
});
