// client/src/components/ui/icons-manifest.test.ts — brand icon manifest checks
// Session 42 · Build 5 · wave 5-0 (node project: reads files, no DOM).
//   * every manifest entry has an attachment_id or a `substitute:` source
//   * every downloaded entry's SVG exists and is an <svg> document
//   * ICON_FILES (Icon.tsx) equals the downloaded functional entries
//   * every icon the Figma export uses is in the manifest (when docs/ is reachable)
//   * no runtime CDN URL in client/src app code (only documentation links in
//     comments; tests and test fixtures under client/src/test/ are not shipped)

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ICON_FILES } from './Icon';

interface ManifestEntry {
  name: string;
  kind: 'functional' | 'primary' | 'product' | 'symbol';
  file: string;
  attachment_id?: string;
  source: string;
  downloaded: boolean;
}

const ICONS_DIR = resolve(__dirname, '..', '..', '..', 'public', 'brand', 'icons');
const CLIENT_SRC = resolve(__dirname, '..', '..');
const EXPORT_BRAND = resolve(
  __dirname, '..', '..', '..', '..', '..', 'docs', 'design', 'ui', 'figma', '_code', 'src', 'assets', 'brand',
);
const manifest = JSON.parse(readFileSync(join(ICONS_DIR, 'icons.manifest.json'), 'utf-8')) as {
  icons: ManifestEntry[];
};

describe('icons.manifest.json', () => {
  it('has unique names and files', () => {
    const names = manifest.icons.map((i) => i.name);
    const files = manifest.icons.map((i) => i.file);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(files).size).toBe(files.length);
  });

  it('every entry has an attachment_id or a substitute: source', () => {
    const bad = manifest.icons.filter(
      (i) => !(i.attachment_id && /^[a-z0-9]{15,}$/.test(i.attachment_id)) && !i.source.startsWith('substitute:'),
    );
    expect(bad.map((i) => i.name)).toEqual([]);
  });

  it('every downloaded entry is a committed SVG file', () => {
    const missing = manifest.icons
      .filter((i) => i.downloaded)
      .filter((i) => {
        const path = join(ICONS_DIR, i.file);
        return !existsSync(path) || !readFileSync(path, 'utf-8').includes('<svg');
      });
    expect(missing.map((i) => i.file)).toEqual([]);
  });

  it('the six catalog-only icons are listed with their ids', () => {
    const files = new Set(manifest.icons.map((i) => i.file));
    for (const f of ['copyIcon.svg', 'fileCodeIcon.svg', 'arrowUpIcon.svg', 'arrowDownIcon.svg', 'SendIcon.svg', 'FolderBranchIcon.svg']) {
      expect(files.has(f), f).toBe(true);
    }
  });

  it('ICON_FILES equals the downloaded functional entries', () => {
    const expected = Object.fromEntries(
      manifest.icons.filter((i) => i.kind === 'functional' && i.downloaded).map((i) => [i.name, i.file]),
    );
    expect({ ...ICON_FILES }).toEqual(expected);
  });

  it.skipIf(!existsSync(EXPORT_BRAND))('lists every SVG the Figma export uses', () => {
    const listed = new Set(manifest.icons.map((i) => i.file.replace(/^\.\.\//, '')));
    const unlisted = readdirSync(EXPORT_BRAND).filter((f) => f.endsWith('.svg') && !listed.has(f));
    expect(unlisted).toEqual([]);
  });
});

describe('no runtime CDN URLs in client/src', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return entry === 'test' ? [] : walk(full);
      return /\.(ts|tsx|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it('only documentation links (in comments) contain https://', () => {
    const offenders: string[] = [];
    for (const file of walk(CLIENT_SRC)) {
      readFileSync(file, 'utf-8')
        .split('\n')
        .forEach((line, idx) => {
          if (!line.includes('https://')) return;
          const trimmed = line.trim();
          const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
          if (!isComment) offenders.push(`${file.slice(CLIENT_SRC.length + 1)}:${idx + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
