// client/src/theme/dark-specificity.test.ts — brand dark tokens beat AppKit's OS-dark fallback
// Session 62 · Build 5 · wave 5-9
//
// AppKit's styles.css declares its zinc dark palette in
// `@media (prefers-color-scheme: dark) { :root:not(.light) { ... } }` (specificity 0,2,0).
// A plain `.dark { ... }` (0,1,0) loses to it whenever the OS is dark, so the app
// showed AppKit's near-black instead of Navy 900 (ui_visual_checks run
// 1099658488939115: 22/22 dark cells failed bg_ok). index.css must list a
// selector of at least the same specificity, declared after the AppKit import.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
const APPKIT_CSS = join(__dirname, '..', '..', '..', 'node_modules', '@databricks', 'appkit-ui', 'dist', 'styles.css');

/** Selector list of the block that declares the dark `--background`. */
function darkBackgroundSelectors(css: string): string[] {
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    if (/--background:\s*var\(--dbx-navy-900\)/.test(m[2])) {
      return m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

describe('dark tokens vs AppKit prefers-color-scheme fallback', () => {
  it('the dark block is listed under :root.dark (0,2,0) as well as .dark', () => {
    const selectors = darkBackgroundSelectors(INDEX_CSS);
    expect(selectors).toContain(':root.dark');
    expect(selectors).toContain('.dark');
  });

  it('the dark block comes after the AppKit import', () => {
    expect(INDEX_CSS.indexOf('@import "@databricks/appkit-ui/styles.css"')).toBeLessThan(
      INDEX_CSS.indexOf(':root.dark'),
    );
  });

  it.skipIf(!existsSync(APPKIT_CSS))('AppKit still uses a :root:not(.light) media fallback (0,2,0)', () => {
    // If AppKit changes this selector, re-check the specificity above.
    const appkit = readFileSync(APPKIT_CSS, 'utf8');
    expect(appkit).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\.light\)/);
  });
});
