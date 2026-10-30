// server/mcp/views/app/build.test.ts — review card HTML: generated module is fresh, self-contained, in budget
// Session 34 · Wave 4-2 · Rebuilds with Vite in memory (no files written)

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GENERATED_FILE,
  HTML_GZIP_BUDGET_BYTES,
  assertHtmlBudget,
  buildReviewCardHtml,
  renderGeneratedModule,
} from './build';
import { REVIEW_CARD_APP_HTML } from './reviewCardApp.generated';
import { escapeInlineScript, renderReviewCardAppHtml } from './template';

const HTML = REVIEW_CARD_APP_HTML;

describe('reviewCardApp.generated.ts', () => {
  it('matches a fresh build (run `pnpm exec tsx server/mcp/views/app/build.ts` when this fails)', async () => {
    const fresh = await buildReviewCardHtml();
    expect(fresh === HTML, 'generated review card HTML is stale').toBe(true);
    expect(readFileSync(GENERATED_FILE, 'utf8')).toBe(renderGeneratedModule(fresh));
  }, 120_000);

  it('is within the size budget', () => {
    const size = assertHtmlBudget(HTML);
    expect(size.gzip).toBeLessThanOrEqual(HTML_GZIP_BUDGET_BYTES);
  });
});

describe('self-contained HTML (no network at render time)', () => {
  it('is one document with one inline script and inline styles', () => {
    expect(HTML.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(HTML.match(/<script\b/gi)).toHaveLength(1);
    expect(HTML).toContain('<script>');
    expect(HTML).toContain('<style>');
    expect(HTML).toContain('id="review-card-root"');
  });

  it('loads nothing from an external origin', () => {
    // XML namespace / JSON Schema identifiers inside the bundle are plain strings and fine.
    const external = [
      /\b(?:src|href|action|poster|srcset)\s*=\s*["']?\s*(?:https?:)?\/\//gi,
      /url\(\s*["']?\s*(?:https?:)?\/\//gi,
      /fetch\(\s*["'`]?\s*https?:/gi,
      /@import/gi,
      /<link\b/gi,
      /<script\b[^>]*\bsrc\b/gi,
      /<(?:img|iframe|object|embed|video|audio|source)\b/gi,
    ];
    for (const re of external) expect(HTML.match(re), String(re)).toBeNull();
  });

  it('makes no network calls and carries no credentials (design §5)', () => {
    // SDK v2 (2026-10-30): ext-apps 2.x builds App on @modelcontextprotocol/client,
    // whose shared OAuth metadata schemas and error classes survive tree-shaking
    // (field names like `authorization_servers`, messages like "Authorization
    // server mismatch"). Those are inert strings, so the check targets an
    // Authorization HTTP header being set, not the word itself.
    const forbidden = [
      /\bfetch\(/,
      /XMLHttpRequest/,
      /navigator\.sendBeacon/,
      /\bEventSource\b/,
      /["'`]authorization["'`]\s*[:,\]]/i,
      /\.set\(\s*["'`]authorization["'`]/i,
      /Bearer\s/,
      /dapi[0-9a-f]{8}/i,
    ];
    for (const re of forbidden) {
      expect(re.test(HTML), String(re)).toBe(false);
    }
  });

  it('uses host style variables with brand fallbacks, dark mode and reduced motion', () => {
    expect(HTML).toContain('var(--color-background-primary, #F9F7F4)');
    expect(HTML).toContain(':root[data-theme="dark"]');
    expect(HTML).toContain('prefers-color-scheme: dark');
    expect(HTML).toContain('prefers-reduced-motion: reduce');
    expect(HTML).toContain('var(--font-sans, "DM Sans"');
  });

  it('bundles the ext-apps App client with the design app info', () => {
    expect(HTML).toContain('ground-truth-review-card');
    expect(HTML).toContain('ui/initialize');
    expect(HTML).toContain('review_submit_vote');
    expect(HTML).toContain('review_skip_card');
  });
});

describe('escapeInlineScript', () => {
  it('neutralises </script in the bundle', () => {
    expect(escapeInlineScript('a="</script>";b="</SCRIPT"')).toBe('a="<\\/script>";b="<\\/SCRIPT"');
    expect(renderReviewCardAppHtml('x="</script>"').match(/<\/script>/g)).toHaveLength(1);
  });

  it('refuses "<!--"', () => {
    expect(() => escapeInlineScript('x="<!--"')).toThrow(/<!--/);
  });
});
