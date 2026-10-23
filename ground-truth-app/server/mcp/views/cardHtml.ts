// server/mcp/views/cardHtml.ts — self-contained HTML card for MCP Apps rendering
// Session 11 · Wave 4 · Updated session 19 · Wave 0 (brand tokens, dark mode, DM Sans/DM Mono)
// Databricks brand: semantic tokens from ui_brand_plan §3.1/§3.2; light + dark via prefers-color-scheme

import type { ReviewCard } from '../../../shared/contracts/review';

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderCardHtml(card: ReviewCard): string {
  const a = card.asset;
  const name = escHtml(a.displayName || a.name);
  const desc = a.description ? escHtml(a.description) : '';
  const logic = a.plainEnglishLogic ? escHtml(a.plainEnglishLogic) : '';
  const domain = a.domain
    ? escHtml(a.domain) + (a.subdomain ? ` / ${escHtml(a.subdomain)}` : '')
    : '';

  const synonymsHtml = card.synonyms.length > 0
    ? `<p class="synonyms"><strong>Synonyms:</strong> ${card.synonyms.map((s) => escHtml(s.synonym)).join(', ')}</p>`
    : '';

  const examplesHtml = card.examples.length > 0
    ? `<div class="examples"><strong>Example questions:</strong><ul>${card.examples.map((e) => `<li>${escHtml(e.questionText)}</li>`).join('')}</ul></div>`
    : '';

  const confidenceHtml = card.confidence
    ? `<p class="confidence">Confidence: <strong>${(card.confidence.confidence * 100).toFixed(1)}%</strong> (${card.confidence.totalVotes} votes)</p>`
    : '';

  const campaignHtml = card.campaign
    ? `<p class="campaign">Campaign: <em>${escHtml(card.campaign.name)}</em></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
  :root {
    --page-bg: #F9F7F4;
    --text: #1B3139;
    --text-secondary: #5A6F77;
    --surface: #FFFFFF;
    --header-bg: #1B3139;
    --header-text: #FFFFFF;
    --brand-accent: #FF3621;
    --primary: #BD2B26;
    --primary-fg: #FFFFFF;
    --border: #DCE0E2;
    --shadow: rgba(27, 49, 57, 0.12);
    --ring: #2272B4;
    --font-sans: "DM Sans", system-ui, sans-serif;
    --font-mono: "DM Mono", ui-monospace, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --page-bg: #0B2026;
      --text: #FFFFFF;
      --text-secondary: #90A5B1;
      --surface: #1B3139;
      --header-bg: #0B2026;
      --header-text: #FFFFFF;
      --brand-accent: #FF5F46;
      --primary: #FF5F46;
      --primary-fg: #0B2026;
      --border: #1B5162;
      --shadow: rgba(0, 0, 0, 0.3);
      --ring: #8ACAFF;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-sans);
    background: var(--page-bg);
    color: var(--text);
    padding: 16px;
  }
  .card {
    max-width: 480px;
    background: var(--surface);
    border-radius: 12px;
    box-shadow: 0 2px 8px var(--shadow);
    overflow: hidden;
  }
  .card-header {
    background: var(--header-bg);
    color: var(--header-text);
    padding: 16px 20px;
  }
  .card-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .card-header .meta {
    font-size: 13px;
    opacity: 0.85;
  }
  .card-body {
    padding: 16px 20px;
  }
  .card-body p, .card-body div {
    margin-bottom: 10px;
    font-size: 14px;
    line-height: 1.5;
  }
  .description {
    color: var(--text-secondary);
    border-left: 3px solid var(--brand-accent);
    padding-left: 12px;
    font-style: italic;
  }
  .logic {
    color: var(--text);
    font-family: var(--font-mono);
  }
  .synonyms, .confidence, .campaign {
    font-size: 13px;
    color: var(--text-secondary);
  }
  .examples ul {
    margin-top: 4px;
    padding-left: 20px;
  }
  .examples li {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 2px;
  }
  .card-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    justify-content: space-between;
  }
  .badge {
    display: inline-block;
    background: var(--primary);
    color: var(--primary-fg);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    margin-left: 8px;
    vertical-align: middle;
  }
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <h2>${name}<span class="badge">${escHtml(a.assetType)}</span></h2>
    <div class="meta">${escHtml(a.status)}${domain ? ` \u00b7 ${domain}` : ''}</div>
  </div>
  <div class="card-body">
    ${desc ? `<p class="description">${desc}</p>` : ''}
    ${logic ? `<p class="logic"><strong>Logic:</strong> ${logic}</p>` : ''}
    ${synonymsHtml}
    ${examplesHtml}
    ${confidenceHtml}
    ${campaignHtml}
  </div>
  <div class="card-footer">
    <span>${escHtml(card.reason)}</span>
    <span>${card.progress.reviewed} / ${card.progress.total} reviewed</span>
  </div>
</div>
</body>
</html>`;
}
