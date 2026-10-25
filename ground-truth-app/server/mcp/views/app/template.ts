// server/mcp/views/app/template.ts — HTML shell + CSS for the review card MCP App
// Session 34 · Wave 4-2 · No enum, no namespace, no default export
//
// Colors use the host's MCP Apps style variables (--color-*) with Databricks
// brand fallbacks (ui_brand_plan §3.1/§3.2, same values as views/cardHtml.ts).
// Fonts come from the host (--font-sans / --font-mono) and fall back to the
// DM Sans / DM Mono stack; nothing is fetched (design L300-17 §2 size budget).

const LIGHT = `
    --gt-bg: var(--color-background-primary, #F9F7F4);
    --gt-surface: var(--color-background-secondary, #FFFFFF);
    --gt-text: var(--color-text-primary, #1B3139);
    --gt-text-secondary: var(--color-text-secondary, #5A6F77);
    --gt-border: var(--color-border-primary, #DCE0E2);
    --gt-ring: var(--color-ring-primary, #2272B4);
    --gt-header-bg: #1B3139;
    --gt-header-text: #FFFFFF;
    --gt-accent: #FF3621;
    --gt-primary: #BD2B26;
    --gt-primary-fg: #FFFFFF;
    --gt-error-bg: #FDECEA;
    --gt-error-text: #8A1C14;
    --gt-shadow: rgba(27, 49, 57, 0.12);`;

const DARK = `
    --gt-bg: var(--color-background-primary, #0B2026);
    --gt-surface: var(--color-background-secondary, #1B3139);
    --gt-text: var(--color-text-primary, #FFFFFF);
    --gt-text-secondary: var(--color-text-secondary, #90A5B1);
    --gt-border: var(--color-border-primary, #1B5162);
    --gt-ring: var(--color-ring-primary, #8ACAFF);
    --gt-header-bg: #0B2026;
    --gt-header-text: #FFFFFF;
    --gt-accent: #FF5F46;
    --gt-primary: #FF5F46;
    --gt-primary-fg: #0B2026;
    --gt-error-bg: #3B1512;
    --gt-error-text: #FFB4A8;
    --gt-shadow: rgba(0, 0, 0, 0.3);`;

export const REVIEW_CARD_APP_CSS = `
  :root {${LIGHT}
    --gt-font-sans: var(--font-sans, "DM Sans", system-ui, sans-serif);
    --gt-font-mono: var(--font-mono, "DM Mono", ui-monospace, monospace);
    color-scheme: light dark;
  }
  :root[data-theme="dark"] {${DARK}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {${DARK}
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--gt-font-sans); background: var(--gt-bg); color: var(--gt-text); }
  .root { padding: 12px; }
  .card { max-width: 560px; background: var(--gt-surface); border: 1px solid var(--gt-border); border-radius: 12px;
    box-shadow: 0 2px 8px var(--gt-shadow); overflow: hidden; transition: opacity 180ms ease, transform 180ms ease; }
  .card:focus { outline: none; }
  .card:focus-visible { outline: 2px solid var(--gt-ring); outline-offset: 2px; }
  .card.leaving { opacity: 0.4; transform: translateX(-12px); }
  .card-header { background: var(--gt-header-bg); color: var(--gt-header-text); padding: 14px 18px;
    border-bottom: 3px solid var(--gt-accent); }
  .card-header h2 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .card-header .meta { font-size: 13px; opacity: 0.85; }
  .badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 10px; font-size: 11px;
    font-weight: 600; vertical-align: middle; background: var(--gt-primary); color: var(--gt-primary-fg); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 18px;
    border-bottom: 1px solid var(--gt-border); }
  .card-body { padding: 12px 18px; font-size: 14px; line-height: 1.5; }
  .card-body > * { margin: 0 0 10px; }
  .description { color: var(--gt-text-secondary); border-left: 3px solid var(--gt-accent); padding-left: 12px; font-style: italic; }
  .logic { font-family: var(--gt-font-mono); }
  .synonyms, .confidence, .campaign, .examples { font-size: 13px; color: var(--gt-text-secondary); }
  .examples ul { margin: 4px 0 0; padding-left: 20px; }
  .synonym-form { display: flex; gap: 6px; margin-top: 6px; }
  .card-footer { display: flex; justify-content: space-between; gap: 8px; padding: 10px 18px;
    border-top: 1px solid var(--gt-border); font-size: 12px; color: var(--gt-text-secondary); }
  .btn { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;
    border: 1px solid var(--gt-border); background: var(--gt-surface); color: var(--gt-text); }
  .btn.primary { background: var(--gt-primary); border-color: var(--gt-primary); color: var(--gt-primary-fg); }
  .btn.ghost { background: transparent; }
  .btn.small { padding: 3px 8px; font-size: 12px; }
  .btn:disabled, select:disabled, input:disabled, textarea:disabled { opacity: 0.6; cursor: default; }
  .btn kbd { margin-left: 6px; font-family: var(--gt-font-mono); font-size: 11px; opacity: 0.8; }
  input, textarea, select { font: inherit; font-size: 13px; color: var(--gt-text); background: var(--gt-surface);
    border: 1px solid var(--gt-border); border-radius: 6px; padding: 5px 8px; }
  .synonym-input { flex: 1; min-width: 0; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
    outline: 2px solid var(--gt-ring); outline-offset: 2px; }
  form.edit { display: grid; gap: 6px; padding: 12px 18px; border-bottom: 1px solid var(--gt-border); }
  form.edit label { font-size: 12px; font-weight: 600; color: var(--gt-text-secondary); }
  .edit-actions { display: flex; gap: 8px; margin-top: 4px; }
  .banner { display: flex; gap: 8px; align-items: center; justify-content: space-between; max-width: 560px;
    margin: 0 0 8px; padding: 8px 12px; border-radius: 8px; font-size: 13px; border: 1px solid var(--gt-border); }
  .banner[hidden] { display: none; }
  .banner.error { background: var(--gt-error-bg); color: var(--gt-error-text); border-color: var(--gt-error-text); }
  .empty, .placeholder { max-width: 560px; padding: 18px; text-align: center; color: var(--gt-text-secondary); }
  .stats table { border-collapse: collapse; width: 100%; }
  .stats th, .stats td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--gt-border); font-size: 13px; }
  .narrow .actions, .narrow .card-footer { flex-direction: column; align-items: stretch; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`;

/** Element the entry script renders into. */
export const REVIEW_CARD_ROOT_ID = 'review-card-root';

/**
 * Make inline script text safe inside <script>: a literal "</script" would end
 * the element, so it becomes "<\/script" (same value in JS strings and regexes).
 * "<!--" has no escape that is valid in every JS context, so it is rejected.
 */
export function escapeInlineScript(js: string): string {
  if (js.includes('<!--')) {
    throw new Error('Inline script contains "<!--"; it cannot be embedded safely.');
  }
  return js.replace(/<\/(script)/gi, '<\\/$1');
}

/** The single self-contained HTML document served as ui://ground-truth/review-card. */
export function renderReviewCardAppHtml(script: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Ground Truth review card</title>
<style>${REVIEW_CARD_APP_CSS}</style>
</head>
<body>
<main id="${REVIEW_CARD_ROOT_ID}" class="root"></main>
<script>${escapeInlineScript(script)}</script>
</body>
</html>
`;
}
