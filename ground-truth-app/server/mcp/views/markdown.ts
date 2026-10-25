// server/mcp/views/markdown.ts — pure markdown renderers for MCP tool responses
// Session 11 · Wave 4 · No enum, no namespace, no default export
// Session 34 · Wave 4-2: text fallback says what the MCP App card shows
// (asset, logic, scores, available actions); vote/skip replies include the next card.

import type { ReviewCard, SkipResponse } from '../../../shared/contracts/review';
import type { VoteResult } from '../../../shared/contracts/api';
import type {
  UserStats,
  Campaign,
  QueryResult,
} from '../../../shared/contracts/entities';

/** Text-only reply of review_get_next (MCP_TOOL_CONTRACTS emptyText). */
export const EMPTY_QUEUE_TEXT = 'No more assets to review.';

/** The card's action bar, in words, for hosts without MCP Apps. */
export const CARD_ACTIONS_TEXT =
  '**Actions:** approve, reject or edit with `review_submit_vote` (vote_type approve | reject | edit); ' +
  'skip with `review_skip_card` (a skip is not a vote); add synonyms with `review_add_synonym`.';

/** review_skip_card structuredContent: SkipResponse plus the next card. */
export interface SkipCardResult extends SkipResponse {
  next: ReviewCard | null;
}

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
    '',
    CARD_ACTIONS_TEXT,
  );
  return lines.join('\n');
}

function renderNext(next: ReviewCard | null | undefined): string {
  return next
    ? `\n\n---\n\n**Next card:**\n\n${renderCardMarkdown(next)}`
    : `\n\n${EMPTY_QUEUE_TEXT}`;
}

export function renderVoteMarkdown(result: VoteResult): string {
  const head =
    `Vote recorded: **${result.vote.voteType}** on asset ${result.vote.assetId}. ` +
    `Confidence: ${(result.confidence.confidence * 100).toFixed(1)}%. ` +
    `Status: ${result.assetStatus}.`;
  return head + renderNext(result.next);
}

export function renderSkipMarkdown(result: SkipCardResult): string {
  const s = result.skip;
  const head =
    `Skipped asset ${s.assetId}${s.reason ? ` (reason: ${s.reason})` : ''}. ` +
    'A skip is not a vote: confidence and certification are unchanged. ' +
    `Skipped ${result.stats.skippedCount} in total, ${result.stats.skippedToday} today.`;
  return head + renderNext(result.next);
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
    `| Skipped (not votes) | ${stats.skippedCount} (${stats.skippedToday} today) |`,
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

/** A query cell as text: objects/arrays (VARIANT, STRUCT) as JSON, not "[object Object]". */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v as string | number | boolean | bigint);
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
      `| ${row.map((v) => esc(cellText(v))).join(' | ')} |`,
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
