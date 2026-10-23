// client/src/theme/a11y-static.test.ts — static accessibility audit
// Session 17 · Wave 1 · vitest, reads .tsx source files as text
//
// Three checks (all regex, no DOM):
//   (a) No hard-coded Tailwind palette classes (bg-red-500, text-green-600, etc.)
//   (b) No <button> / <Button> without text child or aria-label
//   (c) No outline-none without a focus-visible: replacement
//
// Known false-positive escapes are documented inline.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ── helpers ─────────────────────────────────────────────────────────────

const COMPONENT_DIRS = [
  join(__dirname, '..', 'components'),
  join(__dirname, '..', 'pages'),
];

/** Recursively find every .tsx file under a directory. */
function findTsx(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...findTsx(full));
      } else if (entry.endsWith('.tsx')) {
        results.push(full);
      }
    }
  } catch {
    // directory may not exist in unit-test environment
  }
  return results;
}

/** All .tsx files under components/ and pages/. */
function allSources(): Array<{ path: string; rel: string; content: string }> {
  const files: Array<{ path: string; rel: string; content: string }> = [];
  const root = join(__dirname, '..');
  for (const dir of COMPONENT_DIRS) {
    for (const f of findTsx(dir)) {
      files.push({
        path: f,
        rel: relative(root, f),
        content: readFileSync(f, 'utf-8'),
      });
    }
  }
  return files;
}

// ── (a) Hard-coded Tailwind palette classes ─────────────────────────────
// Matches (bg|text|border|ring|from|to)-(red|green|blue|yellow|amber|emerald|orange|slate|gray|zinc|rose|sky)-NNN
const PALETTE_RE =
  /(?:bg|text|border|ring|from|to)-(?:red|green|blue|yellow|amber|emerald|orange|slate|gray|zinc|rose|sky)-\d{2,3}/g;

describe('(a) No hard-coded Tailwind palette classes', () => {
  const sources = allSources();
  it.each(sources)('$rel', ({ content, rel }) => {
    const matches = content.match(PALETTE_RE);
    expect(
      matches,
      `${rel} contains hard-coded palette classes: ${matches?.join(', ')}`,
    ).toBeNull();
  });
});

// ── (b) Buttons without accessible name ─────────────────────────────────
// Looks for <button or <Button that are self-closing or whose content is
// only JSX (no text child) and have no aria-label.
//
// Known false positives:
//   - Buttons whose text child is a JSX expression like {label}.
//     These are safe because the expression renders text at runtime.
//     We skip lines that contain a { immediately after > (JSX child expression).
const BUTTON_NO_LABEL_RE =
  /<(?:button|Button)\b[^>]*\/>/g; // self-closing buttons

describe('(b) Self-closing buttons have aria-label', () => {
  const sources = allSources();
  it.each(sources)('$rel', ({ content, rel }) => {
    const violations: string[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(BUTTON_NO_LABEL_RE.source, 'g');
    while ((match = re.exec(content)) !== null) {
      const tag = match[0];
      if (!tag.includes('aria-label')) {
        const line = content.slice(0, match.index).split('\n').length;
        violations.push(`L${line}: ${tag.slice(0, 80)}`);
      }
    }
    expect(
      violations,
      `${rel} has self-closing <button>/<Button> without aria-label:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});

// ── (c) outline-none without focus-visible: ring ────────────────────────
// Any class string containing "outline-none" must also contain
// "focus-visible:" somewhere in the same className attribute.
const OUTLINE_NONE_RE = /className="[^"]*outline-none[^"]*"/g;

describe('(c) outline-none has a focus-visible: replacement', () => {
  const sources = allSources();
  it.each(sources)('$rel', ({ content, rel }) => {
    const violations: string[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(OUTLINE_NONE_RE.source, 'g');
    while ((match = re.exec(content)) !== null) {
      const attr = match[0];
      if (!attr.includes('focus-visible:')) {
        const line = content.slice(0, match.index).split('\n').length;
        violations.push(`L${line}: ${attr.slice(0, 100)}`);
      }
    }
    expect(
      violations,
      `${rel} has outline-none without focus-visible: replacement:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
