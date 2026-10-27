// server/mcp/views/cardHtml.test.ts — brand, dark mode, and XSS tests for MCP card HTML
// Session 19 · Wave 0 · Written, not run (no Node toolchain in sessions)

import { describe, it, expect } from 'vitest';
import { renderCardHtml } from './cardHtml';
import type { ReviewCard } from '../../../shared/contracts/review';

const sampleCard: ReviewCard = {
  asset: {
    id: '00000000-0000-0000-0000-000000000019',
    assetType: 'measure',
    name: 'monthly_revenue',
    displayName: 'Monthly Revenue',
    description: 'Aggregated monthly revenue across all regions',
    plainEnglishLogic: 'SUM(amount) WHERE period = current_month',
    yamlContent: null,
    repoUrl: null,
    fixturePath: null,
    branch: null,
    environment: 'production',
    targetCatalog: 'main',
    targetSchema: 'finance',
    status: 'PENDING',
    domain: 'Finance',
    subdomain: 'Revenue',
    sourceId: null,
    sourceMetadata: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    synonyms: [],
  },
  synonyms: [
    {
      id: 's1',
      assetId: '00000000-0000-0000-0000-000000000019',
      synonym: 'MRR',
      proposedBy: 'user1',
      approvals: 2,
      rejections: 0,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  examples: [
    {
      id: 'e1',
      assetId: '00000000-0000-0000-0000-000000000019',
      questionText: 'What is this month revenue?',
      proposedBy: 'user1',
      approved: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  confidence: {
    assetId: '00000000-0000-0000-0000-000000000019',
    totalVotes: 5,
    approvals: 4,
    rejections: 1,
    edits: 0,
    wilsonLower: 0.50,
    wilsonUpper: 0.95,
    confidence: 0.50,
    lastVoteAt: '2026-01-05T00:00:00Z',
    computedAt: '2026-01-05T00:00:00Z',
  },
  campaign: { campaignId: 'c1', name: 'Q4 Audit' },
  reason: 'low_confidence',
  progress: { reviewed: 3, total: 10 },
};

describe('renderCardHtml — brand tokens and dark mode (session 19)', () => {
  it('does not contain the off-brand #f8f9fa hex value', () => {
    const html = renderCardHtml(sampleCard);
    expect(html.toLowerCase()).not.toContain('#f8f9fa');
  });

  it('contains a prefers-color-scheme: dark media query', () => {
    const html = renderCardHtml(sampleCard);
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('escapes a <script> tag in asset displayName (XSS prevention)', () => {
    const xssCard: ReviewCard = {
      ...sampleCard,
      asset: {
        ...sampleCard.asset,
        displayName: '<script>alert("xss")</script>',
      },
    };
    const html = renderCardHtml(xssCard);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('uses DM Sans font stack', () => {
    const html = renderCardHtml(sampleCard);
    expect(html).toContain('"DM Sans"');
    expect(html).toContain('system-ui');
  });

  it('uses DM Mono font stack for logic', () => {
    const html = renderCardHtml(sampleCard);
    expect(html).toContain('"DM Mono"');
    expect(html).toContain('ui-monospace');
  });

  it('uses CSS custom properties instead of inline hex for all visual styles', () => {
    const html = renderCardHtml(sampleCard);
    // Body, card, header, footer all reference var(--*)
    expect(html).toContain('var(--page-bg)');
    expect(html).toContain('var(--surface)');
    expect(html).toContain('var(--header-bg)');
    expect(html).toContain('var(--text)');
    expect(html).toContain('var(--text-secondary)');
    expect(html).toContain('var(--border)');
    expect(html).toContain('var(--brand-accent)');
    expect(html).toContain('var(--primary)');
  });

  it('defines brand-correct light-mode token values', () => {
    const html = renderCardHtml(sampleCard);
    // Oat Light background, Navy 800 text, Lava 600 accent, Lava 700 primary
    expect(html).toContain('#F9F7F4');
    expect(html).toContain('#1B3139');
    expect(html).toContain('#FF3621');
    expect(html).toContain('#BD2B26');
  });

  it('defines dark-mode overrides with correct token values', () => {
    const html = renderCardHtml(sampleCard);
    // Navy 900 page, Lava 500 accent, Navy 400 muted text, Blue 400 ring
    expect(html).toContain('#0B2026');
    expect(html).toContain('#FF5F46');
    expect(html).toContain('#90A5B1');
    expect(html).toContain('#8ACAFF');
  });

  it('includes a :focus-visible rule with the ring token', () => {
    const html = renderCardHtml(sampleCard);
    expect(html).toContain(':focus-visible');
    expect(html).toContain('var(--ring)');
  });

  it('still renders asset content correctly', () => {
    const html = renderCardHtml(sampleCard);
    expect(html).toContain('Monthly Revenue');
    expect(html).toContain('Aggregated monthly revenue across all regions');
    expect(html).toContain('MRR');
    expect(html).toContain('Q4 Audit');
    expect(html).toContain('3 / 10 reviewed');
  });
});
