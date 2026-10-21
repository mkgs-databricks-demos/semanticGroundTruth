// server/mcp/views/markdown.ts — pure markdown renderers for MCP tool responses
// Session 11 · Wave 4 · No enum, no namespace, no default export

import type { ReviewCard } from '../../../shared/contracts/review';
import type {
  UserStats,
  Campaign,
  QueryResult,
} from '../../../shared/contracts/entities';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|');
}

export function renderCardMarkdown(card: ReviewCard): string {
  const lines: string[] = [];
  const a = card.asset;
  lines.push(`## ${esc(a.displayName || a.name)}`);
  lines.push(`**Type:** ${a.assetType} · **Status:** ${a.status}`);
  if (a.domain) {
    lines.push(
      `**Domain:** ${esc(a.domain)}${a.subdomain ? ` / ${esc(a.subdomain)}` : ''}`,
    );
  }
  if (a.description) {
    lines.push('', `> ${esc(a.description)}`);
  }
  if (a.plainEnglishLogic) {
    lines.push('', `**Logic:** ${esc(a.plainEnglishLogic)}`);
  }
  if (card.synonyms.length > 0) {
    lines.push(
      '',
      `**Synonyms:** ${card.synonyms.map((s) => esc(s.synonym)).join(', ')}`,
    );
  }
  if (card.examples.length > 0) {
    lines.push(
      '',
      '**Example questions:**',
      ...card.examples.map((e) => `- ${esc(e.questionText)}`),
    );
  }
  if (card.confidence) {
    const c = card.confidence;
    lines.push(
      '',
      `**Confidence:** ${(c.confidence * 100).toFixed(1)}% (${c.totalVotes} votes: ${c.approvals}✓ ${c.rejections}✗ ${c.edits}✎)`,
    );
  }
  if (card.campaign) {
    lines.push(`**Campaign:** ${esc(card.campaign.name)}`);
  }
  lines.push(
    '',
    `**Reason:** ${card.reason} · **Progress:** ${card.progress.reviewed}/${card.progress.total}`,
  );
  return lines.join('\n');
}

export function renderStatsMarkdown(stats: UserStats): string {
  const lines: string[] = [
    '## Your Review Stats',
    '',
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Total votes | ${stats.totalVotes} |`,
    `| Approvals | ${stats.approvals} |`,
    `| Rejections | ${stats.rejections} |`,
    `| Edits | ${stats.edits} |`,
    `| Current streak | ${stats.currentStreakDays} days |`,
    `| Rank | #${stats.rank} |`,
    `| Coverage | ${stats.coveragePct}% |`,
  ];
  return lines.join('\n');
}

export function renderCampaignsMarkdown(campaigns: Campaign[]): string {
  if (campaigns.length === 0) {
    return 'No campaigns found.';
  }
  const lines: string[] = [
    '## Campaigns',
    '',
    '| Name | Type | Status | Progress |',
    '| --- | --- | --- | --- |',
  ];
  for (const c of campaigns) {
    const pct =
      c.totalAssets > 0
        ? Math.round((c.reviewedAssets / c.totalAssets) * 100)
        : 0;
    lines.push(
      `| ${esc(c.name)} | ${c.campaignType} | ${c.status} | ${c.reviewedAssets}/${c.totalAssets} (${pct}%) |`,
    );
  }
  return lines.join('\n');
}

export function renderQueryResultMarkdown(result: QueryResult): string {
  if (result.columns.length === 0) {
    return 'No results.';
  }
  const maxRows = 20;
  const rows = result.rows.slice(0, maxRows);
  const lines: string[] = [
    `| ${result.columns.map(esc).join(' | ')} |`,
    `| ${result.columns.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.map((v) => esc(String(v ?? ''))).join(' | ')} |`,
    );
  }
  if (result.rows.length > maxRows) {
    lines.push(
      '',
      `*Showing ${maxRows} of ${result.rows.length} rows${result.truncated ? ' (query result was also truncated)' : ''}.*`,
    );
  } else if (result.truncated) {
    lines.push('', '*Result was truncated by the server.*');
  }
  return lines.join('\n');
}
