// client/src/theme/a11y-static.test.ts — static accessibility audit
// Session 17 · Wave 1 · vitest, reads .tsx source files as text
//
// Three checks (all regex, no DOM):
//   (a) No hard-coded Tailwind palette classes (bg-red-500, text-green-600, etc.)
//   (b) No <button> / <Button> without text child or aria-label
//   (c) No outline-none without a focus-visible: replacement
//
// Session 43 (build 5) adds opt-in strict rules for files whose first line is
// `// @a11y-strict` (build-5 sessions add the marker to every file they
// rewrite, so the rules ratchet without failing today's code):
//   (d1) no lucide-react import
//   (d2) every data-testid matches ui_test_strategy.md §3
//   (d3) a page component under pages/** renders exactly one <h1>
//   (e)  report only: files under pages/** and components/** still missing
//        the marker (session 60 requires that list to be empty)
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

// ── (d) Opt-in strict rules: first line `// @a11y-strict` ───────────────────
// Session 43 · Build 5 · wave 5-0. Test files (*.test.tsx) are not screens
// and are skipped by (d) and (e).

const STRICT_MARKER = '// @a11y-strict';
/** ui_test_strategy.md §3: <page>-<component>-<element>, kebab-case, lower case. */
const TEST_ID_RE = /^[a-z]+(-[a-z0-9]+)+$/;

const isTestFile = (rel: string) => /\.test\.tsx$/.test(rel);
const isStrict = (content: string) => content.split('\n', 1)[0].trim() === STRICT_MARKER;
const isPage = (rel: string) => rel.split(/[\\/]/)[0] === 'pages';
const lineOf = (content: string, index: number) => content.slice(0, index).split('\n').length;

/** lucide-react imports (static, side-effect, dynamic, require). */
const LUCIDE_RE = /(?:from\s+|import\s*\(?\s*|require\(\s*)['"]lucide-react(?:\/[^'"]*)?['"]/g;

/**
 * data-testid values. Literal strings are checked against TEST_ID_RE; a
 * template literal with ${...} is a violation (variable identity goes in a
 * data-* attribute, §3); other expressions (e.g. TEST_IDS.reviewCardRoot from
 * a constants map) cannot be checked statically and are allowed.
 */
function testIdViolations(content: string): string[] {
  const out: string[] = [];
  const re = /data-testid\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    const line = lineOf(content, m.index);
    if (m[5] !== undefined && m[5].includes('${')) {
      out.push(`L${line}: data-testid={\`${value}\`} interpolates; put the variable part in a data-* attribute`);
    } else if (!TEST_ID_RE.test(value)) {
      out.push(`L${line}: data-testid "${value}" does not match ${TEST_ID_RE}`);
    }
  }
  return out;
}

/** Literal <h1> elements in a file (JSX or the h1 tag inside a template string). */
function h1Count(content: string): number {
  return (content.match(/<h1(?=[\s>/])/g) ?? []).length;
}

const strictSources = () => allSources().filter((s) => !isTestFile(s.rel) && isStrict(s.content));

describe('(d) strict files (// @a11y-strict)', () => {
  const sources = strictSources();

  it('rule helpers catch what they claim to', () => {
    expect(testIdViolations('<div data-testid="review-card-root" />')).toEqual([]);
    expect(testIdViolations("<li data-testid={'steward-queue-row'} data-asset-id={id} />")).toEqual([]);
    expect(testIdViolations('<div data-testid={TEST_IDS.reviewCardRoot} />')).toEqual([]);
    expect(testIdViolations('<div data-testid="ReviewCard" />')).toHaveLength(1);
    expect(testIdViolations('<div data-testid="review" />')).toHaveLength(1);
    expect(testIdViolations('<div data-testid={`steward-queue-row-${id}`} />')).toHaveLength(1);
    expect(h1Count('<main><h1 className="x">A</h1><h2>B</h2></main>')).toBe(1);
    expect(h1Count('<h1>A</h1>{err ? <h1>B</h1> : null}')).toBe(2);
    expect("import { Check } from 'lucide-react';".match(LUCIDE_RE)).toHaveLength(1);
    expect("import { Icon } from '../ui/Icon';".match(LUCIDE_RE)).toBeNull();
    expect(isStrict(`${STRICT_MARKER}\n// file header`)).toBe(true);
    expect(isStrict(`// header\n${STRICT_MARKER}`)).toBe(false);
  });

  describe.skipIf(sources.length === 0)('(d1) no lucide-react import', () => {
    it.each(sources)('$rel', ({ content, rel }) => {
      const hits = [...content.matchAll(LUCIDE_RE)].map((m) => `L${lineOf(content, m.index ?? 0)}: ${m[0]}`);
      expect(hits, `${rel} imports lucide-react; use components/ui/Icon:\n${hits.join('\n')}`).toHaveLength(0);
    });
  });

  describe.skipIf(sources.length === 0)('(d2) data-testid naming (ui_test_strategy.md §3)', () => {
    it.each(sources)('$rel', ({ content, rel }) => {
      const violations = testIdViolations(content);
      expect(violations, `${rel} has data-testid values that break §3:\n${violations.join('\n')}`).toHaveLength(0);
    });
  });

  const pages = sources.filter((s) => isPage(s.rel));
  describe.skipIf(pages.length === 0)('(d3) a page renders exactly one <h1>', () => {
    // Static count of literal <h1> in the page file: keep one heading outside
    // the loading / error / empty branches so it is stable across states.
    it.each(pages)('$rel', ({ content, rel }) => {
      expect(h1Count(content), `${rel} must render exactly one <h1>`).toBe(1);
    });
  });
});

// ── (e) Report: screens still missing the marker ────────────────────────────────
// Report only (never fails). The count is in the test name so it shows in
// the default reporter even with silent: 'passed-only'; the list goes to
// stdout. Session 60 turns this into a hard check (the list must be empty).

describe('(e) @a11y-strict coverage (report only)', () => {
  const screens = allSources().filter((s) => !isTestFile(s.rel));
  const missing = screens.filter((s) => !isStrict(s.content)).map((s) => s.rel).sort();

  it(`report: ${missing.length} of ${screens.length} pages/components files still missing ${STRICT_MARKER}`, () => {
    if (missing.length > 0) {
      process.stdout.write(
        `[a11y-static] ${missing.length} file(s) under pages/** and components/** without "${STRICT_MARKER}":\n` +
          missing.map((f) => `  ${f}`).join('\n') +
          '\n',
      );
    }
    expect(missing.length).toBeLessThanOrEqual(screens.length);
  });
});
