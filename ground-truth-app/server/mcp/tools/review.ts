// server/mcp/tools/review.ts — review_* MCP tool registrations
// Session 11 · Wave 4 · No enum, no namespace, no default export

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services';
import type { UserContext } from '../../lib/context';
import { hasRole } from '../../lib/context';
import { McpToolShapes } from '../../../shared/contracts/mcp';
import { McpSessionStore } from '../session';
import { toToolError } from '../errors';
import { renderCardMarkdown, renderStatsMarkdown, renderQueryResultMarkdown } from '../views/markdown';
import { renderCardHtml } from '../views/cardHtml';
import { badRequest } from '../../lib/errors';

export function registerReviewTools(
  server: McpServer,
  services: Services,
  user: UserContext,
): void {
  const sessions = new McpSessionStore(services.db);

  // ---- review_get_next ----
  server.tool(
    'review_get_next',
    'Get the next asset to review. Optionally filter by campaign or asset type.',
    McpToolShapes.review_get_next,
    async (args) => {
      try {
        const card = await services.review.getNext(user, {
          campaignId: args.campaign_id,
          assetType: args.asset_type,
        });
        if (!card) {
          return {
            content: [{ type: 'text', text: 'No more assets to review.' }],
          };
        }
        // Update session state
        await sessions.setCurrent(
          user.userId,
          card.asset.id,
          card.campaign?.campaignId,
        );
        const md = renderCardMarkdown(card);
        const html = renderCardHtml(card);
        return {
          content: [{ type: 'text', text: md }],
          structuredContent: card as unknown as Record<string, unknown>,
          _meta: {
            'ui://ground-truth/review-card': {
              mimeType: 'text/html',
              text: html,
            },
          },
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- review_submit_vote ----
  server.tool(
    'review_submit_vote',
    'Submit a vote (approve, reject, or edit) for an asset. Defaults asset_id to the current review session asset.',
    {
      asset_id: z.string().uuid().optional(),
      vote_type: McpToolShapes.review_submit_vote.vote_type,
      feedback: McpToolShapes.review_submit_vote.feedback,
      edits: McpToolShapes.review_submit_vote.edits,
    },
    async (args) => {
      try {
        let assetId = args.asset_id;
        if (!assetId) {
          const session = await sessions.get(user.userId);
          assetId = session?.currentAssetId ?? undefined;
          if (!assetId) {
            throw badRequest(
              'No asset_id provided and no current review session asset.',
            );
          }
        }
        const result = await services.review.submitVote(user, {
          assetId,
          voteType: args.vote_type,
          feedback: args.feedback,
          edits: args.edits,
        });
        // Update session to next card if available
        if (result.next) {
          await sessions.setCurrent(user.userId, result.next.asset.id);
        }
        const text = `Vote recorded: **${result.vote.voteType}** on asset ${result.vote.assetId}. ` +
          `Confidence: ${(result.confidence.confidence * 100).toFixed(1)}%. ` +
          `Status: ${result.assetStatus}.`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- review_add_synonym ----
  server.tool(
    'review_add_synonym',
    'Add, remove, approve, or reject a synonym for an asset.',
    McpToolShapes.review_add_synonym,
    async (args) => {
      try {
        let synonyms;
        switch (args.action) {
          case 'add':
            synonyms = await services.assets.addSynonym(
              args.asset_id,
              args.synonym,
              user.userId,
            );
            break;
          case 'remove': {
            if (!hasRole(user, 'steward')) {
              throw badRequest('Removing synonyms requires steward role.');
            }
            synonyms = await services.assets.removeSynonym(
              args.asset_id,
              args.synonym,
            );
            break;
          }
          case 'approve':
            synonyms = await services.assets.approveSynonym(
              args.asset_id,
              args.synonym,
              user.userId,
            );
            break;
          case 'reject':
            synonyms = await services.assets.rejectSynonym(
              args.asset_id,
              args.synonym,
              user.userId,
            );
            break;
        }
        const text = `Synonym "${args.synonym}" ${args.action}d. Asset now has ${synonyms.length} synonym(s).`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: synonyms as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- review_add_example ----
  server.tool(
    'review_add_example',
    'Add, approve, or reject an example question for an asset.',
    McpToolShapes.review_add_example,
    async (args) => {
      try {
        let examples;
        switch (args.action) {
          case 'add':
            examples = await services.assets.addExample(
              args.asset_id,
              args.question_text ?? '',
              user.userId,
            );
            break;
          case 'approve':
            examples = await services.assets.approveExample(
              args.asset_id,
              args.question_id ?? '',
              user.userId,
            );
            break;
          case 'reject':
            examples = await services.assets.rejectExample(
              args.asset_id,
              args.question_id ?? '',
              user.userId,
            );
            break;
        }
        const text = `Example ${args.action}d. Asset now has ${examples.length} example(s).`;
        return {
          content: [{ type: 'text', text }],
          structuredContent: examples as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- review_get_stats ----
  server.tool(
    'review_get_stats',
    'Get your review statistics: votes, streaks, rank, and coverage.',
    McpToolShapes.review_get_stats,
    async (_args) => {
      try {
        const stats = await services.review.getUserStats(user.userId);
        const md = renderStatsMarkdown(stats);
        return {
          content: [{ type: 'text', text: md }],
          structuredContent: stats as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );

  // ---- review_run_query ----
  server.tool(
    'review_run_query',
    'Run the validation SQL query for an asset and return its results.',
    McpToolShapes.review_run_query,
    async (args) => {
      try {
        const result = await services.review.runQuery(user, args.asset_id);
        const md = renderQueryResultMarkdown(result);
        return {
          content: [{ type: 'text', text: md }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        return toToolError(err);
      }
    },
  );
}
