// server/mcp/tools/review.ts — review_* MCP tool registrations
// Session 11 · Wave 4 · No enum, no namespace, no default export
// Session 34 · Wave 4-2: review_skip_card; every tool validated against
// MCP_TOOL_CONTRACTS (tools/define.ts); review_get_next, review_submit_vote,
// review_skip_card and review_get_stats render the MCP App review card.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services';
import type { UserContext } from '../../lib/context';
import { hasRole } from '../../lib/context';
import { ReviewCardSchema } from '../../../shared/contracts/schemas';
import type { ReviewCard } from '../../../shared/contracts/review';
import { McpSessionStore } from '../session';
import {
  EMPTY_QUEUE_TEXT,
  renderCardMarkdown,
  renderQueryResultMarkdown,
  renderSkipMarkdown,
  renderStatsMarkdown,
  renderVoteMarkdown,
  type SkipCardResult,
} from '../views/markdown';
import { badRequest } from '../../lib/errors';
import { REVIEW_CARD_UI, registerContractTool } from './define';

/** review_skip_card returns SkipResponse (the contract) plus `next`. */
export const SkipCardExtraSchema = z.object({ next: ReviewCardSchema.nullable() });

export function registerReviewTools(
  server: McpServer,
  services: Services,
  user: UserContext,
): void {
  const sessions = new McpSessionStore(services.db);

  const remember = async (card: ReviewCard | null | undefined): Promise<void> => {
    if (card) await sessions.setCurrent(user.userId, card.asset.id, card.campaign?.campaignId);
  };

  // ---- review_get_next ----
  registerContractTool(server, 'review_get_next', {
    description:
      'Get the next asset to review. Optionally filter by campaign or asset type. ' +
      'Hosts with MCP Apps show it as an interactive review card.',
    ui: REVIEW_CARD_UI,
    handler: async (args) => {
      const card = await services.review.getNext(user, {
        campaignId: args.campaign_id,
        assetType: args.asset_type,
      });
      if (!card) return { text: EMPTY_QUEUE_TEXT };
      await remember(card);
      return { text: renderCardMarkdown(card), data: card };
    },
  });

  // ---- review_submit_vote ----
  registerContractTool(server, 'review_submit_vote', {
    description:
      'Submit a vote (approve, reject, or edit) for an asset. Defaults asset_id to the current review session asset. ' +
      'Returns the vote result and the next card.',
    ui: REVIEW_CARD_UI,
    handler: async (args) => {
      let assetId = args.asset_id;
      if (!assetId) {
        const session = await sessions.get(user.userId);
        assetId = session?.currentAssetId ?? undefined;
        if (!assetId) {
          throw badRequest('No asset_id provided and no current review session asset.');
        }
      }
      const result = await services.review.submitVote(user, {
        assetId,
        voteType: args.vote_type,
        feedback: args.feedback,
        edits: args.edits,
      });
      await remember(result.next);
      return { text: renderVoteMarkdown(result), data: result };
    },
  });

  // ---- review_skip_card ----
  registerContractTool(server, 'review_skip_card', {
    description:
      'Skip an asset without voting and get the next card. Skipping does not count as a vote: it never changes ' +
      'confidence, certification, streaks or campaign progress, and the asset comes back after the skip cooldown. ' +
      'Defaults asset_id (and campaign_id) to the current review session asset.',
    ui: REVIEW_CARD_UI,
    extraOutput: SkipCardExtraSchema,
    handler: async (args) => {
      let assetId = args.asset_id;
      let campaignId = args.campaign_id;
      if (!assetId) {
        const session = await sessions.get(user.userId);
        assetId = session?.currentAssetId ?? undefined;
        if (!assetId) {
          throw badRequest('No asset_id provided and no current review session asset.');
        }
        campaignId = campaignId ?? session?.currentCampaignId ?? undefined;
      }
      const skipped = await services.review.skip(
        user,
        { assetId, campaignId, reason: args.reason },
        'mcp',
      );
      const next = await services.review.getNext(user, campaignId ? { campaignId } : {});
      await remember(next);
      const data: SkipCardResult = { ...skipped, next };
      return { text: renderSkipMarkdown(data), data };
    },
  });

  // ---- review_add_synonym ----
  registerContractTool(server, 'review_add_synonym', {
    description: 'Add, remove, approve, or reject a synonym for an asset.',
    handler: async (args) => {
      switch (args.action) {
        case 'add':
          await services.assets.addSynonym(args.asset_id, args.synonym, user.userId);
          break;
        case 'remove': {
          if (!hasRole(user, 'steward')) {
            throw badRequest('Removing synonyms requires steward role.');
          }
          await services.assets.removeSynonym(args.asset_id, args.synonym);
          break;
        }
        case 'approve':
        case 'reject':
          await services.assets.voteSynonym(args.asset_id, args.synonym, user.userId, args.action);
          break;
      }
      const synonyms = await services.assets.listSynonyms(args.asset_id);
      const text = `Synonym "${args.synonym}" ${args.action}d. Asset now has ${synonyms.length} synonym(s).`;
      return { text, data: { items: synonyms } };
    },
  });

  // ---- review_add_example ----
  registerContractTool(server, 'review_add_example', {
    description: 'Add, approve, or reject an example question for an asset.',
    handler: async (args) => {
      switch (args.action) {
        case 'add':
          await services.assets.addExample(args.asset_id, args.question_text ?? '', user.userId);
          break;
        case 'approve':
        case 'reject':
          await services.assets.voteExample(args.question_id ?? '', user.userId, args.action);
          break;
      }
      const examples = await services.assets.listExamples(args.asset_id);
      const text = `Example ${args.action}d. Asset now has ${examples.length} example(s).`;
      return { text, data: { items: examples } };
    },
  });

  // ---- review_get_stats ----
  registerContractTool(server, 'review_get_stats', {
    description: 'Get your review statistics: votes, skips (not votes), streaks, rank, and coverage.',
    ui: REVIEW_CARD_UI,
    handler: async () => {
      const stats = await services.review.getUserStats(user.userId);
      return { text: renderStatsMarkdown(stats), data: stats };
    },
  });

  // ---- review_run_query ----
  registerContractTool(server, 'review_run_query', {
    description: 'Run the validation SQL query for an asset and return its results.',
    handler: async (args) => {
      const result = await services.review.runQuery(user, args.asset_id);
      return { text: renderQueryResultMarkdown(result), data: result };
    },
  });
}
